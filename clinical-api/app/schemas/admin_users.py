"""
Schemas Pydantic para gestión de usuarios (admin).

Solo accesible por administradores.
Mapeo: "sanador" (API/UI) ↔ "therapist" (DB enum).
"""
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field, field_validator


# ── Mapeo rol API ↔ DB ─────────────────────────────────────

_ROLE_TO_DB: dict[str, str] = {
    "admin": "admin",
    "sanador": "therapist",
}

_ROLE_FROM_DB: dict[str, str] = {v: k for k, v in _ROLE_TO_DB.items()}


def role_to_db(api_role: str) -> str:
    """Convierte rol de API (admin|sanador) a enum de BD (admin|therapist)."""
    return _ROLE_TO_DB[api_role]


def role_from_db(db_role: str) -> str:
    """Convierte enum de BD (admin|therapist) a rol de API (admin|sanador)."""
    return _ROLE_FROM_DB.get(db_role, db_role)


# ── Request schemas ────────────────────────────────────────

class UserCreateRequest(BaseModel):
    """Crear un usuario nuevo (admin o sanador)."""

    full_name: str = Field(..., min_length=1, max_length=300)
    email: EmailStr
    password: str = Field(..., min_length=12)
    role: str = Field(..., pattern=r"^(admin|sanador)$")


class UserUpdateRequest(BaseModel):
    """Actualizar usuario — todos los campos opcionales."""

    full_name: str | None = Field(None, min_length=1, max_length=300)
    email: EmailStr | None = None
    role: str | None = Field(None, pattern=r"^(admin|sanador)$")
    is_active: bool | None = None


class UserPasswordReset(BaseModel):
    """Reset de contraseña por admin."""

    new_password: str = Field(..., min_length=12)


# ── Response schemas ───────────────────────────────────────

class UserItem(BaseModel):
    """Representación de un usuario en lista y detalle."""

    id: UUID
    full_name: str
    email: str
    role: str
    is_active: bool
    totp_enabled: bool
    created_at: datetime


class UserListResponse(BaseModel):
    data: list[UserItem]


class UserCreateResponse(BaseModel):
    data: UserItem


class UserUpdateResponse(BaseModel):
    data: UserItem


class MessageResponse(BaseModel):
    message: str
