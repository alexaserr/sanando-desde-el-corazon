"""Agrega has_consent, consent_pdf_path y archived_at a clients.

Incluye data migration: nullifica energías > 100% en session_affectations.

Revision ID: 0011
Revises: 0010
Create Date: 2026-03-20
"""
import sqlalchemy as sa
from alembic import op

revision = "0011"
down_revision = "0010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── Consent + archived_at en clients ─────────────────────────
    op.add_column(
        "clients",
        sa.Column("has_consent", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )
    op.add_column(
        "clients",
        sa.Column("consent_pdf_path", sa.Text(), nullable=True),
    )
    op.add_column(
        "clients",
        sa.Column(
            "archived_at",
            sa.DateTime(timezone=True),
            nullable=True,
            comment="NOM-004 Art. 24 — ciclo de retención",
        ),
    )

    # ── Data fix: energías > 100% en session_affectations → NULL ─
    op.execute(
        "UPDATE session_affectations SET initial_energy = NULL WHERE initial_energy > 100"
    )
    op.execute(
        "UPDATE session_affectations SET final_energy = NULL WHERE final_energy > 100"
    )


def downgrade() -> None:
    op.drop_column("clients", "archived_at")
    op.drop_column("clients", "consent_pdf_path")
    op.drop_column("clients", "has_consent")
