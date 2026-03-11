"""Agrega columna notes (bytea) cifrada con pgcrypto a sessions.

No hay columna notes preexistente, por lo que se añade directamente como
bytea nullable. El cifrado/descifrado se realiza en el router con
pgp_sym_encrypt / pgp_sym_decrypt usando settings.CLINICAL_DB_PGCRYPTO_KEY.

Revision ID: 0006
Revises: 0005
Create Date: 2026-03-11
"""

from collections.abc import Sequence
from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "0006"
down_revision: Union[str, None] = "0005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "sessions",
        sa.Column("notes", sa.LargeBinary(), nullable=True, comment="PII — cifrado pgp_sym_encrypt"),
    )


def downgrade() -> None:
    op.drop_column("sessions", "notes")
