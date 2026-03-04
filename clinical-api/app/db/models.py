"""
Modelos SQLAlchemy 2.0 para clinical_db.

Columnas marcadas con  # PII  usan pgp_sym_encrypt/decrypt en queries.
Escala chakras: 0-14  (nativa Notion, no convertir a 0-100).
Escala energética: 0-100 decimal.
"""
from datetime import date, datetime
from decimal import Decimal
from enum import Enum as PyEnum
from typing import Any
from uuid import UUID

import sqlalchemy as sa
from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    SmallInteger,
    String,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, SoftDeleteMixin, TimestampMixin, UUIDPrimaryKeyMixin


# ── Enums Python (espejo de los tipos PostgreSQL) ─────────────

class UserRole(str, PyEnum):
    admin = "admin"
    therapist = "therapist"


class MaritalStatus(str, PyEnum):
    single = "single"
    married = "married"
    divorced = "divorced"
    widowed = "widowed"
    common_law = "common_law"
    other = "other"


class SleepQuality(str, PyEnum):
    good = "good"
    regular = "regular"
    bad = "bad"


class ConditionType(str, PyEnum):
    medical = "medical"
    recurring_disease = "recurring_disease"
    pain = "pain"


class FamilyType(str, PyEnum):
    nuclear = "nuclear"
    current = "current"


class AuditAction(str, PyEnum):
    INSERT = "INSERT"
    UPDATE = "UPDATE"
    DELETE = "DELETE"


class MigrationStatus(str, PyEnum):
    success = "success"
    error = "error"
    skipped = "skipped"


class CleaningMaterialType(str, PyEnum):
    crystal = "crystal"
    candle = "candle"


class OrganSourceType(str, PyEnum):
    spine = "spine"
    organ = "organ"


# ══════════════════════════════════════════════════════════════
# CATÁLOGOS
# ══════════════════════════════════════════════════════════════

class TherapyType(Base, UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin):
    """Catálogo de terapias aplicadas (Canalización, LNT, Mesa de Luz, etc.)."""
    __tablename__ = "therapy_types"

    name: Mapped[str] = mapped_column(String(120), nullable=False, unique=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    notion_page_id: Mapped[str | None] = mapped_column(String(100), nullable=True, unique=True)

    sessions: Mapped[list["Session"]] = relationship(back_populates="therapy_type")


class EnergyDimension(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """
    Dimensiones energéticas medidas por sesión.
    CSV Notion: Vibración, Masculina, Femenina, Física, Psíquica,
                Abundancia, Prosperidad, Relación c/Dinero, Polución (= 9 activas).
    Plan total: 13 dimensiones.
    """
    __tablename__ = "energy_dimensions"

    name: Mapped[str] = mapped_column(String(80), nullable=False, unique=True)
    display_order: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    readings: Mapped[list["SessionEnergyReading"]] = relationship(back_populates="dimension")


class ChakraPosition(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """
    Posiciones de chakra 1-7.
    1=Raíz, 2=Sacro, 3=Plexo Solar, 4=Corazón, 5=Garganta,
    6=Tercer Ojo, 7=Corona.
    """
    __tablename__ = "chakra_positions"

    position: Mapped[int] = mapped_column(SmallInteger, nullable=False, unique=True)
    name: Mapped[str] = mapped_column(String(60), nullable=False)
    color: Mapped[str | None] = mapped_column(String(40), nullable=True)

    chakra_readings: Mapped[list["SessionChakraReading"]] = relationship(back_populates="chakra")
    affectations: Mapped[list["SessionAffectation"]] = relationship(back_populates="chakra")


# ══════════════════════════════════════════════════════════════
# USUARIOS
# ══════════════════════════════════════════════════════════════

class User(Base, UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin):
    """Terapeutas y administradores del sistema."""
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(Text, nullable=False, unique=True)        # PII
    full_name: Mapped[str] = mapped_column(Text, nullable=False)                 # PII
    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole, name="user_role_enum"), nullable=False, default=UserRole.therapist
    )
    hashed_password: Mapped[str] = mapped_column(Text, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    sessions: Mapped[list["Session"]] = relationship(back_populates="therapist")
    audit_entries: Mapped[list["AuditLog"]] = relationship(back_populates="changed_by_user")


# ══════════════════════════════════════════════════════════════
# CLIENTES (EXPEDIENTES CLÍNICOS)
# ══════════════════════════════════════════════════════════════

class Client(Base, UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin):
    """
    Expediente clínico del cliente.
    Columnas PII cifradas con pgcrypto (pgp_sym_encrypt/decrypt) en queries.
    Retención mínima 5 años — NOM-004-SSA3-2012.
    """
    __tablename__ = "clients"

    # PII — cifrado pgcrypto
    full_name: Mapped[str] = mapped_column(Text, nullable=False)                 # PII
    email: Mapped[str | None] = mapped_column(Text, nullable=True)               # PII
    phone: Mapped[str | None] = mapped_column(Text, nullable=True)               # PII normalizado +52

    # Datos demográficos
    birth_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    birth_place: Mapped[str | None] = mapped_column(String(120), nullable=True)
    residence_place: Mapped[str | None] = mapped_column(String(120), nullable=True)
    marital_status: Mapped[MaritalStatus | None] = mapped_column(
        Enum(MaritalStatus, name="marital_status_enum"), nullable=True
    )
    profession: Mapped[str | None] = mapped_column(String(120), nullable=True)

    # Campos de intake — confirmados en auditoría 2026-03-03
    num_children: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    num_siblings: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    birth_order: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)   # "Número de hijo"
    predominant_emotions: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    family_abortions: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    deaths_before_41: Mapped[str | None] = mapped_column(Text, nullable=True)
    important_notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Motivación de consulta
    motivation_visit: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)   # array de texto libre
    motivation_general: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Trazabilidad de migración Notion
    notion_page_id: Mapped[str | None] = mapped_column(String(100), nullable=True, unique=True)
    migration_batch_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)

    # Relaciones
    sessions: Mapped[list["Session"]] = relationship(back_populates="client")
    conditions: Mapped[list["ClientCondition"]] = relationship(back_populates="client")
    medications: Mapped[list["ClientMedication"]] = relationship(back_populates="client")
    sleep_record: Mapped["ClientSleep | None"] = relationship(back_populates="client", uselist=False)
    family_members: Mapped[list["FamilyMember"]] = relationship(back_populates="client")
    cleaning_materials: Mapped[list["CleaningMaterial"]] = relationship(back_populates="client")

    __table_args__ = (
        Index("ix_clients_notion_page_id", "notion_page_id"),
        Index("ix_clients_migration_batch_id", "migration_batch_id"),
    )


