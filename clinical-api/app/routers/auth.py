"""
Endpoints de autenticación — clinical-api.

Flujo:
  POST /login          → credenciales → access token (+ refresh cookie)
                          si Admin con 2FA: retorna pending token + requires_2fa=true
  POST /2fa/verify     → pending token + código TOTP → access token (+ refresh cookie)
  POST /refresh        → cookie refresh → nuevo access token (rotación, Redis)
  POST /logout         → invalida refresh token en Redis + elimina cookie
  POST /logout-all     → invalida TODOS los refresh tokens del usuario en Redis
  POST /2fa/setup      → Admin autenticado → genera secret TOTP, guarda, retorna QR URI
  GET  /me             → usuario autenticado → datos con PII descifrado
"""
from uuid import UUID

import pyotp
import redis.asyncio as aioredis
from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, Response, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db.models import User, UserRole
from app.db.session import get_db
from app.dependencies import get_current_user, require_role
from app.rate_limit import limiter
from app.redis_client import get_redis
from app.schemas.auth import (
    LoginRequest,
    LoginResponse,
    MeData,
    MeResponse,
    RefreshResponse,
    TwoFactorRequest,
    TwoFactorSetupResponse,
)
from app.security import (
    create_access_token,
    create_opaque_refresh_token,
    create_pending_2fa_token,
    decode_token,
    generate_totp_secret,
    hash_token,
    verify_password,
    verify_totp,
)

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])

_REFRESH_COOKIE = "refresh_token"
_COOKIE_MAX_AGE = settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS * 86400
_REFRESH_TTL = settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS * 86400  # segundos
_bearer = HTTPBearer()


# ── Prefijos de clave Redis ───────────────────────────────────

def _redis_token_key(token_hash: str) -> str:
    return f"refresh_tokens:{token_hash}"

def _redis_user_set_key(user_id: str) -> str:
    return f"user_refresh_tokens:{user_id}"


# ── Helpers de cookie ─────────────────────────────────────────

def _set_refresh_cookie(response: Response, token: str) -> None:
    """Establece la cookie de refresh con todos los flags de seguridad requeridos."""
    response.set_cookie(
        key=_REFRESH_COOKIE,
        value=token,
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite="strict",
        max_age=_COOKIE_MAX_AGE,
        path="/",
    )


def _clear_refresh_cookie(response: Response) -> None:
    response.delete_cookie(
        key=_REFRESH_COOKIE,
        path="/",
        httponly=True,
        secure=settings.COOKIE_SECURE,
        samesite="strict",
    )


# ── Helper Redis: emitir refresh token ───────────────────────

async def _issue_refresh_token(redis: aioredis.Redis, user_id: UUID) -> str:
    """
    Genera un token opaco, guarda su hash en Redis y agrega el hash
    al set del usuario para permitir logout-all.
    """
    token = create_opaque_refresh_token()
    token_hash = hash_token(token)
    user_id_str = str(user_id)

    pipe = redis.pipeline()
    # Token hash → user_id (con TTL)
    pipe.set(_redis_token_key(token_hash), user_id_str, ex=_REFRESH_TTL)
    # Agregar hash al set del usuario
    pipe.sadd(_redis_user_set_key(user_id_str), token_hash)
    # El set del usuario expira 1 día después del último refresh token posible
    pipe.expire(_redis_user_set_key(user_id_str), _REFRESH_TTL + 86400)
    await pipe.execute()

    return token


async def _revoke_refresh_token(redis: aioredis.Redis, token: str, user_id_str: str) -> None:
    """Invalida un token opaco en Redis eliminando su hash."""
    token_hash = hash_token(token)
    pipe = redis.pipeline()
    pipe.delete(_redis_token_key(token_hash))
    pipe.srem(_redis_user_set_key(user_id_str), token_hash)
    await pipe.execute()


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

