"""Agrega campos de familia e indicador de animal a clients.

  - clients.family_nuclear_desc  TEXT NULL   — descripción libre de familia nuclear
  - clients.family_current_desc  TEXT NULL   — descripción libre de familia actual
  - clients.is_animal            BOOLEAN NOT NULL DEFAULT FALSE — cliente es animal

Estos campos provienen del export de Notion (campos "Familia Nuclear" y "Familia Actual"
en los archivos .md de clientes).

Revision ID: 0003
Revises: 0002
Create Date: 2026-03-06
"""

from collections.abc import Sequence
from typing import Union

import sqlalchemy as sa

from alembic import op

revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("clients", sa.Column("family_nuclear_desc", sa.Text(), nullable=True))
    op.add_column("clients", sa.Column("family_current_desc", sa.Text(), nullable=True))
    op.add_column(
        "clients",
        sa.Column(
            "is_animal",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )


def downgrade() -> None:
    op.drop_column("clients", "is_animal")
    op.drop_column("clients", "family_current_desc")
    op.drop_column("clients", "family_nuclear_desc")
