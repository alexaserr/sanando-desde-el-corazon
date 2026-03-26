"""Agrega columnas faltantes para formulario público de registro.

- clients.family_abortions_detail (TEXT nullable)
- clients.num_children_detail (TEXT nullable)
- family_members.dynamics (TEXT nullable)

Revision ID: 0012
Revises: 0011
Create Date: 2026-03-25
"""
import sqlalchemy as sa
from alembic import op

revision = "0012"
down_revision = "0011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "clients",
        sa.Column("family_abortions_detail", sa.Text(), nullable=True),
    )
    op.add_column(
        "clients",
        sa.Column("num_children_detail", sa.Text(), nullable=True),
    )
    op.add_column(
        "family_members",
        sa.Column("dynamics", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("family_members", "dynamics")
    op.drop_column("clients", "num_children_detail")
    op.drop_column("clients", "family_abortions_detail")