class ClientCondition(Base, UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin):
    """Condiciones médicas, enfermedades recurrentes y dolores del cliente."""
    __tablename__ = "client_conditions"

    client_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("clients.id", ondelete="RESTRICT"), nullable=False
    )
    condition_type: Mapped[ConditionType] = mapped_column(
        Enum(ConditionType, name="condition_type_enum"), nullable=False
    )
    description: Mapped[str] = mapped_column(Text, nullable=False)

    client: Mapped["Client"] = relationship(back_populates="conditions")

    __table_args__ = (Index("ix_client_conditions_client_id", "client_id"),)


class ClientMedication(Base, UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin):
    """Medicamentos actuales del cliente."""
    __tablename__ = "client_medications"

    client_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("clients.id", ondelete="RESTRICT"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    client: Mapped["Client"] = relationship(back_populates="medications")

    __table_args__ = (Index("ix_client_medications_client_id", "client_id"),)


class ClientSleep(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """Hábitos de sueño del cliente (1:1 con clients)."""
    __tablename__ = "client_sleep"

    client_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("clients.id", ondelete="RESTRICT"), nullable=False, unique=True
    )
    avg_hours: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    quality: Mapped[SleepQuality | None] = mapped_column(
        Enum(SleepQuality, name="sleep_quality_enum"), nullable=True
    )

    client: Mapped["Client"] = relationship(back_populates="sleep_record")


class FamilyMember(Base, UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin):
    """Descripción de familia nuclear y actual."""
    __tablename__ = "family_members"

    client_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("clients.id", ondelete="RESTRICT"), nullable=False
    )
    family_type: Mapped[FamilyType] = mapped_column(
        Enum(FamilyType, name="family_type_enum"), nullable=False
    )
    description: Mapped[str] = mapped_column(Text, nullable=False)

    client: Mapped["Client"] = relationship(back_populates="family_members")

    __table_args__ = (Index("ix_family_members_client_id", "client_id"),)


# ══════════════════════════════════════════════════════════════
# SESIONES
# ══════════════════════════════════════════════════════════════

