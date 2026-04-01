"""Tablas session_cleaning_groups y session_protections, columnas nuevas en
sessions, session_cleaning_events y session_theme_entries.

Revision ID: 0013
Revises: 0012
Create Date: 2026-03-27
"""
import sqlalchemy as sa
from alembic import op

revision = "0013"
down_revision = "0012"


def upgrade() -> None:
    # ── Nuevas tablas ──────────────────────────────────────────────────
    op.create_table(
        "session_cleaning_groups",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("session_id", sa.UUID(), nullable=False),
        sa.Column("target_type", sa.VARCHAR(20), nullable=False),
        sa.Column("target_name", sa.VARCHAR(200), nullable=True),
        sa.Column("family_member_id", sa.UUID(), nullable=True),
        sa.Column("cleanings_required", sa.Integer(), server_default="0", nullable=True),
        sa.Column("is_charged", sa.Boolean(), server_default="true", nullable=True),
        sa.Column("cost_per_cleaning", sa.Numeric(10, 2), server_default="1300.00", nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("NOW()"), nullable=True),
        sa.Column("deleted_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["session_id"], ["sessions.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["family_member_id"], ["family_members.id"], ondelete="SET NULL"),
    )
    op.create_index("ix_session_cleaning_groups_session", "session_cleaning_groups", ["session_id"])

    op.create_table(
        "session_protections",
        sa.Column("id", sa.UUID(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("session_id", sa.UUID(), nullable=False),
        sa.Column("recipient_type", sa.VARCHAR(20), nullable=False),
        sa.Column("recipient_name", sa.VARCHAR(200), nullable=True),
        sa.Column("family_member_id", sa.UUID(), nullable=True),
        sa.Column("quantity", sa.Integer(), server_default="1", nullable=False),
        sa.Column("cost_per_unit", sa.Numeric(10, 2), server_default="1200.00", nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("NOW()"), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["session_id"], ["sessions.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["family_member_id"], ["family_members.id"], ondelete="SET NULL"),
    )
    op.create_index("ix_session_protections_session", "session_protections", ["session_id"])

    # ── Columnas nuevas en sessions ────────────────────────────────────
    op.add_column("sessions", sa.Column("has_protection", sa.Boolean(), server_default="false", nullable=True))
    op.add_column("sessions", sa.Column("protection_charged", sa.Boolean(), server_default="false", nullable=True))

    # ── Columnas nuevas en session_cleaning_events ─────────────────────
    op.add_column(
        "session_cleaning_events",
        sa.Column("cleaning_group_id", sa.UUID(), nullable=True),
    )
    op.create_foreign_key(
        "fk_cleaning_events_group",
        "session_cleaning_events",
        "session_cleaning_groups",
        ["cleaning_group_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.add_column(
        "session_cleaning_events",
        sa.Column("manifestation_value", sa.Numeric(10, 2), nullable=True),
    )
    op.add_column(
        "session_cleaning_events",
        sa.Column("manifestation_unit", sa.VARCHAR(10), server_default="number", nullable=True),
    )

    # ── Columnas nuevas en session_theme_entries ───────────────────────
    op.add_column("session_theme_entries", sa.Column("childhood_age", sa.Numeric(4, 1), nullable=True))
    op.add_column("session_theme_entries", sa.Column("adulthood_age", sa.Numeric(5, 1), nullable=True))


def downgrade() -> None:
    # ── session_theme_entries ──────────────────────────────────────────
    op.drop_column("session_theme_entries", "adulthood_age")
    op.drop_column("session_theme_entries", "childhood_age")

    # ── session_cleaning_events ────────────────────────────────────────
    op.drop_column("session_cleaning_events", "manifestation_unit")
    op.drop_column("session_cleaning_events", "manifestation_value")
    op.drop_constraint("fk_cleaning_events_group", "session_cleaning_events", type_="foreignkey")
    op.drop_column("session_cleaning_events", "cleaning_group_id")

    # ── sessions ───────────────────────────────────────────────────────
    op.drop_column("sessions", "protection_charged")
    op.drop_column("sessions", "has_protection")

    # ── Tablas nuevas ──────────────────────────────────────────────────
    op.drop_index("ix_session_protections_session", table_name="session_protections")
    op.drop_table("session_protections")
    op.drop_index("ix_session_cleaning_groups_session", table_name="session_cleaning_groups")
    op.drop_table("session_cleaning_groups")
