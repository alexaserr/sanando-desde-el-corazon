"""
Schemas Pydantic para sesiones clínicas y wizard de captura de 7 pasos.

Escalas:
  - Dimensiones energéticas: 0-100 (decimal)
  - Chakras: 0-14 (escala nativa Notion, no convertir a 0-100)
  - LNT initial/final energy: 0-14 (escala nativa Notion)
"""
from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, Field

from app.db.models import OrganSourceType
from app.schemas.ancestors import AncestorConciliationResponse, AncestorResponse


# ── Lecturas energéticas ──────────────────────────────────────

class EnergyReadingItem(BaseModel):
    dimension_id: UUID
    value: Decimal = Field(..., ge=0, le=100)


class EnergyReadingsUpdate(BaseModel):
    """Pasos 2 (initial) y 5 (final) del wizard. La fase se determina por la URL."""
    readings: list[EnergyReadingItem] = Field(..., min_length=1)


class EnergyReadingResponse(BaseModel):
    id: UUID
    dimension_id: UUID
    dimension_name: str
    initial_value: Decimal | None = None
    final_value: Decimal | None = None

    model_config = {"from_attributes": True}


# ── Lecturas de chakras ───────────────────────────────────────

class ChakraReadingItem(BaseModel):
    chakra_position_id: UUID
    value: Decimal = Field(..., ge=0, le=14)


class ChakraReadingsUpdate(BaseModel):
    """Pasos 3 (initial) y 6 (final) del wizard. La fase se determina por la URL."""
    readings: list[ChakraReadingItem] = Field(..., min_length=1)


class ChakraReadingResponse(BaseModel):
    id: UUID
    chakra_position_id: UUID
    chakra_name: str
    chakra_position: int
    initial_value: Decimal | None = None
    final_value: Decimal | None = None

    model_config = {"from_attributes": True}


# ── Temas trabajados ──────────────────────────────────────────

class TopicItem(BaseModel):
    source_type: OrganSourceType
    zone: str | None = Field(None, max_length=100)
    adult_theme: str | None = None
    child_theme: str | None = None
    adult_age: int | None = Field(None, ge=0, le=120)
    child_age: int | None = Field(None, ge=0, le=18)
    emotions: str | None = None
    initial_energy: Decimal | None = Field(None, ge=0, le=100)
    final_energy: Decimal | None = Field(None, ge=0, le=100)


class TopicsUpdate(BaseModel):
    """Paso 4 del wizard."""
    topics: list[TopicItem] = Field(..., min_length=1)


class TopicResponse(BaseModel):
    id: UUID
    source_type: OrganSourceType
    zone: str | None = None
    adult_theme: str | None = None
    child_theme: str | None = None
    adult_age: int | None = None
    child_age: int | None = None
    emotions: str | None = None
    initial_energy: Decimal | None = None
    final_energy: Decimal | None = None
    deleted_at: datetime | None = None

    model_config = {"from_attributes": True}


# ── LNT ───────────────────────────────────────────────────────

class LNTItem(BaseModel):
    theme_organ: str | None = Field(None, max_length=300)
    initial_energy: Decimal | None = Field(None, ge=0, le=14)
    final_energy: Decimal | None = Field(None, ge=0, le=14)
    healing_energy_body: bool | None = None
    healing_spiritual_body: bool | None = None
    healing_physical_body: bool | None = None


class LNTUpdate(BaseModel):
    entries: list[LNTItem] = Field(default_factory=list)
    peticiones: str | None = None  # nivel sesión — se almacena en la primera entrada


class LNTResponse(BaseModel):
    id: UUID
    theme_organ: str | None = None
    initial_energy: Decimal | None = None
    final_energy: Decimal | None = None
    healing_energy_body: bool | None = None
    healing_spiritual_body: bool | None = None
    healing_physical_body: bool | None = None
    peticiones: str | None = None
    deleted_at: datetime | None = None

    model_config = {"from_attributes": True}


class LNTGetResponse(BaseModel):
    entries: list[LNTResponse]
    peticiones: str | None = None