class Session(Base, UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin):
    """
    Sesión de medición energética.
    782 registros en CSV principal Notion (45 columnas).
    """
    __tablename__ = "sessions"

    client_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("clients.id", ondelete="RESTRICT"), nullable=True
        # nullable=True: 2 sesiones sin cliente en Notion (importar con null)
    )
    therapist_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    therapy_type_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("therapy_types.id", ondelete="SET NULL"), nullable=True
    )

    session_number: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)  # "Sesión 01" → 1
    measured_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    # Niveles energéticos generales
    general_energy_level: Mapped[int | None] = mapped_column(Integer, nullable=True)  # columna "General"

    # Costo de la sesión — confirmado en auditoría
    cost: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)

    # Campos de limpieza energética — confirmados en auditoría
    entities_count: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)   # 18 registros en CSV
    implants_count: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)   # 16 registros
    total_cleanings: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)  # 27-29 registros
    bud: Mapped[str | None] = mapped_column(String(200), nullable=True)               # 17 registros
    bud_chakra: Mapped[str | None] = mapped_column(String(200), nullable=True)        # 5 registros (animales)
    payment_notes: Mapped[str | None] = mapped_column(Text, nullable=True)            # 2 registros

    # Trazabilidad de migración Notion
    notion_page_id: Mapped[str | None] = mapped_column(String(100), nullable=True, unique=True)
    migration_batch_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)

    # Relaciones
    client: Mapped["Client | None"] = relationship(back_populates="sessions")
    therapist: Mapped["User | None"] = relationship(back_populates="sessions")
    therapy_type: Mapped["TherapyType | None"] = relationship(back_populates="sessions")
    energy_readings: Mapped[list["SessionEnergyReading"]] = relationship(back_populates="session")
    chakra_readings: Mapped[list["SessionChakraReading"]] = relationship(back_populates="session")
    affectations: Mapped[list["SessionAffectation"]] = relationship(back_populates="session")
    topics: Mapped[list["SessionTopic"]] = relationship(back_populates="session")
    lnt_entries: Mapped[list["SessionLnt"]] = relationship(back_populates="session")
    cleaning_events: Mapped[list["SessionCleaningEvent"]] = relationship(back_populates="session")
    organs: Mapped[list["SessionOrgan"]] = relationship(back_populates="session")
    cleaning_materials: Mapped[list["CleaningMaterial"]] = relationship(back_populates="session")

    __table_args__ = (
        Index("ix_sessions_client_id", "client_id"),
        Index("ix_sessions_measured_at", "measured_at"),
        Index("ix_sessions_notion_page_id", "notion_page_id"),
        Index("ix_sessions_migration_batch_id", "migration_batch_id"),
    )


class SessionEnergyReading(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """
    Lecturas energéticas por dimensión (inicial y final).
    Escala 0-100 decimal. ~9 dimensiones activas, 13 planeadas.
    """
    __tablename__ = "session_energy_readings"

    session_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False
    )
    dimension_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("energy_dimensions.id", ondelete="RESTRICT"), nullable=False
    )
    initial_value: Mapped[Decimal | None] = mapped_column(Numeric(6, 2), nullable=True)  # 0-100
    final_value: Mapped[Decimal | None] = mapped_column(Numeric(6, 2), nullable=True)    # 0-100, ~20% sesiones

    session: Mapped["Session"] = relationship(back_populates="energy_readings")
    dimension: Mapped["EnergyDimension"] = relationship(back_populates="readings")

    __table_args__ = (
        UniqueConstraint("session_id", "dimension_id", name="uq_energy_reading_session_dimension"),
        Index("ix_session_energy_readings_session_id", "session_id"),
    )


class SessionChakraReading(Base, UUIDPrimaryKeyMixin, TimestampMixin):
    """
    Lecturas de chakras por sesión (inicial y final).
    Escala 0-14 — nativa Notion. No convertir a 0-100.
    """
    __tablename__ = "session_chakra_readings"

    session_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False
    )
    chakra_position_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("chakra_positions.id", ondelete="RESTRICT"), nullable=False
    )
    initial_value: Mapped[Decimal | None] = mapped_column(Numeric(5, 2), nullable=True)  # 0-14
    final_value: Mapped[Decimal | None] = mapped_column(Numeric(5, 2), nullable=True)    # 0-14, ~20%

    session: Mapped["Session"] = relationship(back_populates="chakra_readings")
    chakra: Mapped["ChakraPosition"] = relationship(back_populates="chakra_readings")

    __table_args__ = (
        UniqueConstraint("session_id", "chakra_position_id", name="uq_chakra_reading_session_chakra"),
        Index("ix_session_chakra_readings_session_id", "session_id"),
    )


