"""Initial schema — clinical_db

Crea extensiones, tipos enum, catálogos, tablas clínicas,
materiales de limpieza, audit_log y migration_log.

Campos nuevos incluidos (auditoría 2026-03-03):
  - sessions.cost, entities_count, implants_count, total_cleanings, bud, bud_chakra
  - clients.num_children, num_siblings, birth_order, predominant_emotions,
    family_abortions, deaths_before_41, important_notes
  - tabla cleaning_materials (cuarzos y velas)
  - notion_page_id + migration_batch_id en clients y sessions

Revision ID: 0001
Revises:
Create Date: 2026-03-03
"""

from collections.abc import Sequence
from typing import Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:

    # ── Extensiones ───────────────────────────────────────────
    op.execute('CREATE EXTENSION IF NOT EXISTS "pgcrypto"')
    op.execute('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"')

    # ── Tipos enum ────────────────────────────────────────────
    op.execute("""
        CREATE TYPE user_role_enum AS ENUM ('admin', 'therapist')
    """)
    op.execute("""
        CREATE TYPE marital_status_enum AS ENUM (
            'single', 'married', 'divorced', 'widowed', 'common_law', 'other'
        )
    """)
    op.execute("""
        CREATE TYPE sleep_quality_enum AS ENUM ('good', 'regular', 'bad')
    """)
    op.execute("""
        CREATE TYPE condition_type_enum AS ENUM (
            'medical', 'recurring_disease', 'pain'
        )
    """)
    op.execute("""
        CREATE TYPE family_type_enum AS ENUM ('nuclear', 'current')
    """)
    op.execute("""
        CREATE TYPE audit_action_enum AS ENUM ('INSERT', 'UPDATE', 'DELETE')
    """)
    op.execute("""
        CREATE TYPE migration_status_enum AS ENUM ('success', 'error', 'skipped')
    """)
    op.execute("""
        CREATE TYPE cleaning_material_type_enum AS ENUM ('crystal', 'candle')
    """)
    op.execute("""
        CREATE TYPE organ_source_type_enum AS ENUM ('spine', 'organ')
    """)

    # ════════════════════════════════════════════════════════
    # CATÁLOGOS
    # ════════════════════════════════════════════════════════

    op.create_table(
        "therapy_types",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("notion_page_id", sa.String(100), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("name", name="uq_therapy_types_name"),
        sa.UniqueConstraint("notion_page_id", name="uq_therapy_types_notion_page_id"),
    )

    op.create_table(
        "energy_dimensions",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("name", sa.String(80), nullable=False),
        sa.Column("display_order", sa.SmallInteger, nullable=False, server_default="0"),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.UniqueConstraint("name", name="uq_energy_dimensions_name"),
    )

    op.create_table(
        "chakra_positions",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("position", sa.SmallInteger, nullable=False),
        sa.Column("name", sa.String(60), nullable=False),
        sa.Column("color", sa.String(40), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.UniqueConstraint("position", name="uq_chakra_positions_position"),
    )

    # ════════════════════════════════════════════════════════
    # USUARIOS
    # ════════════════════════════════════════════════════════

    op.create_table(
        "users",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("email", sa.Text, nullable=False),  # PII
        sa.Column("full_name", sa.Text, nullable=False),  # PII
        sa.Column(
            "role",
            postgresql.ENUM(name="user_role_enum", create_type=False),
            nullable=False,
            server_default="therapist",
        ),
        sa.Column("hashed_password", sa.Text, nullable=False),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("email", name="uq_users_email"),
    )

    # ════════════════════════════════════════════════════════
    # CLIENTES (EXPEDIENTES CLÍNICOS)
    # ════════════════════════════════════════════════════════

    op.create_table(
        "clients",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        # PII — usar pgp_sym_encrypt/decrypt en queries
        sa.Column("full_name", sa.Text, nullable=False),
        sa.Column("email", sa.Text, nullable=True),
        sa.Column("phone", sa.Text, nullable=True),  # normalizado +52
        # Datos demográficos
        sa.Column("birth_date", sa.Date, nullable=True),
        sa.Column("birth_place", sa.String(120), nullable=True),
        sa.Column("residence_place", sa.String(120), nullable=True),
        sa.Column(
            "marital_status",
            postgresql.ENUM(name="marital_status_enum", create_type=False),
            nullable=True,
        ),
        sa.Column("profession", sa.String(120), nullable=True),
        # Campos de intake — auditoría 2026-03-03
        sa.Column("num_children", sa.SmallInteger, nullable=True),
        sa.Column("num_siblings", sa.SmallInteger, nullable=True),
        sa.Column("birth_order", sa.SmallInteger, nullable=True),
        sa.Column("predominant_emotions", postgresql.JSONB, nullable=True),
        sa.Column("family_abortions", sa.SmallInteger, nullable=True),
        sa.Column("deaths_before_41", sa.Text, nullable=True),
        sa.Column("important_notes", sa.Text, nullable=True),
        # Motivación de consulta
        sa.Column("motivation_visit", postgresql.JSONB, nullable=True),
        sa.Column("motivation_general", sa.Text, nullable=True),
        # Trazabilidad Notion
        sa.Column("notion_page_id", sa.String(100), nullable=True),
        sa.Column("migration_batch_id", postgresql.UUID(as_uuid=True), nullable=True),
        # Timestamps + soft delete
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("notion_page_id", name="uq_clients_notion_page_id"),
    )
    op.create_index("ix_clients_notion_page_id", "clients", ["notion_page_id"])
    op.create_index("ix_clients_migration_batch_id", "clients", ["migration_batch_id"])

    op.create_table(
        "client_conditions",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column(
            "client_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("clients.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "condition_type",
            postgresql.ENUM(name="condition_type_enum", create_type=False),
            nullable=False,
        ),
        sa.Column("description", sa.Text, nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        "ix_client_conditions_client_id", "client_conditions", ["client_id"]
    )

    op.create_table(
        "client_medications",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column(
            "client_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("clients.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("notes", sa.Text, nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        "ix_client_medications_client_id", "client_medications", ["client_id"]
    )

    op.create_table(
        "client_sleep",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column(
            "client_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("clients.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("avg_hours", sa.SmallInteger, nullable=True),
        sa.Column(
            "quality",
            postgresql.ENUM(name="sleep_quality_enum", create_type=False),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.UniqueConstraint("client_id", name="uq_client_sleep_client_id"),
    )

    op.create_table(
        "family_members",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column(
            "client_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("clients.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "family_type",
            postgresql.ENUM(name="family_type_enum", create_type=False),
            nullable=False,
        ),
        sa.Column("description", sa.Text, nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_family_members_client_id", "family_members", ["client_id"])

    # ════════════════════════════════════════════════════════
    # SESIONES
    # ════════════════════════════════════════════════════════

    op.create_table(
        "sessions",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column(
            "client_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("clients.id", ondelete="RESTRICT"),
            nullable=True,
        ),
        sa.Column(
            "therapist_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "therapy_type_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("therapy_types.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("session_number", sa.SmallInteger, nullable=True),
        sa.Column("measured_at", sa.DateTime(timezone=True), nullable=False),
        # Nivel energético general
        sa.Column("general_energy_level", sa.Integer, nullable=True),
        # Costo — auditoría 2026-03-03
        sa.Column("cost", sa.Numeric(10, 2), nullable=True),
        # Campos de limpieza energética — auditoría 2026-03-03
        sa.Column("entities_count", sa.SmallInteger, nullable=True),
        sa.Column("implants_count", sa.SmallInteger, nullable=True),
        sa.Column("total_cleanings", sa.SmallInteger, nullable=True),
        sa.Column("bud", sa.String(200), nullable=True),
        sa.Column("bud_chakra", sa.String(200), nullable=True),  # para animales
        sa.Column("payment_notes", sa.Text, nullable=True),
        # Trazabilidad Notion
        sa.Column("notion_page_id", sa.String(100), nullable=True),
        sa.Column("migration_batch_id", postgresql.UUID(as_uuid=True), nullable=True),
        # Timestamps + soft delete
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("notion_page_id", name="uq_sessions_notion_page_id"),
    )
    op.create_index("ix_sessions_client_id", "sessions", ["client_id"])
    op.create_index("ix_sessions_measured_at", "sessions", ["measured_at"])
    op.create_index("ix_sessions_notion_page_id", "sessions", ["notion_page_id"])
    op.create_index(
        "ix_sessions_migration_batch_id", "sessions", ["migration_batch_id"]
    )

    op.create_table(
        "session_energy_readings",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column(
            "session_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("sessions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "dimension_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("energy_dimensions.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("initial_value", sa.Numeric(6, 2), nullable=True),  # 0-100
        sa.Column(
            "final_value", sa.Numeric(6, 2), nullable=True
        ),  # 0-100, ~20% sesiones
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.UniqueConstraint(
            "session_id", "dimension_id", name="uq_energy_reading_session_dimension"
        ),
    )
    op.create_index(
        "ix_session_energy_readings_session_id",
        "session_energy_readings",
        ["session_id"],
    )

    op.create_table(
        "session_chakra_readings",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column(
            "session_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("sessions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "chakra_position_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("chakra_positions.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "initial_value", sa.Numeric(5, 2), nullable=True
        ),  # 0-14 (escala Notion)
        sa.Column(
            "final_value", sa.Numeric(5, 2), nullable=True
        ),  # 0-14, ~20% sesiones
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.UniqueConstraint(
            "session_id", "chakra_position_id", name="uq_chakra_reading_session_chakra"
        ),
    )
    op.create_index(
        "ix_session_chakra_readings_session_id",
        "session_chakra_readings",
        ["session_id"],
    )

    op.create_table(
        "session_affectations",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column(
            "session_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("sessions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "chakra_position_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("chakra_positions.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("organ_gland", sa.String(200), nullable=True),
        sa.Column("affectation_type", sa.String(200), nullable=True),
        sa.Column("initial_energy", sa.Numeric(5, 2), nullable=True),
        sa.Column("final_energy", sa.Numeric(5, 2), nullable=True),
        sa.Column("adult_age", sa.SmallInteger, nullable=True),
        sa.Column("child_age", sa.SmallInteger, nullable=True),
        sa.Column("adult_theme", sa.Text, nullable=True),
        sa.Column("child_theme", sa.Text, nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        "ix_session_affectations_session_id", "session_affectations", ["session_id"]
    )

    op.create_table(
        "session_topics",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column(
            "session_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("sessions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "source_type",
            postgresql.ENUM(name="organ_source_type_enum", create_type=False),
            nullable=False,
        ),
        sa.Column("zone", sa.String(100), nullable=True),
        sa.Column("adult_theme", sa.Text, nullable=True),
        sa.Column("child_theme", sa.Text, nullable=True),
        sa.Column("adult_age", sa.SmallInteger, nullable=True),
        sa.Column("child_age", sa.SmallInteger, nullable=True),
        sa.Column("emotions", sa.Text, nullable=True),
        sa.Column("initial_energy", sa.Numeric(5, 2), nullable=True),
        sa.Column("final_energy", sa.Numeric(5, 2), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_session_topics_session_id", "session_topics", ["session_id"])

    op.create_table(
        "session_lnt",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column(
            "session_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("sessions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("theme_organ", sa.String(300), nullable=True),
        sa.Column("initial_energy", sa.Numeric(5, 2), nullable=True),
        sa.Column("final_energy", sa.Numeric(5, 2), nullable=True),
        sa.Column("healing_energy_body", sa.Boolean, nullable=True),
        sa.Column("healing_spiritual_body", sa.Boolean, nullable=True),
        sa.Column("healing_physical_body", sa.Boolean, nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_session_lnt_session_id", "session_lnt", ["session_id"])

    op.create_table(
        "session_cleaning_events",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column(
            "session_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("sessions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("layer", sa.String(100), nullable=True),
        sa.Column("quantity", sa.SmallInteger, nullable=True),
        sa.Column("aura_color", sa.String(60), nullable=True),
        sa.Column("cleanings_required", sa.SmallInteger, nullable=True),
        sa.Column("manifestation", sa.Text, nullable=True),
        sa.Column("materials_used", sa.Text, nullable=True),
        sa.Column("creation_moment", sa.Text, nullable=True),
        sa.Column("energy_level", sa.Numeric(6, 2), nullable=True),
        sa.Column("origin", sa.Text, nullable=True),
        sa.Column("person", sa.String(200), nullable=True),
        sa.Column("work_done", sa.Text, nullable=True),
        sa.Column("life_area", sa.String(100), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        "ix_session_cleaning_events_session_id",
        "session_cleaning_events",
        ["session_id"],
    )

    op.create_table(
        "session_organs",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column(
            "session_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("sessions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "source_type",
            postgresql.ENUM(name="organ_source_type_enum", create_type=False),
            nullable=False,
        ),
        sa.Column("name", sa.String(200), nullable=True),
        sa.Column("initial_energy", sa.Numeric(5, 2), nullable=True),
        sa.Column("final_energy", sa.Numeric(5, 2), nullable=True),
        sa.Column("adult_age", sa.SmallInteger, nullable=True),
        sa.Column("child_age", sa.SmallInteger, nullable=True),
        sa.Column("adult_theme", sa.Text, nullable=True),
        sa.Column("child_theme", sa.Text, nullable=True),
        sa.Column("emotions", sa.Text, nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_session_organs_session_id", "session_organs", ["session_id"])

    # ════════════════════════════════════════════════════════
    # MATERIALES DE LIMPIEZA  (nueva tabla — auditoría)
    # ════════════════════════════════════════════════════════

    op.create_table(
        "cleaning_materials",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column(
            "client_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("clients.id", ondelete="RESTRICT"),
            nullable=True,
        ),
        sa.Column(
            "session_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("sessions.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "material_type",
            postgresql.ENUM(name="cleaning_material_type_enum", create_type=False),
            nullable=False,
        ),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("size", sa.String(60), nullable=True),
        sa.Column("quantity", sa.SmallInteger, nullable=True),
        sa.Column("symbols", postgresql.JSONB, nullable=True),  # solo velas
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        "ix_cleaning_materials_client_id", "cleaning_materials", ["client_id"]
    )
    op.create_index(
        "ix_cleaning_materials_session_id", "cleaning_materials", ["session_id"]
    )

    # ════════════════════════════════════════════════════════
    # AUDITORÍA Y TRAZABILIDAD
    # ════════════════════════════════════════════════════════

    op.create_table(
        "audit_log",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("table_name", sa.String(80), nullable=False),
        sa.Column("record_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "action",
            postgresql.ENUM(name="audit_action_enum", create_type=False),
            nullable=False,
        ),
        sa.Column(
            "changed_by",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "changed_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("old_data", postgresql.JSONB, nullable=True),
        sa.Column("new_data", postgresql.JSONB, nullable=True),
        sa.Column("ip_address", sa.String(45), nullable=True),
        sa.Column("user_agent", sa.Text, nullable=True),
    )
    op.create_index(
        "ix_audit_log_table_record", "audit_log", ["table_name", "record_id"]
    )
    op.create_index("ix_audit_log_changed_at", "audit_log", ["changed_at"])

    op.create_table(
        "migration_log",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column("batch_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("script_name", sa.String(100), nullable=False),
        sa.Column(
            "source", sa.String(60), nullable=False, server_default="notion_export"
        ),
        sa.Column("notion_page_id", sa.String(100), nullable=True),
        sa.Column("target_table", sa.String(80), nullable=False),
        sa.Column("target_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column(
            "status",
            postgresql.ENUM(name="migration_status_enum", create_type=False),
            nullable=False,
        ),
        sa.Column("error_message", sa.Text, nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index("ix_migration_log_batch_id", "migration_log", ["batch_id"])
    op.create_index(
        "ix_migration_log_notion_page_id", "migration_log", ["notion_page_id"]
    )
    op.create_index("ix_migration_log_target_table", "migration_log", ["target_table"])

    # ── Seed de catálogos ─────────────────────────────────────

    # Posiciones de chakra (siempre 7, datos fijos)
    op.execute("""
        INSERT INTO chakra_positions (id, position, name, color) VALUES
        (gen_random_uuid(), 1, 'Raíz',       'Rojo'),
        (gen_random_uuid(), 2, 'Sacro',      'Naranja'),
        (gen_random_uuid(), 3, 'Plexo Solar','Amarillo'),
        (gen_random_uuid(), 4, 'Corazón',    'Verde'),
        (gen_random_uuid(), 5, 'Garganta',   'Azul'),
        (gen_random_uuid(), 6, 'Tercer Ojo', 'Índigo'),
        (gen_random_uuid(), 7, 'Corona',     'Violeta')
    """)

    # Dimensiones energéticas (9 activas en Notion CSV + 4 reservadas = 13 total)
    op.execute("""
        INSERT INTO energy_dimensions (id, name, display_order, is_active) VALUES
        (gen_random_uuid(), 'Vibración',          1,  true),
        (gen_random_uuid(), 'Masculina',          2,  true),
        (gen_random_uuid(), 'Femenina',           3,  true),
        (gen_random_uuid(), 'Física',             4,  true),
        (gen_random_uuid(), 'Psíquica',           5,  true),
        (gen_random_uuid(), 'Abundancia',         6,  true),
        (gen_random_uuid(), 'Prosperidad',        7,  true),
        (gen_random_uuid(), 'Relación c/Dinero',  8,  true),
        (gen_random_uuid(), 'Polución',           9,  true),
        (gen_random_uuid(), 'Dimensión 10',       10, false),
        (gen_random_uuid(), 'Dimensión 11',       11, false),
        (gen_random_uuid(), 'Dimensión 12',       12, false),
        (gen_random_uuid(), 'Dimensión 13',       13, false)
    """)


def downgrade() -> None:
    # Eliminar en orden inverso (respetar FKs)
    op.drop_table("migration_log")
    op.drop_table("audit_log")
    op.drop_table("cleaning_materials")
    op.drop_table("session_organs")
    op.drop_table("session_cleaning_events")
    op.drop_table("session_lnt")
    op.drop_table("session_topics")
    op.drop_table("session_affectations")
    op.drop_table("session_chakra_readings")
    op.drop_table("session_energy_readings")
    op.drop_table("sessions")
    op.drop_table("family_members")
    op.drop_table("client_sleep")
    op.drop_table("client_medications")
    op.drop_table("client_conditions")
    op.drop_table("clients")
    op.drop_table("users")
    op.drop_table("chakra_positions")
    op.drop_table("energy_dimensions")
    op.drop_table("therapy_types")

    # Eliminar tipos enum
    op.execute("DROP TYPE IF EXISTS organ_source_type_enum")
    op.execute("DROP TYPE IF EXISTS cleaning_material_type_enum")
    op.execute("DROP TYPE IF EXISTS migration_status_enum")
    op.execute("DROP TYPE IF EXISTS audit_action_enum")
    op.execute("DROP TYPE IF EXISTS family_type_enum")
    op.execute("DROP TYPE IF EXISTS condition_type_enum")
    op.execute("DROP TYPE IF EXISTS sleep_quality_enum")
    op.execute("DROP TYPE IF EXISTS marital_status_enum")
    op.execute("DROP TYPE IF EXISTS user_role_enum")
