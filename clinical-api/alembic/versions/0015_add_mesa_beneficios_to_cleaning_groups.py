"""Add mesa_utilizada and beneficios to session_cleaning_groups.

Revision ID: 0015
Revises: 0014
Create Date: 2026-03-31
"""
import sqlalchemy as sa
from alembic import op

revision = "0015"
down_revision = "0014"


def upgrade() -> None:
    op.add_column(
        "session_cleaning_groups",
        sa.Column("mesa_utilizada", sa.Text(), nullable=True),
    )
    op.add_column(
        "session_cleaning_groups",
        sa.Column("beneficios", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("session_cleaning_groups", "beneficios")
    op.drop_column("session_cleaning_groups", "mesa_utilizada")