class SessionAffectation(Base, UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin):
    """
    Afectaciones detalladas por chakra (de sub-carpetas CSV).
    Columnas: ID, Edad Adulto, Edad Infancia, Energía Final/Inicial,
              Tema Adultez, Tema Infancia, Tipo de afectación, Órgano/Glándula.
    """
    __tablename__ = "session_affectations"

    session_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False
    )
    chakra_position_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("chakra_positions.id", ondelete="SET NULL"), nullable=True
    )
    organ_gland: Mapped[str | None] = mapped_column(String(200), nullable=True)
    affectation_type: Mapped[str | None] = mapped_column(String(200), nullable=True)
    initial_energy: Mapped[Decimal | None] = mapped_column(Numeric(5, 2), nullable=True)
    final_energy: Mapped[Decimal | None] = mapped_column(Numeric(5, 2), nullable=True)
    adult_age: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    child_age: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    adult_theme: Mapped[str | None] = mapped_column(Text, nullable=True)
    child_theme: Mapped[str | None] = mapped_column(Text, nullable=True)

    session: Mapped["Session"] = relationship(back_populates="affectations")
    chakra: Mapped["ChakraPosition | None"] = relationship(back_populates="affectations")

    __table_args__ = (Index("ix_session_affectations_session_id", "session_id"),)


class SessionTopic(Base, UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin):
    """
    Temas trabajados por sesión (chakra, columna vertebral u órgano).
    Consolida temas de adultez/infancia con edades y nivel energético.
    """
    __tablename__ = "session_topics"

    session_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False
    )
    source_type: Mapped[OrganSourceType] = mapped_column(
        Enum(OrganSourceType, name="organ_source_type_enum"), nullable=False
    )
    zone: Mapped[str | None] = mapped_column(String(100), nullable=True)          # zona columna vertebral
    adult_theme: Mapped[str | None] = mapped_column(Text, nullable=True)
    child_theme: Mapped[str | None] = mapped_column(Text, nullable=True)
    adult_age: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    child_age: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    emotions: Mapped[str | None] = mapped_column(Text, nullable=True)             # solo columna vertebral
    initial_energy: Mapped[Decimal | None] = mapped_column(Numeric(5, 2), nullable=True)
    final_energy: Mapped[Decimal | None] = mapped_column(Numeric(5, 2), nullable=True)

    session: Mapped["Session"] = relationship(back_populates="topics")

    __table_args__ = (Index("ix_session_topics_session_id", "session_id"),)


class SessionLnt(Base, UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin):
    """
    Entradas de Terapia LNT por sesión (193 sesiones la tienen).
    Columnas Notion: Tema/Órgano, N.E. Final, N.E. Inicial,
                     Sanación cuerpo energético/espiritual/físico.
    """
    __tablename__ = "session_lnt"

    session_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False
    )
    theme_organ: Mapped[str | None] = mapped_column(String(300), nullable=True)
    initial_energy: Mapped[Decimal | None] = mapped_column(Numeric(5, 2), nullable=True)
    final_energy: Mapped[Decimal | None] = mapped_column(Numeric(5, 2), nullable=True)
    healing_energy_body: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    healing_spiritual_body: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    healing_physical_body: Mapped[bool | None] = mapped_column(Boolean, nullable=True)

    session: Mapped["Session"] = relationship(back_populates="lnt_entries")

    __table_args__ = (Index("ix_session_lnt_session_id", "session_id"),)


class SessionCleaningEvent(Base, UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin):
    """
    Eventos de limpieza por capa (359 sesiones tienen este dato).
    Columnas Notion: Capa, Cantidad, Color de aura, Limpiezas requeridas,
    Manifestación, Materiales utilizados, Momento de creación, Nivel energético,
    Origen, Persona, Trabajos realizados, Área de vida.
    """
    __tablename__ = "session_cleaning_events"

    session_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False
    )
    layer: Mapped[str | None] = mapped_column(String(100), nullable=True)
    quantity: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    aura_color: Mapped[str | None] = mapped_column(String(60), nullable=True)
    cleanings_required: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    manifestation: Mapped[str | None] = mapped_column(Text, nullable=True)
    materials_used: Mapped[str | None] = mapped_column(Text, nullable=True)
    creation_moment: Mapped[str | None] = mapped_column(Text, nullable=True)
    energy_level: Mapped[Decimal | None] = mapped_column(Numeric(6, 2), nullable=True)
    origin: Mapped[str | None] = mapped_column(Text, nullable=True)
    person: Mapped[str | None] = mapped_column(String(200), nullable=True)
    work_done: Mapped[str | None] = mapped_column(Text, nullable=True)
    life_area: Mapped[str | None] = mapped_column(String(100), nullable=True)

    session: Mapped["Session"] = relationship(back_populates="cleaning_events")

    __table_args__ = (Index("ix_session_cleaning_events_session_id", "session_id"),)


