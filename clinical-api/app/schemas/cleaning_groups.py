"""
Schemas Pydantic para grupos de limpieza y protecciones.
Formato alineado con el frontend StepCleaning.tsx (migración 0014-0015).
"""
from datetime import datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


# ══════════════════════════════════════════════════════════════
# LAYERS
# ══════════════════════════════════════════════════════════════

VALID_LAYER_TYPES = {
    "sin_capas", "capas", "capas_ocultas", "capas_invisibles",
    "candados", "candados_ocultos", "programaciones",
    "reprogramaciones_ocultas_invisibles",
}


class LayerEntry(BaseModel):
    type: str
    quantity: int = 0

    @field_validator("type")
    @classmethod
    def validate_layer_type(cls, v: str) -> str:
        if v not in VALID_LAYER_TYPES:
            raise ValueError(f"Tipo de capa inválido: {v}. Válidos: {sorted(VALID_LAYER_TYPES)}")
        return v


# ══════════════════════════════════════════════════════════════
# CLEANING EVENTS (nuevo formato frontend)
# ══════════════════════════════════════════════════════════════

class CleaningEventInput(BaseModel):
    """Evento de limpieza tal como lo envía el frontend."""
    name: str = ""
    value: Decimal | None = None
    unit: str = "numero"
    work_done: str = ""
    work_done_custom: str | None = None
    materials: list[str] = Field(default_factory=list)
    origins: list[str] = Field(default_factory=list)
    is_auto_injected: bool = False


class CleaningEventOutput(BaseModel):
    """Evento de limpieza tal como lo devuelve el backend."""
    id: UUID
    name: str = ""
    value: Decimal | None = None
    unit: str = "numero"
    work_done: str = ""
    work_done_custom: str | None = None
    materials: list[str] = []
    origins: list[str] = []
    is_auto_injected: bool = False

    model_config = {"from_attributes": True}


# ══════════════════════════════════════════════════════════════
# CLEANING GROUPS
# ══════════════════════════════════════════════════════════════

class CleaningGroupInput(BaseModel):
    """Grupo de limpieza tal como lo envía el frontend."""
    target_type: str = "paciente"
    target_name: str = ""
    family_member_id: UUID | None = None
    layers: list[LayerEntry] = Field(default_factory=list)
    events: list[CleaningEventInput] = Field(default_factory=list)
    cleanings_required: int = Field(0, ge=0)
    mesa_utilizada: list[str] = Field(default_factory=list)
    beneficios: str = ""
    is_charged: bool = True
    cost_per_cleaning: Decimal = Field(Decimal("1300.00"), ge=0)


class CleaningGroupsUpdate(BaseModel):
    groups: list[CleaningGroupInput] = Field(default_factory=list)


class CleaningGroupOutput(BaseModel):
    """Grupo de limpieza tal como lo devuelve el backend."""
    id: UUID
    target_type: str = "paciente"
    target_name: str = ""
    family_member_id: UUID | None = None
    layers: list[LayerEntry] = []
    events: list[CleaningEventOutput] = []
    cleanings_required: int = 0
    mesa_utilizada: list[str] = []
    beneficios: str = ""
    is_charged: bool = True
    cost_per_cleaning: Decimal = Decimal("1300.00")

    model_config = {"from_attributes": True}


class CleaningGroupsGetResponse(BaseModel):
    groups: list[CleaningGroupOutput]


# ══════════════════════════════════════════════════════════════
# PROTECTIONS (sin cambios)
# ══════════════════════════════════════════════════════════════

class ProtectionItem(BaseModel):
    recipient_type: Literal["patient", "family_member", "other"]
    recipient_name: str | None = Field(None, max_length=200)
    family_member_id: UUID | None = None
    quantity: int = Field(1, ge=1)
    cost_per_unit: Decimal = Field(Decimal("1200.00"), ge=0)


class ProtectionsUpdate(BaseModel):
    protections: list[ProtectionItem] = Field(default_factory=list)


class ProtectionResponse(BaseModel):
    id: UUID
    session_id: UUID
    recipient_type: str
    recipient_name: str | None = None
    family_member_id: UUID | None = None
    quantity: int
    cost_per_unit: Decimal | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class ProtectionsGetResponse(BaseModel):
    protections: list[ProtectionResponse]