@router.get("/me", response_model=MeResponse)
async def me(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> MeResponse:
    """
    Retorna los datos del usuario autenticado.
    Descifra PII (full_name, email) con pgp_sym_decrypt.
    """
    row = (
        await db.execute(
            text("""
                SELECT
                    pgp_sym_decrypt(full_name::bytea, :key) AS full_name,
                    pgp_sym_decrypt(email::bytea,     :key) AS email
                FROM users
                WHERE id = :user_id
                  AND deleted_at IS NULL
            """),
            {"key": settings.CLINICAL_DB_PGCRYPTO_KEY, "user_id": str(current_user.id)},
        )
    ).fetchone()

    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuario no encontrado",
        )

    return MeResponse(
        data=MeData(
            id=current_user.id,
            email=row.email,
            full_name=row.full_name,
            role=current_user.role.value,
            is_active=current_user.is_active,
            has_2fa=current_user.totp_enabled,
            created_at=current_user.created_at,
        )
    )


@router.post("/login", response_model=LoginResponse)
@limiter.limit("5 per 15 minutes")
async def login(
    request: Request,
    body: LoginRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
    redis: aioredis.Redis = Depends(get_redis),
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
    refresh_token = await _issue_refresh_token(redis, user.id)
    _set_refresh_cookie(response, refresh_token)

    return LoginResponse(access_token=access_token)


@router.post("/refresh", response_model=RefreshResponse)
async def refresh(
    response: Response,
    db: AsyncSession = Depends(get_db),
    redis: aioredis.Redis = Depends(get_redis),
    refresh_token_cookie: str | None = Cookie(default=None, alias=_REFRESH_COOKIE),
) -> RefreshResponse:
    """Lee la cookie de refresh, valida contra Redis, rota y emite un nuevo access token."""
    _invalid = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Refresh token inválido o ausente",
    )

    if refresh_token_cookie is None:
        raise _invalid

    token_hash = hash_token(refresh_token_cookie)
    user_id_str: str | None = await redis.get(_redis_token_key(token_hash))

    if user_id_str is None:
        raise _invalid

    try:
        user_id = UUID(user_id_str)
    except ValueError:
        raise _invalid

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

    # Rotación: invalidar token anterior, emitir nuevo
    await _revoke_refresh_token(redis, refresh_token_cookie, user_id_str)
    new_access = create_access_token(user.id, user.role.value)
    new_refresh = await _issue_refresh_token(redis, user.id)
    _set_refresh_cookie(response, new_refresh)

    return RefreshResponse(access_token=new_access)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    response: Response,
    redis: aioredis.Redis = Depends(get_redis),
    current_user: User = Depends(get_current_user),
    refresh_token_cookie: str | None = Cookie(default=None, alias=_REFRESH_COOKIE),
) -> None:
    """Invalida el refresh token en Redis y elimina la cookie."""
    if refresh_token_cookie is not None:
        await _revoke_refresh_token(redis, refresh_token_cookie, str(current_user.id))
    _clear_refresh_cookie(response)


@router.post("/logout-all", status_code=status.HTTP_204_NO_CONTENT)
async def logout_all(
    response: Response,
    redis: aioredis.Redis = Depends(get_redis),
    current_user: User = Depends(get_current_user),
) -> None:
    """Invalida TODOS los refresh tokens del usuario en Redis y elimina la cookie."""
    user_set_key = _redis_user_set_key(str(current_user.id))
    all_hashes: set[str] = await redis.smembers(user_set_key)

    if all_hashes:
        pipe = redis.pipeline()
        for token_hash in all_hashes:
            pipe.delete(_redis_token_key(token_hash))
        pipe.delete(user_set_key)
        await pipe.execute()

    _clear_refresh_cookie(response)


@router.post("/2fa/verify", response_model=LoginResponse)
async def verify_2fa(
    body: TwoFactorRequest,
    response: Response,
    db: AsyncSession = Depends(get_db),
    redis: aioredis.Redis = Depends(get_redis),
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
    refresh_token = await _issue_refresh_token(redis, user.id)
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
