"""Amplía columnas varchar(100) a TEXT en session_cleaning_events.

Los campos life_area y layer almacenan listas de valores separados por coma
(ej. "Remueve fuerzas negativas, Energía femenina, Sanador, Limpieza, ...") que
superan el límite de 100 caracteres en datos reales de Notion.

  - session_cleaning_events.life_area  VARCHAR(100) → TEXT
  - session_cleaning_events.layer      VARCHAR(100) → TEXT

Revision ID: 0004
Revises: 0003
Create Date: 2026-03-07
"""

from collections.abc import Sequence
from typing import Union

import sqlalchemy as sa

from alembic import op

revision: str = "0004"
down_revision: Union[str, None] = "0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column(
        "session_cleaning_events",
        "life_area",
        existing_type=sa.String(100),
        type_=sa.Text(),
        existing_nullable=True,
    )
    op.alter_column(
        "session_cleaning_events",
        "layer",
        existing_type=sa.String(100),
        type_=sa.Text(),
        existing_nullable=True,
    )


def downgrade() -> None:
    op.alter_column(
        "session_cleaning_events",
        "layer",
        existing_type=sa.Text(),
        type_=sa.String(100),
        existing_nullable=True,
    )
    op.alter_column(
        "session_cleaning_events",
        "life_area",
        existing_type=sa.Text(),
        type_=sa.String(100),
        existing_nullable=True,
    )
