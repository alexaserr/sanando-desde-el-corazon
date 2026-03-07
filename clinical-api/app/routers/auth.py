"""
Endpoints de autenticación — clinical-api.

Flujo:
  POST /login          → credenciales → access token (+ refresh cookie)
                          si Admin con 2FA: retorna pending token + requires_2fa=true
  POST /2fa/verify     → pending token + código TOTP → access token (+ refresh cookie)
  POST /refresh        → cookie refresh → nuevo access token (rotación)
  POST /logout         → elimina cookie de refresh
  POST /2fa/setup      → Admin autenticado → genera secret TOTP, guarda, retorna QR URI
"""
from uuid import UUID

import pyotp
from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, Response, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db.models import User, UserRole
from app.db.session import get_db
from app.dependencies import require_role
from app.rate_limit import limiter
from app.schemas.auth import (
    LoginRequest,
    LoginResponse,
    RefreshResponse,
    TwoFactorRequest,
    TwoFactorSetupResponse,
)
from app.security import (
    create_access_token,
    create_pending_2fa_token,
    create_refresh_token,
    decode_token,
    generate_totp_secret,
    verify_password,
    verify_totp,
)

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])

_REFRESH_COOKIE = "refresh_token"
_COOKIE_MAX_AGE = settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS * 86400
_bearer = HTTPBearer()


# ── Helpers de cookie ─────────────────────────────────────────

def _set_refresh_cookie(response: Response, token: str) -> None:
    """Establece la cookie de refresh con todos los flags de seguridad requeridos."""
    response.set_cookie(
        key=_REFRESH_COOKIE,
        value=token,
        httponly=True,
        secure=True,
        samesite="strict",
        max_age=_COOKIE_MAX_AGE,
        path="/api/v1/auth",
    )


def _clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(
        key=_REFRESH_COOKIE,
        path="/api/v1/auth",
        httponly=True,
        secure=True,
        samesite="strict",
    )


# ── Helper pgcrypto ───────────────────────────────────────────

async def _find_user_by_email(db: AsyncSession, email: str) -> User | None:
    """Busca un usuario activo descifrando el campo email con pgp_sym_decrypt."""
    row = (
        await db.execute(
            text("""
                SELECT id FROM users
                WHERE pgp_sym_decrypt(email::bytea, :key) = :email
                  AND deleted_at IS NULL
                LIMIT 1
            """),
            {"key": settings.CLINICAL_DB_PGCRYPTO_KEY, "email": email},
        )
    ).fetchone()

    if row is None:
        return None

    return (
        await db.execute(select(User).where(User.id == row.id))
    ).scalar_one_or_none()


# ── Endpoints ─────────────────────────────────────────────────

@router.post("/login", response_model=LoginResponse)
@limiter.limit("5 per 15 minutes")
async def login(
    request: Request,
    body: LoginRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> LoginResponse:
    """
    Valida credenciales y emite tokens.
    Rate limit: 5 intentos por IP cada 15 minutos.
    Admin con 2FA habilitado recibe requires_2fa=true y un token pendiente.
    """
    # Respuesta genérica para no filtrar si el email existe
    _invalid = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Credenciales incorrectas",
    )

    user = await _find_user_by_email(db, body.email)
    if user is None or not user.is_active:
        raise _invalid

    if not verify_password(body.password, user.hashed_password):
        raise _invalid

    # 2FA obligatorio para Admin cuando ya está configurado
    if user.role == UserRole.admin and user.totp_enabled:
        pending_token = create_pending_2fa_token(user.id)
        return LoginResponse(access_token=pending_token, requires_2fa=True)

    access_token = create_access_token(user.id, user.role.value)
    refresh_token = create_refresh_token(user.id)
    _set_refresh_cookie(response, refresh_token)

    return LoginResponse(access_token=access_token)


@router.post("/refresh", response_model=RefreshResponse)
async def refresh(
    response: Response,
    db: AsyncSession = Depends(get_db),
    refresh_token_cookie: str | None = Cookie(default=None, alias=_REFRESH_COOKIE),
) -> RefreshResponse:
    """Lee la cookie de refresh, valida, rota y emite un nuevo access token."""
    if refresh_token_cookie is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Cookie de refresh ausente",
        )

    try:
        payload = decode_token(refresh_token_cookie)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token inválido o expirado",
        )

    if payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Tipo de token incorrecto",
        )

    user_id_str: str | None = payload.get("sub")
    if not user_id_str:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token sin sujeto",
        )

    user_id = UUID(user_id_str)
    user = (
        await db.execute(
            select(User).where(
                User.id == user_id,
                User.deleted_at.is_(None),
                User.is_active.is_(True),
            )
        )
    ).scalar_one_or_none()

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario no encontrado o inactivo",
        )

    new_access = create_access_token(user.id, user.role.value)
    new_refresh = create_refresh_token(user.id)
    _set_refresh_cookie(response, new_refresh)

    return RefreshResponse(access_token=new_access)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(response: Response) -> None:
    """Elimina la cookie de refresh token."""
    _clear_refresh_cookie(response)


@router.post("/2fa/verify", response_model=LoginResponse)
async def verify_2fa(
    body: TwoFactorRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
    credentials: HTTPAuthorizationCredentials = Depends(_bearer),
) -> LoginResponse:
    """
    Completa el login de Admin validando el código TOTP.
    Requiere el token pendiente emitido por /login cuando requires_2fa=true.
    """
    try:
        payload = decode_token(credentials.credentials)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido o expirado",
        )

    if payload.get("type") != "2fa_pending":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Se requiere el token pendiente de 2FA",
        )

    user_id_str_2fa: str | None = payload.get("sub")
    if not user_id_str_2fa:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token pendiente sin sujeto",
        )

    user_id = UUID(user_id_str_2fa)
    user = (
        await db.execute(
            select(User).where(
                User.id == user_id,
                User.deleted_at.is_(None),
                User.is_active.is_(True),
            )
        )
    ).scalar_one_or_none()

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario no encontrado o inactivo",
        )

    if not user.totp_secret or not verify_totp(user.totp_secret, body.code):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Código 2FA incorrecto",
        )

    access_token = create_access_token(user.id, user.role.value)
    refresh_token = create_refresh_token(user.id)
    _set_refresh_cookie(response, refresh_token)

    return LoginResponse(access_token=access_token, requires_2fa=False)


@router.post("/2fa/setup", response_model=TwoFactorSetupResponse)
async def setup_2fa(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.admin)),
) -> TwoFactorSetupResponse:
    """
    Genera un nuevo secret TOTP para el Admin autenticado, lo persiste y retorna el QR URI.
    Solo accesible con token de acceso válido de rol Admin.
    """
    secret = generate_totp_secret()
    current_user.totp_secret = secret
    current_user.totp_enabled = True
    await db.commit()

    qr_uri = pyotp.TOTP(secret).provisioning_uri(
        name=f"admin-{current_user.id!s}",
        issuer_name="Sanando desde el Corazón",
    )

    return TwoFactorSetupResponse(secret=secret, qr_uri=qr_uri)
