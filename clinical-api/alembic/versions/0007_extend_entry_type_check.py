"""Extiende CHECK constraint de entry_type para incluir edad_adulta y edad_infancia.

Revision ID: 0007
Revises: 0006
Create Date: 2026-03-11
"""
from alembic import op

revision = "0007"
down_revision = "0006"
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.execute("ALTER TABLE session_theme_entries DROP CONSTRAINT IF EXISTS ck_session_theme_entries_entry_type")
    op.execute("""
        ALTER TABLE session_theme_entries 
        ADD CONSTRAINT ck_session_theme_entries_entry_type 
        CHECK (entry_type IN ('bloqueo_1','bloqueo_2','bloqueo_3','resultante','secundario','edad_adulta','edad_infancia'))
    """)

def downgrade() -> None:
    op.execute("ALTER TABLE session_theme_entries DROP CONSTRAINT IF EXISTS ck_session_theme_entries_entry_type")
    op.execute("""
        ALTER TABLE session_theme_entries 
        ADD CONSTRAINT ck_session_theme_entries_entry_type 
        CHECK (entry_type IN ('bloqueo_1','bloqueo_2','bloqueo_3','resultante','secundario'))
    """)