class SessionOrgan(Base, UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin):
    """
    Órganos y columna vertebral por sesión.
    Consolida CSV 'Columna Vertebral' y 'Nivel energético de órgano'.
    ~383-387 sesiones tienen este dato.
    """
    __tablename__ = "session_organs"

    session_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False
    )
    source_type: Mapped[OrganSourceType] = mapped_column(
        Enum(OrganSourceType, name="organ_source_type_enum"), nullable=False
    )
    name: Mapped[str | None] = mapped_column(String(200), nullable=True)           # nombre órgano o zona
    initial_energy: Mapped[Decimal | None] = mapped_column(Numeric(5, 2), nullable=True)
    final_energy: Mapped[Decimal | None] = mapped_column(Numeric(5, 2), nullable=True)
    adult_age: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    child_age: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    adult_theme: Mapped[str | None] = mapped_column(Text, nullable=True)
    child_theme: Mapped[str | None] = mapped_column(Text, nullable=True)
    emotions: Mapped[str | None] = mapped_column(Text, nullable=True)

    session: Mapped["Session"] = relationship(back_populates="organs")

    __table_args__ = (Index("ix_session_organs_session_id", "session_id"),)


# ══════════════════════════════════════════════════════════════
# MATERIALES DE LIMPIEZA  (nueva tabla — auditoría 2026-03-03)
# ══════════════════════════════════════════════════════════════

class CleaningMaterial(Base, UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin):
    """
    Cuarzos y velas usados en mesa de luz y limpiezas (47 clientes con sub-carpetas).
    material_type: crystal (cuarzo) | candle (vela: Coco, Blanca, Miel).
    symbols: JSONB — array de símbolos para velas.
    """
    __tablename__ = "cleaning_materials"

    client_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("clients.id", ondelete="RESTRICT"), nullable=True
    )
    session_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("sessions.id", ondelete="SET NULL"), nullable=True
    )
    material_type: Mapped[CleaningMaterialType] = mapped_column(
        Enum(CleaningMaterialType, name="cleaning_material_type_enum"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)        # tipo cuarzo o vela
    size: Mapped[str | None] = mapped_column(String(60), nullable=True)   # solo cuarzos
    quantity: Mapped[int | None] = mapped_column(SmallInteger, nullable=True)
    symbols: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)    # solo velas

    client: Mapped["Client | None"] = relationship(back_populates="cleaning_materials")
    session: Mapped["Session | None"] = relationship(back_populates="cleaning_materials")

    __table_args__ = (
        Index("ix_cleaning_materials_client_id", "client_id"),
        Index("ix_cleaning_materials_session_id", "session_id"),
    )


# ══════════════════════════════════════════════════════════════
# AUDITORÍA Y TRAZABILIDAD
# ══════════════════════════════════════════════════════════════

class AuditLog(Base, UUIDPrimaryKeyMixin):
    """
    Log de auditoría INSERT-only — nunca UPDATE ni DELETE.
    Revoca UPDATE/DELETE al usuario de app en init-audit.sql.
    """
    __tablename__ = "audit_log"

    table_name: Mapped[str] = mapped_column(String(80), nullable=False)
    record_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), nullable=False)
    action: Mapped[AuditAction] = mapped_column(
        Enum(AuditAction, name="audit_action_enum"), nullable=False
    )
    changed_by: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    changed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    old_data: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    new_data: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(Text, nullable=True)

    changed_by_user: Mapped["User | None"] = relationship(back_populates="audit_entries")

    __table_args__ = (
        Index("ix_audit_log_table_record", "table_name", "record_id"),
        Index("ix_audit_log_changed_at", "changed_at"),
    )


class MigrationLog(Base, UUIDPrimaryKeyMixin):
    """
    Trazabilidad de los scripts de migración Notion → SDC.
    Permite rollback por batch_id.
    """
    __tablename__ = "migration_log"

    batch_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), nullable=False)
    script_name: Mapped[str] = mapped_column(String(100), nullable=False)
    source: Mapped[str] = mapped_column(String(60), nullable=False, default="notion_export")
    notion_page_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    target_table: Mapped[str] = mapped_column(String(80), nullable=False)
    target_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), nullable=True)
    status: Mapped[MigrationStatus] = mapped_column(
        Enum(MigrationStatus, name="migration_status_enum"), nullable=False
    )
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    __table_args__ = (
        Index("ix_migration_log_batch_id", "batch_id"),
        Index("ix_migration_log_notion_page_id", "notion_page_id"),
        Index("ix_migration_log_target_table", "target_table"),
    )