# ── Eventos de limpieza ───────────────────────────────────────

class CleaningEventItem(BaseModel):
    layer: str | None = Field(None, max_length=100)
    quantity: int | None = Field(None, ge=0)
    aura_color: str | None = Field(None, max_length=60)
    cleanings_required: int | None = Field(None, ge=0)
    manifestation: str | None = None
    materials_used: str | None = None
    creation_moment: str | None = None
    energy_level: Decimal | None = Field(None, ge=0, le=100)
    origin: str | None = None
    person: str | None = Field(None, max_length=200)
    work_done: str | None = None
    life_area: str | None = Field(None, max_length=100)


class CleaningEventsUpdate(BaseModel):
    events: list[CleaningEventItem] = Field(..., min_length=1)


class CleaningEventResponse(BaseModel):
    id: UUID
    layer: str | None = None
    quantity: int | None = None
    aura_color: str | None = None
    cleanings_required: int | None = None
    manifestation: str | None = None
    materials_used: str | None = None
    creation_moment: str | None = None
    energy_level: Decimal | None = None
    origin: str | None = None
    person: str | None = None
    work_done: str | None = None
    life_area: str | None = None
    deleted_at: datetime | None = None

    model_config = {"from_attributes": True}


# ── Limpiezas con resumen de sesión ──────────────────────────

class CleaningsUpdate(BaseModel):
    """PUT /sessions/{id}/cleanings — eventos + campos resumen nivel sesión."""
    events: list[CleaningEventItem] = Field(default_factory=list)
    capas: int | None = Field(None, ge=0)
    limpiezas_requeridas: int | None = Field(None, ge=0)
    mesa_utilizada: str | None = None
    beneficios: str | None = None


class CleaningsGetResponse(BaseModel):
    events: list[CleaningEventResponse]
    capas: int | None = None
    limpiezas_requeridas: int | None = None
    mesa_utilizada: str | None = None
    beneficios: str | None = None


# ── Afectaciones por chakra ───────────────────────────────────

class AffectationItem(BaseModel):
    chakra_position_id: UUID | None = None
    organ_gland: str | None = Field(None, max_length=200)
    affectation_type: str | None = Field(None, max_length=200)
    initial_energy: Decimal | None = Field(None, ge=0, le=100)
    final_energy: Decimal | None = Field(None, ge=0, le=100)
    adult_age: int | None = Field(None, ge=0, le=120)
    child_age: int | None = Field(None, ge=0, le=18)
    adult_theme: str | None = None
    child_theme: str | None = None


class AffectationsUpdate(BaseModel):
    affectations: list[AffectationItem] = Field(..., min_length=1)


class AffectationResponse(BaseModel):
    id: UUID
    chakra_position_id: UUID | None = None
    organ_gland: str | None = None
    affectation_type: str | None = None
    initial_energy: Decimal | None = None
    final_energy: Decimal | None = None
    adult_age: int | None = None
    child_age: int | None = None
    adult_theme: str | None = None
    child_theme: str | None = None
    deleted_at: datetime | None = None

    model_config = {"from_attributes": True}


# ── Órganos / columna vertebral ───────────────────────────────

class OrganItem(BaseModel):
    source_type: OrganSourceType
    name: str | None = Field(None, max_length=200)
    initial_energy: Decimal | None = Field(None, ge=0, le=100)
    final_energy: Decimal | None = Field(None, ge=0, le=100)
    adult_age: int | None = Field(None, ge=0, le=120)
    child_age: int | None = Field(None, ge=0, le=18)
    adult_theme: str | None = None
    child_theme: str | None = None
    emotions: str | None = None


class OrgansUpdate(BaseModel):
    organs: list[OrganItem] = Field(..., min_length=1)


class OrganResponse(BaseModel):
    id: UUID
    source_type: OrganSourceType
    name: str | None = None
    initial_energy: Decimal | None = None
    final_energy: Decimal | None = None
    adult_age: int | None = None
    child_age: int | None = None
    adult_theme: str | None = None
    child_theme: str | None = None
    emotions: str | None = None
    deleted_at: datetime | None = None

    model_config = {"from_attributes": True}


