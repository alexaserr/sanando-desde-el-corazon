"""Agrega campos TOTP a la tabla users para autenticación 2FA de Admin.

  - users.totp_secret  TEXT NULL      — secret base32 generado por pyotp
  - users.totp_enabled BOOLEAN NOT NULL DEFAULT FALSE

Revision ID: 0002
Revises: 0001
Create Date: 2026-03-06
"""

from collections.abc import Sequence
from typing import Union

import sqlalchemy as sa

from alembic import op

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("totp_secret", sa.Text(), nullable=True))
    op.add_column(
        "users",
        sa.Column(
            "totp_enabled",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )


def downgrade() -> None:
    op.drop_column("users", "totp_enabled")
    op.drop_column("users", "totp_secret")
