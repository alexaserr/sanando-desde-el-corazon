"""Agrega campos de costo de limpieza a sessions.

Revision ID: 0010
Revises: 0009
Create Date: 2026-03-20
"""
import sqlalchemy as sa
from alembic import op

revision = "0010"
down_revision = "0009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("sessions", sa.Column("porcentaje_pago", sa.Numeric(5, 2), nullable=True))
    op.add_column("sessions", sa.Column("incluye_iva", sa.Boolean(), nullable=False, server_default=sa.text("false")))
    op.add_column("sessions", sa.Column("costo_calculado", sa.Numeric(10, 2), nullable=True))


def downgrade() -> None:
    op.drop_column("sessions", "costo_calculado")
    op.drop_column("sessions", "incluye_iva")
    op.drop_column("sessions", "porcentaje_pago")