# ── Sesión principal ──────────────────────────────────────────

class SessionCreate(BaseModel):
    client_id: UUID | None = None
    therapy_type_id: UUID | None = None
    measured_at: datetime
    session_number: int | None = Field(None, ge=1)


class SessionGeneralUpdate(BaseModel):
    """Paso 1 del wizard — datos generales de la sesión."""
    therapy_type_id: UUID | None = None
    measured_at: datetime | None = None
    session_number: int | None = Field(None, ge=1)
    general_energy_level: int | None = Field(None, ge=0, le=100)
    cost: Decimal | None = Field(None, ge=0)
    entities_count: int | None = Field(None, ge=0)
    implants_count: int | None = Field(None, ge=0)
    total_cleanings: int | None = Field(None, ge=0)
    bud: str | None = Field(None, max_length=200)
    bud_chakra: str | None = Field(None, max_length=200)
    payment_notes: str | None = None
    notes: str | None = None  # PII — se cifra con pgp_sym_encrypt al escribir
    porcentaje_pago: Decimal | None = Field(None, ge=0, le=100)
    incluye_iva: bool | None = None
    costo_calculado: Decimal | None = Field(None, ge=0)


class SessionCloseRequest(BaseModel):
    """Paso 7 — cierre y confirmación de pago."""
    cost: Decimal | None = Field(None, ge=0)
    payment_notes: str | None = None
    porcentaje_pago: Decimal | None = Field(None, ge=0, le=100)
    incluye_iva: bool | None = None
    costo_calculado: Decimal | None = Field(None, ge=0)


class SessionResponse(BaseModel):
    id: UUID
    client_id: UUID | None = None
    therapist_id: UUID | None = None
    therapy_type_id: UUID | None = None
    therapy_type_name: str | None = None
    session_number: int | None = None
    measured_at: datetime
    general_energy_level: int | None = None
    cost: Decimal | None = None
    entities_count: int | None = None
    implants_count: int | None = None
    total_cleanings: int | None = None
    bud: str | None = None
    bud_chakra: str | None = None
    payment_notes: str | None = None
    notes: str | None = None  # PII — descifrado en router
    # Resumen de limpiezas
    capas: int | None = None
    limpiezas_requeridas: int | None = None
    mesa_utilizada: str | None = None
    beneficios: str | None = None
    porcentaje_pago: Decimal | None = None
    incluye_iva: bool | None = None
    costo_calculado: Decimal | None = None
    created_at: datetime
    updated_at: datetime
    deleted_at: datetime | None = None

    # Sub-datos expandidos
    energy_readings: list[EnergyReadingResponse] = []
    chakra_readings: list[ChakraReadingResponse] = []
    topics: list[TopicResponse] = []
    lnt_entries: list[LNTResponse] = []
    cleaning_events: list[CleaningEventResponse] = []
    affectations: list[AffectationResponse] = []
    organs: list[OrganResponse] = []
    ancestors: list[AncestorResponse] = []
    ancestor_conciliation: AncestorConciliationResponse | None = None

    model_config = {"from_attributes": True}


# ── Lista global de sesiones ──────────────────────────────────

class SessionListItem(BaseModel):
    id: UUID
    client_id: UUID | None = None
    client_name: str | None = None
    therapy_type_name: str | None = None
    measured_at: datetime
    general_energy_level: int | None = None
    cost: Decimal | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class SessionListResponse(BaseModel):
    data: list[SessionListItem]
    total: int
    page: int
    per_page: int


class WizardStepResponse(BaseModel):
    """Estado del wizard de captura de sesión tras cada paso."""
    session_id: UUID
    current_step: int
    completed_steps: list[int]
    has_energy_initial: bool
    has_chakra_initial: bool
    has_topics: bool
    has_energy_final: bool
    has_chakra_final: bool
    has_lnt: bool
    has_cleaning_events: bool
    has_affectations: bool
    is_closed: bool
