"""Agrega tablas de ancestros sistémicos y extiende session_theme_entries/session_lnt.

Revision ID: 0008
Revises: 0007
Create Date: 2026-03-11
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID

revision = "0008"
down_revision = "0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── Nueva tabla: session_ancestors ────────────────────────────────────────
    op.create_table(
        "session_ancestors",
        sa.Column(
            "id",
            UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column(
            "session_id",
            UUID(as_uuid=True),
            sa.ForeignKey("sessions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("member", sa.String(200), nullable=True),
        sa.Column(
            "lineage",
            sa.String(20),
            sa.CheckConstraint(
                "lineage IN ('materno', 'paterno', 'ambos')",
                name="ck_session_ancestors_lineage",
            ),
            nullable=True,
        ),
        sa.Column("bond_energy", ARRAY(sa.Text()), nullable=True),
        sa.Column("ancestor_roles", ARRAY(sa.Text()), nullable=True),
        sa.Column("consultant_roles", ARRAY(sa.Text()), nullable=True),
        sa.Column("energy_expressions", JSONB, nullable=True),
        sa.Column("family_traumas", JSONB, nullable=True),
        # Timestamps
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        "ix_session_ancestors_session_id", "session_ancestors", ["session_id"]
    )

    # ── Nueva tabla: session_ancestor_conciliation ────────────────────────────
    op.create_table(
        "session_ancestor_conciliation",
        sa.Column(
            "id",
            UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column(
            "session_id",
            UUID(as_uuid=True),
            sa.ForeignKey("sessions.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column("healing_phrases", sa.Text(), nullable=True),
        sa.Column("conciliation_acts", sa.Text(), nullable=True),
        sa.Column("life_aspects_affected", sa.Text(), nullable=True),
        sa.Column("session_relationship", sa.Text(), nullable=True),
        # Timestamps
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(
        "ix_session_ancestor_conciliation_session_id",
        "session_ancestor_conciliation",
        ["session_id"],
    )

    # ── session_theme_entries: nuevas columnas ────────────────────────────────
    op.add_column(
        "session_theme_entries",
        sa.Column("significado", sa.Text(), nullable=True),
    )
    op.add_column(
        "session_theme_entries",
        sa.Column("interpretacion_tema", sa.Text(), nullable=True),
    )

    # ── session_lnt: nueva columna ────────────────────────────────────────────
    op.add_column(
        "session_lnt",
        sa.Column("peticiones", sa.Text(), nullable=True),
    )

    # ── Soft delete Lectura de Aura ───────────────────────────────────────────
    op.execute(
        "UPDATE therapy_types SET deleted_at = now() WHERE name = 'Lectura de Aura'"
    )


def downgrade() -> None:
    # Reactivar Lectura de Aura
    op.execute(
        "UPDATE therapy_types SET deleted_at = NULL WHERE name = 'Lectura de Aura'"
    )

    # Revertir columnas session_lnt
    op.drop_column("session_lnt", "peticiones")

    # Revertir columnas session_theme_entries
    op.drop_column("session_theme_entries", "interpretacion_tema")
    op.drop_column("session_theme_entries", "significado")

    # Eliminar tablas de ancestros
    op.drop_index(
        "ix_session_ancestor_conciliation_session_id",
        table_name="session_ancestor_conciliation",
    )
    op.drop_table("session_ancestor_conciliation")

    op.drop_index("ix_session_ancestors_session_id", table_name="session_ancestors")
    op.drop_table("session_ancestors")
