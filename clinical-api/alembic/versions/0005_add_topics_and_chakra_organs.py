"""Agrega tablas client_topics, session_theme_entries y chakra_organs.

client_topics      — Temas persistentes por paciente (con progreso 0-100%)
session_theme_entries — Trabajo por tema dentro de una sesión (bloqueos, resultante, secundario)
chakra_organs      — Catálogo estático de órganos agrupados por chakra (seed incluido)

Revision ID: 0005
Revises: 0004
Create Date: 2026-03-11
"""

from collections.abc import Sequence
from typing import Union

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID as PG_UUID

from alembic import op

revision: str = "0005"
down_revision: Union[str, None] = "0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# ── Datos de seed: (chakra_name, organ_name, system_name | None) ──────────────
# Fuente: PDF "Órganos por Chakra" — sección 2.3 de step4_redesign_spec.md
_ORGAN_SEED: list[tuple[str, str, str | None]] = [
    # ── Raíz ──────────────────────────────────────────────────────────────────
    ("Raíz", "Sangre",                    "Inmunitario, Estructura celular"),
    ("Raíz", "Huesos",                    "Inmunitario, Estructura celular"),
    ("Raíz", "Base de la columna",        "Inmunitario, Estructura celular"),
    ("Raíz", "Próstata",                  "Inmunitario, Estructura celular"),
    ("Raíz", "Vagina",                    "Inmunitario, Estructura celular"),
    ("Raíz", "Clítoris",                  "Inmunitario, Estructura celular"),
    ("Raíz", "Labios vaginales",          "Inmunitario, Estructura celular"),
    ("Raíz", "Vejiga",                    "Inmunitario, Estructura celular"),
    ("Raíz", "Intestino grueso",          "Inmunitario, Estructura celular"),
    ("Raíz", "Ano",                       "Inmunitario, Estructura celular"),
    ("Raíz", "Recto",                     "Inmunitario, Estructura celular"),
    ("Raíz", "Perineo",                   "Inmunitario, Estructura celular"),
    ("Raíz", "Piernas",                   "Inmunitario, Estructura celular"),
    ("Raíz", "Pies",                      "Inmunitario, Estructura celular"),
    ("Raíz", "Sacro",                     "Inmunitario, Estructura celular"),
    ("Raíz", "Coxis",                     "Inmunitario, Estructura celular"),
    ("Raíz", "Soporte físico del cuerpo", "Inmunitario, Estructura celular"),
    ("Raíz", "Órganos sexuales",          "Glándula"),

    # ── Sacro ─────────────────────────────────────────────────────────────────
    ("Sacro", "Intestino grueso",      None),
    ("Sacro", "Vértebras inferiores",  None),
    ("Sacro", "Caderas",               None),
    ("Sacro", "Pelvis",                None),
    ("Sacro", "Pubis",                 None),
    ("Sacro", "Apéndice",              None),
    ("Sacro", "Vejiga urinaria",       None),
    ("Sacro", "Vesícula seminal",      None),
    ("Sacro", "Uretra",                None),
    ("Sacro", "Testículos",            None),
    ("Sacro", "Pene",                  None),
    ("Sacro", "Escroto",               None),
    ("Sacro", "Plexo venoso vaginal",  None),
    ("Sacro", "Ovarios",               None),
    ("Sacro", "Útero",                 None),
    ("Sacro", "Trompas de falopio",    None),
    ("Sacro", "Riñones",               None),
    ("Sacro", "Cresta ilíaca",         None),
    ("Sacro", "Dorso lumbar",          None),
    ("Sacro", "Suprarrenal",           "Glándula"),
    ("Sacro", "Órganos sexuales",      "Glándula"),

    # ── Plexo Solar ───────────────────────────────────────────────────────────
    ("Plexo Solar", "Abdomen",            None),
    ("Plexo Solar", "Estómago",           None),
    ("Plexo Solar", "Intestino delgado",  None),
    ("Plexo Solar", "Riñones",            None),
    ("Plexo Solar", "Hígado",             None),
    ("Plexo Solar", "Vesícula biliar",    None),
    ("Plexo Solar", "Bazo",               None),
    ("Plexo Solar", "Duodeno",            None),
    ("Plexo Solar", "Columna central",    None),
    ("Plexo Solar", "Caderas",            None),
    ("Plexo Solar", "Articulaciones",     None),
    ("Plexo Solar", "Vena porta",         None),
    ("Plexo Solar", "Píloro",             None),
    ("Plexo Solar", "Yeyuno",             None),
    ("Plexo Solar", "Colon ascendente",   None),
    ("Plexo Solar", "Ciego",              None),
    ("Plexo Solar", "Apéndice",           None),
    ("Plexo Solar", "Ombligo",            None),
    ("Plexo Solar", "Páncreas",           "Glándula"),

    # ── Corazón ───────────────────────────────────────────────────────────────
    ("Corazón", "Brazos",           "Circulatorio"),
    ("Corazón", "Radio",            "Circulatorio"),
    ("Corazón", "Cúbito",           "Circulatorio"),
    ("Corazón", "Deltoides",        "Circulatorio"),
    ("Corazón", "Codos",            "Circulatorio"),
    ("Corazón", "Manos",            "Circulatorio"),
    ("Corazón", "Muñeca",           "Circulatorio"),
    ("Corazón", "Pecho",            "Circulatorio"),
    ("Corazón", "Timo",             "Circulatorio"),
    ("Corazón", "Costillas",        "Circulatorio"),
    ("Corazón", "Pectoral",         "Circulatorio"),
    ("Corazón", "Esternón",         "Circulatorio"),
    ("Corazón", "Esófago",          "Circulatorio"),
    ("Corazón", "Corazón",          "Circulatorio"),
    ("Corazón", "Venas coronarias", "Circulatorio"),
    ("Corazón", "Pericardio",       "Circulatorio"),
    ("Corazón", "Aorta",            "Circulatorio"),
    ("Corazón", "Cardias",          "Circulatorio"),
    ("Corazón", "Pulmones",         "Circulatorio"),
    ("Corazón", "Senos mamarios",   "Circulatorio"),
    ("Corazón", "Timo",             "Glándula"),

    # ── Garganta ──────────────────────────────────────────────────────────────
    ("Garganta", "Diafragma",               "Respiratorio"),
    ("Garganta", "Hombros",                 "Respiratorio"),
    ("Garganta", "Pleura",                  "Respiratorio"),
    ("Garganta", "Laringe",                 "Respiratorio"),
    ("Garganta", "Tráquea",                 "Respiratorio"),
    ("Garganta", "Parótida",                "Respiratorio"),
    ("Garganta", "Angina",                  "Respiratorio"),
    ("Garganta", "Carótida",                "Respiratorio"),
    ("Garganta", "Esternocleidomastoideo",  "Respiratorio"),
    ("Garganta", "Yugular",                 "Respiratorio"),
    ("Garganta", "Cuello",                  "Respiratorio"),
    ("Garganta", "Tiroides",                "Glándula"),
    ("Garganta", "Timo",                    "Glándula"),
    ("Garganta", "Salivares",               "Glándula"),

    # ── Tercer Ojo ────────────────────────────────────────────────────────────
    ("Tercer Ojo", "Cerebro",            "Nervioso, Endócrino"),
    ("Tercer Ojo", "Ojos",               "Nervioso, Endócrino"),
    ("Tercer Ojo", "Nariz",              "Nervioso, Endócrino"),
    ("Tercer Ojo", "Paranasales",        "Nervioso, Endócrino"),
    ("Tercer Ojo", "Senos nasales",      "Nervioso, Endócrino"),
    ("Tercer Ojo", "Mentón",             "Nervioso, Endócrino"),
    ("Tercer Ojo", "Dentadura",          "Nervioso, Endócrino"),
    ("Tercer Ojo", "Lengua",             "Nervioso, Endócrino"),
    ("Tercer Ojo", "Hipotálamo",         "Nervioso, Endócrino"),
    ("Tercer Ojo", "Oídos",              "Nervioso, Endócrino"),
    ("Tercer Ojo", "Oreja",              "Nervioso, Endócrino"),
    ("Tercer Ojo", "Nervio facial",      "Nervioso, Endócrino"),
    ("Tercer Ojo", "Nuca",               "Nervioso, Endócrino"),
    ("Tercer Ojo", "Tallo parietal",     "Nervioso, Endócrino"),
    ("Tercer Ojo", "Hipocampo",          "Nervioso, Endócrino"),
    ("Tercer Ojo", "Amígdala cerebral",  "Nervioso, Endócrino"),
    ("Tercer Ojo", "Base del cráneo",    "Nervioso, Endócrino"),
    ("Tercer Ojo", "Pineal",             "Glándula"),
    ("Tercer Ojo", "Pituitaria",         "Glándula"),

    # ── Corona ────────────────────────────────────────────────────────────────
    ("Corona", "Cerebro",    "Muscular, Nervioso autónomo, Esquelético"),
    ("Corona", "Piel",       "Muscular, Nervioso autónomo, Esquelético"),
    ("Corona", "Hipófisis",  "Muscular, Nervioso autónomo, Esquelético"),
    ("Corona", "Coronilla",  "Muscular, Nervioso autónomo, Esquelético"),
    ("Corona", "Pineal",     "Glándula"),
    ("Corona", "Pituitaria", "Glándula"),
]


