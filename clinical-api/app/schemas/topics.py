"""
Schemas Pydantic v2 para temas clínicos persistentes.

client_topics      — Temas por paciente (CRUD)
session_theme_entries — Bloqueos, resultantes y secundarios por sesión
chakra_organs      — Catálogo de órganos por chakra
"""
from datetime import datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field


# ── Tipos literales ────────────────────────────────────────────────────────────

EntryType = Literal["bloqueo_1", "bloqueo_2", "bloqueo_3", "resultante", "secundario"]


# ══════════════════════════════════════════════════════════════
# CLIENT TOPICS
# ══════════════════════════════════════════════════════════════

class ClientTopicCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=500)


class ClientTopicUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=500)
    progress_pct: int | None = Field(None, ge=0, le=100)
    is_completed: bool | None = None


class ClientTopicResponse(BaseModel):
    id: UUID
    client_id: UUID
    name: str
    progress_pct: int
    is_completed: bool
    completed_at: datetime | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ══════════════════════════════════════════════════════════════
# SESSION THEME ENTRIES
# ══════════════════════════════════════════════════════════════

class ThemeEntryItem(BaseModel):
    """Una fila de entrada dentro de un tema por sesión."""
    client_topic_id: UUID
    entry_type: EntryType

    chakra_position_id: UUID | None = None
    organ_name: str | None = Field(None, max_length=200)
    initial_energy: Decimal | None = Field(None, ge=0, le=100)
    final_energy: Decimal | None = Field(None, ge=0, le=100)

    # Edades — infancia
    childhood_place: str | None = None
    childhood_people: str | None = None
    childhood_situation: str | None = None
    childhood_description: str | None = None
    childhood_emotions: str | None = None

    # Edades — adultez
    adulthood_place: str | None = None
    adulthood_people: str | None = None
    adulthood_situation: str | None = None
    adulthood_description: str | None = None
    adulthood_emotions: str | None = None


class TopicProgressUpdate(BaseModel):
    """Actualización de progreso de un tema al guardar la sesión."""
    client_topic_id: UUID
    progress_pct: int = Field(..., ge=0, le=100)


class ThemeEntriesPut(BaseModel):
    """Payload para PUT /sessions/{id}/theme-entries."""
    entries: list[ThemeEntryItem] = Field(..., min_length=1)
    topic_progress: list[TopicProgressUpdate] = Field(default_factory=list)


class ThemeEntryResponse(BaseModel):
    id: UUID
    session_id: UUID
    client_topic_id: UUID
    entry_type: str

    chakra_position_id: UUID | None = None
    organ_name: str | None = None
    initial_energy: Decimal | None = None
    final_energy: Decimal | None = None

    childhood_place: str | None = None
    childhood_people: str | None = None
    childhood_situation: str | None = None
    childhood_description: str | None = None
    childhood_emotions: str | None = None

    adulthood_place: str | None = None
    adulthood_people: str | None = None
    adulthood_situation: str | None = None
    adulthood_description: str | None = None
    adulthood_emotions: str | None = None

    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ThemeEntriesPutResponse(BaseModel):
    entries: list[ThemeEntryResponse]
    topics_updated: list[ClientTopicResponse]


# ══════════════════════════════════════════════════════════════
# CATÁLOGO CHAKRA ORGANS
# ══════════════════════════════════════════════════════════════

class ChakraOrganResponse(BaseModel):
    id: UUID
    chakra_position_id: UUID
    organ_name: str
    system_name: str | None = None

    model_config = {"from_attributes": True}


# ══════════════════════════════════════════════════════════════
# VISTA ESTADÍSTICAS DE TEMA
# ══════════════════════════════════════════════════════════════

class OrganWorkedItem(BaseModel):
    organ_name: str
    initial_energy: Decimal | None = None
    final_energy: Decimal | None = None
    session_date: datetime


class ChakraInvolvedItem(BaseModel):
    chakra_name: str
    count: int


class TopicStatsResponse(BaseModel):
    topic: ClientTopicResponse
    sessions_count: int
    organs_worked: list[OrganWorkedItem]
    chakras_involved: list[ChakraInvolvedItem]
