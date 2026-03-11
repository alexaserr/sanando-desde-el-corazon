"""Agrega campos de resumen de limpiezas a sessions.

Revision ID: 0009
Revises: 0008
Create Date: 2026-03-11
"""
import sqlalchemy as sa
from alembic import op

revision = "0009"
down_revision = "0008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Campos de resumen de limpiezas energéticas — nivel sesión
    op.add_column("sessions", sa.Column("capas", sa.SmallInteger(), nullable=True))
    op.add_column("sessions", sa.Column("limpiezas_requeridas", sa.SmallInteger(), nullable=True))
    op.add_column("sessions", sa.Column("mesa_utilizada", sa.Text(), nullable=True))
    op.add_column("sessions", sa.Column("beneficios", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("sessions", "beneficios")
    op.drop_column("sessions", "mesa_utilizada")
    op.drop_column("sessions", "limpiezas_requeridas")
    op.drop_column("sessions", "capas")