def _build_organ_values() -> str:
    """Construye la cláusula VALUES para el seed de chakra_organs."""
    rows: list[str] = []
    for chakra, organ, system in _ORGAN_SEED:
        chakra_esc = chakra.replace("'", "''")
        organ_esc = organ.replace("'", "''")
        sys_val = f"'{system.replace(chr(39), chr(39)*2)}'" if system else "NULL"
        rows.append(f"('{chakra_esc}', '{organ_esc}', {sys_val})")
    return ",\n        ".join(rows)


def upgrade() -> None:
    # ── client_topics ─────────────────────────────────────────────────────────
    op.create_table(
        "client_topics",
        sa.Column(
            "id",
            PG_UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column(
            "client_id",
            PG_UUID(as_uuid=True),
            sa.ForeignKey("clients.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("progress_pct", sa.SmallInteger(), nullable=False, server_default="0"),
        sa.Column("is_completed", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "progress_pct BETWEEN 0 AND 100",
            name="ck_client_topics_progress_pct",
        ),
    )
    op.create_index("ix_client_topics_client_id", "client_topics", ["client_id"])

    # ── chakra_organs ─────────────────────────────────────────────────────────
    op.create_table(
        "chakra_organs",
        sa.Column(
            "id",
            PG_UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column(
            "chakra_position_id",
            PG_UUID(as_uuid=True),
            sa.ForeignKey("chakra_positions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("organ_name", sa.String(200), nullable=False),
        sa.Column("system_name", sa.String(100), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index("ix_chakra_organs_chakra_id", "chakra_organs", ["chakra_position_id"])

    # ── session_theme_entries ─────────────────────────────────────────────────
    op.create_table(
        "session_theme_entries",
        sa.Column(
            "id",
            PG_UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
            nullable=False,
        ),
        sa.Column(
            "session_id",
            PG_UUID(as_uuid=True),
            sa.ForeignKey("sessions.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "client_topic_id",
            PG_UUID(as_uuid=True),
            sa.ForeignKey("client_topics.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("entry_type", sa.String(20), nullable=False),
        sa.Column(
            "chakra_position_id",
            PG_UUID(as_uuid=True),
            sa.ForeignKey("chakra_positions.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("organ_name", sa.String(200), nullable=True),
        sa.Column("initial_energy", sa.Numeric(5, 2), nullable=True),
        sa.Column("final_energy", sa.Numeric(5, 2), nullable=True),
        # Edades — infancia
        sa.Column("childhood_place", sa.Text(), nullable=True),
        sa.Column("childhood_people", sa.Text(), nullable=True),
        sa.Column("childhood_situation", sa.Text(), nullable=True),
        sa.Column("childhood_description", sa.Text(), nullable=True),
        sa.Column("childhood_emotions", sa.Text(), nullable=True),
        # Edades — adultez
        sa.Column("adulthood_place", sa.Text(), nullable=True),
        sa.Column("adulthood_people", sa.Text(), nullable=True),
        sa.Column("adulthood_situation", sa.Text(), nullable=True),
        sa.Column("adulthood_description", sa.Text(), nullable=True),
        sa.Column("adulthood_emotions", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint(
            "entry_type IN ('bloqueo_1','bloqueo_2','bloqueo_3','resultante','secundario')",
            name="ck_session_theme_entries_entry_type",
        ),
    )
    op.create_index(
        "ix_session_theme_entries_session_id", "session_theme_entries", ["session_id"]
    )
    op.create_index(
        "ix_session_theme_entries_topic_id", "session_theme_entries", ["client_topic_id"]
    )

    # ── Seed chakra_organs ────────────────────────────────────────────────────
    values_sql = _build_organ_values()
    op.execute(sa.text(f"""
        INSERT INTO chakra_organs (id, chakra_position_id, organ_name, system_name)
        SELECT gen_random_uuid(), cp.id, v.organ_name, v.system_name
        FROM chakra_positions cp
        JOIN (VALUES
        {values_sql}
        ) AS v(chakra_name, organ_name, system_name)
          ON cp.name = v.chakra_name
    """))


def downgrade() -> None:
    op.drop_table("session_theme_entries")
    op.drop_table("chakra_organs")
    op.drop_table("client_topics")
