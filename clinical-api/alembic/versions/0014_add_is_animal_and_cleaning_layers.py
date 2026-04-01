"""Add is_animal to clients, layers JSONB to session_cleaning_groups.

Revision ID: 0014
Revises: 0013
Create Date: 2026-03-31
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision = "0014"
down_revision = "0013"


def upgrade() -> None:
    op.add_column(
        "clients",
        sa.Column("is_animal", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )
    op.add_column(
        "session_cleaning_groups",
        sa.Column("layers", JSONB(), nullable=True, server_default=sa.text("'[]'::jsonb")),
    )


def downgrade() -> None:
    op.drop_column("session_cleaning_groups", "layers")
    op.drop_column("clients", "is_animal")
