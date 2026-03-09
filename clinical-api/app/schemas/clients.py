"""
Schemas Pydantic para clientes (expedientes clínicos).

PII (full_name, email, phone) viaja en plaintext en la API;
el cifrado/descifrado con pgcrypto ocurre en la capa de routers.
"""
from datetime import date, datetime
from decimal import Decimal
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

from app.db.models import ConditionType, FamilyType, MaritalStatus, SleepQuality


# ── Sub-recursos ──────────────────────────────────────────────

class ClientConditionCreate(BaseModel):
    condition_type: ConditionType
    description: str = Field(..., min_length=1, max_length=2000)


class ClientConditionResponse(BaseModel):
    id: UUID
    client_id: UUID
    condition_type: ConditionType
    description: str
    created_at: datetime
    deleted_at: datetime | None = None

    model_config = {"from_attributes": True}


class ClientMedicationCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    notes: str | None = None


class ClientMedicationResponse(BaseModel):
    id: UUID
    client_id: UUID
    name: str
    notes: str | None = None
    created_at: datetime
    deleted_at: datetime | None = None

    model_config = {"from_attributes": True}


class ClientSleepUpsert(BaseModel):
    avg_hours: int | None = Field(None, ge=0, le=24)
    quality: SleepQuality | None = None


class ClientSleepResponse(BaseModel):
    id: UUID
    client_id: UUID
    avg_hours: int | None = None
    quality: SleepQuality | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class FamilyMemberCreate(BaseModel):
    family_type: FamilyType
    description: str = Field(..., min_length=1, max_length=2000)


class FamilyMemberResponse(BaseModel):
    id: UUID
    client_id: UUID
    family_type: FamilyType
    description: str
    created_at: datetime
    deleted_at: datetime | None = None

    model_config = {"from_attributes": True}


# ── Cliente principal ─────────────────────────────────────────

class ClientCreate(BaseModel):
    # PII — llega en plaintext, se cifra en el router con pgcrypto
    full_name: str = Field(..., min_length=1, max_length=300)
    email: str | None = Field(None, max_length=254)
    phone: str | None = Field(None, max_length=20)

    # Datos demográficos
    birth_date: date | None = None
    birth_place: str | None = Field(None, max_length=120)
    residence_place: str | None = Field(None, max_length=120)
    marital_status: MaritalStatus | None = None
    profession: str | None = Field(None, max_length=120)

    # Campos de intake (auditoría 2026-03-03)
    num_children: int | None = Field(None, ge=0, le=30)
    num_siblings: int | None = Field(None, ge=0, le=30)
    birth_order: int | None = Field(None, ge=1, le=30)
    predominant_emotions: dict[str, Any] | None = None
    family_abortions: int | None = Field(None, ge=0)
    deaths_before_41: str | None = None
    important_notes: str | None = None

    # Motivación de consulta
    motivation_visit: dict[str, Any] | None = None
    motivation_general: str | None = None

    # Sub-recursos opcionales en creación (conditions incluye dolores con condition_type=pain)
    conditions: list[ClientConditionCreate] = Field(default_factory=list)
    medications: list[ClientMedicationCreate] = Field(default_factory=list)
    sleep: ClientSleepUpsert | None = None
    family_members: list[FamilyMemberCreate] = Field(default_factory=list)

    @field_validator("phone")
    @classmethod
    def normalize_phone(cls, v: str | None) -> str | None:
        if v is None:
            return None
        digits = "".join(c for c in v if c.isdigit())
        if len(digits) == 10:
            return f"+52{digits}"
        return v


class ClientUpdate(BaseModel):
    """Todos los campos opcionales — semántica PATCH (exclude_unset)."""

    # PII
    full_name: str | None = Field(None, min_length=1, max_length=300)
    email: str | None = Field(None, max_length=254)
    phone: str | None = Field(None, max_length=20)

    # Demográficos
    birth_date: date | None = None
    birth_place: str | None = Field(None, max_length=120)
    residence_place: str | None = Field(None, max_length=120)
    marital_status: MaritalStatus | None = None
    profession: str | None = Field(None, max_length=120)

    # Intake
    num_children: int | None = Field(None, ge=0, le=30)
    num_siblings: int | None = Field(None, ge=0, le=30)
    birth_order: int | None = Field(None, ge=1, le=30)
    predominant_emotions: dict[str, Any] | None = None
    family_abortions: int | None = Field(None, ge=0)
    deaths_before_41: str | None = None
    important_notes: str | None = None

    # Motivación
    motivation_visit: dict[str, Any] | None = None
    motivation_general: str | None = None

    # Soft delete: enviar timestamp para marcar como eliminado, null para restaurar
    deleted_at: datetime | None = None

    @field_validator("phone")
    @classmethod
    def normalize_phone(cls, v: str | None) -> str | None:
        if v is None:
            return None
        digits = "".join(c for c in v if c.isdigit())
        if len(digits) == 10:
            return f"+52{digits}"
        return v


class ClientResponse(BaseModel):
    id: UUID

    # PII descifrado
    full_name: str
    email: str | None = None
    phone: str | None = None

    # Demográficos
    birth_date: date | None = None
    birth_place: str | None = None
    residence_place: str | None = None
    marital_status: MaritalStatus | None = None
    profession: str | None = None

    # Intake
    num_children: int | None = None
    num_siblings: int | None = None
    birth_order: int | None = None
    predominant_emotions: dict[str, Any] | None = None
    family_abortions: int | None = None
    deaths_before_41: str | None = None
    important_notes: str | None = None

    # Motivación
    motivation_visit: dict[str, Any] | None = None
    motivation_general: str | None = None

    # Timestamps
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None = None

    # Sub-recursos expandidos
    # conditions: médicas y recurrentes; pains: dolores (condition_type=pain)
    conditions: list[ClientConditionResponse] = []
    pains: list[ClientConditionResponse] = []
    medications: list[ClientMedicationResponse] = []
    sleep: ClientSleepResponse | None = None
    family_members: list[FamilyMemberResponse] = []


class ClientListItem(BaseModel):
    """Vista reducida para listados — sin sub-recursos ni PII completa."""

    id: UUID
    full_name: str
    email: str | None = None
    phone: str | None = None
    birth_date: date | None = None
    profession: str | None = None
    created_at: datetime
    deleted_at: datetime | None = None


class ClientListResponse(BaseModel):
    items: list[ClientListItem]
    total: int
    page: int
    per_page: int
    pages: int


# ── Sesiones del cliente ───────────────────────────────────────

class ClientSessionItem(BaseModel):
    """Resumen de sesión para el listado de sesiones de un cliente."""

    id: UUID
    measured_at: datetime
    therapy_type_name: str | None = None
    cost: Decimal | None = None
    notes: str | None = None           # payment_notes truncado a 100 chars
    general_energy_level: int | None = None


class ClientSessionsResponse(BaseModel):
    data: list[ClientSessionItem]
    total: int
    page: int
    per_page: int
