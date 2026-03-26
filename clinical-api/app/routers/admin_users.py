"""
Router de administración de usuarios.

Solo accesible por rol admin.
PII (full_name, email) cifrado con pgcrypto.
Passwords con bcrypt cost 12.
"""
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import LargeBinary, cast, func, select, text, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db.models import AuditAction, User, UserRole
from app.db.session import get_db
from app.dependencies import require_role
from app.schemas.admin_users import (
    MessageResponse,
    UserCreateRequest,
    UserCreateResponse,
    UserItem,
    UserListResponse,
    UserPasswordReset,
    UserUpdateRequest,
    UserUpdateResponse,
    role_from_db,
    role_to_db,
)
from app.security import hash_password
from app.utils.audit import write_audit_log

router = APIRouter(prefix="/api/v1/admin/users", tags=["Admin - Usuarios"])


# ── Helpers PII ────────────────────────────────────────────

def _enc(value: str | None, key: str):
    if value is None:
        return None
    return func.pgp_sym_encrypt(value, key)


def _dec(column, key: str):
    return func.pgp_sym_decrypt(cast(column, LargeBinary), key)


# ── 1. GET — Listar usuarios ──────────────────────────────

@router.get(
    "",
    response_model=UserListResponse,
    summary="Lista todos los usuarios",
)
async def list_users(
    _admin: User = Depends(require_role(UserRole.admin)),
    db: AsyncSession = Depends(get_db),
) -> UserListResponse:
    key = settings.CLINICAL_DB_PGCRYPTO_KEY

    rows = (
        await db.execute(
            select(
                User.id,
                _dec(User.full_name, key).label("full_name"),
                _dec(User.email, key).label("email"),
                User.role,
                User.is_active,
                User.totp_enabled,
                User.created_at,
            ).where(User.deleted_at.is_(None))
            .order_by(User.created_at)
        )
    ).all()

    return UserListResponse(
        data=[
            UserItem(
                id=r.id,
                full_name=r.full_name,
                email=r.email,
                role=role_from_db(r.role.value if hasattr(r.role, "value") else r.role),
                is_active=r.is_active,
                totp_enabled=r.totp_enabled,
                created_at=r.created_at,
            )
            for r in rows
        ]
    )


# ── 2. POST — Crear usuario ───────────────────────────────

@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    response_model=UserCreateResponse,
    summary="Crea un usuario nuevo",
)
async def create_user(
    data: UserCreateRequest,
    request: Request,
    admin: User = Depends(require_role(UserRole.admin)),
    db: AsyncSession = Depends(get_db),
) -> UserCreateResponse:
    key = settings.CLINICAL_DB_PGCRYPTO_KEY

    # Verificar email duplicado
    existing = (
        await db.execute(
            text("""
                SELECT id FROM users
                WHERE pgp_sym_decrypt(email::bytea, :key) = :email
                  AND deleted_at IS NULL
                LIMIT 1
            """),
            {"key": key, "email": data.email},
        )
    ).fetchone()

    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"code": "CONFLICT", "message": "Este correo ya está registrado"},
        )

    db_role = UserRole(role_to_db(data.role))

    new_user = User(
        full_name=data.full_name,  # placeholder — se sobreescribe abajo
        email=data.email,
        hashed_password=hash_password(data.password),
        role=db_role,
    )
    db.add(new_user)
    await db.flush()

    # Cifrar PII con pgcrypto (UPDATE después del INSERT para usar func)
    await db.execute(
        update(User)
        .where(User.id == new_user.id)
        .values(
            full_name=_enc(data.full_name, key),
            email=_enc(data.email, key),
        )
    )

    await write_audit_log(
        db,
        table_name="users",
        record_id=new_user.id,
        action=AuditAction.INSERT,
        changed_by=admin.id,
        new_data={"id": str(new_user.id), "role": data.role},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )

    await db.commit()

    return UserCreateResponse(
        data=UserItem(
            id=new_user.id,
            full_name=data.full_name,
            email=data.email,
            role=data.role,
            is_active=True,
            totp_enabled=False,
            created_at=new_user.created_at,
        )
    )


# ── 3. PATCH — Actualizar usuario ─────────────────────────

@router.patch(
    "/{user_id}",
    response_model=UserUpdateResponse,
    summary="Actualiza un usuario",
)
async def update_user(
    user_id: UUID,
    data: UserUpdateRequest,
    request: Request,
    admin: User = Depends(require_role(UserRole.admin)),
    db: AsyncSession = Depends(get_db),
) -> UserUpdateResponse:
    key = settings.CLINICAL_DB_PGCRYPTO_KEY

    target = (
        await db.execute(
            select(User).where(User.id == user_id, User.deleted_at.is_(None))
        )
    ).scalar_one_or_none()

    if target is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuario no encontrado",
        )

    # No puede desactivarse a sí mismo
    if data.is_active is False and target.id == admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No puedes desactivarte a ti mismo",
        )

    values: dict = {}
    changes: dict = {}

    if data.full_name is not None:
        values["full_name"] = _enc(data.full_name, key)
        changes["full_name"] = "[UPDATED]"

    if data.email is not None:
        # Verificar email único
        dup = (
            await db.execute(
                text("""
                    SELECT id FROM users
                    WHERE pgp_sym_decrypt(email::bytea, :key) = :email
                      AND deleted_at IS NULL
                      AND id != :uid
                    LIMIT 1
                """),
                {"key": key, "email": data.email, "uid": str(user_id)},
            )
        ).fetchone()
        if dup is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={"code": "CONFLICT", "message": "Este correo ya está registrado"},
            )
        values["email"] = _enc(data.email, key)
        changes["email"] = "[UPDATED]"

    if data.role is not None:
        values["role"] = UserRole(role_to_db(data.role))
        changes["role"] = data.role

    if data.is_active is not None:
        values["is_active"] = data.is_active
        changes["is_active"] = data.is_active

    if not values:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se proporcionaron campos para actualizar",
        )

    await db.execute(update(User).where(User.id == user_id).values(**values))

    await write_audit_log(
        db,
        table_name="users",
        record_id=user_id,
        action=AuditAction.UPDATE,
        changed_by=admin.id,
        new_data=changes,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )

    await db.commit()

    # Leer usuario actualizado con PII descifrado
    row = (
        await db.execute(
            select(
                User.id,
                _dec(User.full_name, key).label("full_name"),
                _dec(User.email, key).label("email"),
                User.role,
                User.is_active,
                User.totp_enabled,
                User.created_at,
            ).where(User.id == user_id)
        )
    ).one()

    return UserUpdateResponse(
        data=UserItem(
            id=row.id,
            full_name=row.full_name,
            email=row.email,
            role=role_from_db(row.role.value if hasattr(row.role, "value") else row.role),
            is_active=row.is_active,
            totp_enabled=row.totp_enabled,
            created_at=row.created_at,
        )
    )


# ── 4. DELETE — Soft delete ────────────────────────────────

@router.delete(
    "/{user_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Elimina un usuario (soft delete)",
)
async def delete_user(
    user_id: UUID,
    request: Request,
    admin: User = Depends(require_role(UserRole.admin)),
    db: AsyncSession = Depends(get_db),
) -> None:
    if user_id == admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No puedes eliminarte a ti mismo",
        )

    target = (
        await db.execute(
            select(User).where(User.id == user_id, User.deleted_at.is_(None))
        )
    ).scalar_one_or_none()

    if target is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuario no encontrado",
        )

    await db.execute(
        update(User)
        .where(User.id == user_id)
        .values(deleted_at=func.now())
    )

    await write_audit_log(
        db,
        table_name="users",
        record_id=user_id,
        action=AuditAction.UPDATE,
        changed_by=admin.id,
        new_data={"deleted_at": "soft_delete"},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )

    await db.commit()


# ── 5. POST — Reset password ──────────────────────────────

@router.post(
    "/{user_id}/reset-password",
    response_model=MessageResponse,
    summary="Resetea la contraseña de un usuario",
)
async def reset_password(
    user_id: UUID,
    data: UserPasswordReset,
    request: Request,
    admin: User = Depends(require_role(UserRole.admin)),
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    target = (
        await db.execute(
            select(User).where(User.id == user_id, User.deleted_at.is_(None))
        )
    ).scalar_one_or_none()

    if target is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuario no encontrado",
        )

    await db.execute(
        update(User)
        .where(User.id == user_id)
        .values(hashed_password=hash_password(data.new_password))
    )

    await write_audit_log(
        db,
        table_name="users",
        record_id=user_id,
        action=AuditAction.UPDATE,
        changed_by=admin.id,
        new_data={"password": "[RESET]"},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )

    await db.commit()

    return MessageResponse(message="Contraseña actualizada")
