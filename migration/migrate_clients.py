"""
Fase 3-B: Migración de clientes Notion → clinical_db.

Prerrequisito: normalize.py completado (data/clean/clients_clean.csv existe).

Tablas destino:
  - clients            (PII: full_name, email, phone cifrados con pgcrypto)
  - client_conditions
  - client_medications
  - client_sleep
  - family_members

Sub-carpetas esperadas (opcional) en DATA_RAW_DIR/Clientes/{notion_page_id}/:
  - Padecimientos.csv   → client_conditions
  - Medicamentos.csv    → client_medications
  - Sueño.csv           → client_sleep
  - Familia.csv         → family_members

Uso:
  python migrate_clients.py [--batch-id UUID] [--dry-run]
"""
import argparse
import asyncio
import json
import logging
import sys
import uuid
from pathlib import Path
from typing import Any

import pandas as pd
import psycopg
import structlog
from psycopg.rows import dict_row

from config import settings

structlog.configure(
    wrapper_class=structlog.make_filtering_bound_logger(
        getattr(logging, settings.LOG_LEVEL, logging.INFO)
    ),
)
log = structlog.get_logger(__name__)

# ── Mapeo Notion → SDC para sub-tablas ────────────────────────

CONDITION_TYPE_MAP: dict[str, str] = {
    "padecimiento médico": "medical",
    "medico": "medical", "médico": "medical",
    "enfermedad recurrente": "recurring_disease",
    "recurrente": "recurring_disease",
    "dolor": "pain",
}

SLEEP_QUALITY_MAP: dict[str, str] = {
    "buena": "good", "bueno": "good", "bien": "good",
    "regular": "regular",
    "mala": "bad", "malo": "bad", "mal": "bad",
}

FAMILY_TYPE_MAP: dict[str, str] = {
    "nuclear": "nuclear",
    "actual": "current",
}


# ══════════════════════════════════════════════════════════════
# Funciones de inserción (raw SQL con pgcrypto)
# ══════════════════════════════════════════════════════════════

async def log_migration(
    conn: psycopg.AsyncConnection[Any],
    batch_id: uuid.UUID,
    script_name: str,
    notion_page_id: str | None,
    target_table: str,
    target_id: uuid.UUID | None,
    status: str,
    error_message: str | None = None,
) -> None:
    """Registra resultado en migration_log (INSERT-only)."""
    await conn.execute(
        """
        INSERT INTO migration_log
            (id, batch_id, script_name, source, notion_page_id,
             target_table, target_id, status, error_message)
        VALUES
            (gen_random_uuid(), %s, %s, 'notion_export', %s,
             %s, %s, %s, %s)
        """,
        (str(batch_id), script_name, notion_page_id,
         target_table, str(target_id) if target_id else None, status, error_message),
    )


async def upsert_client(
    conn: psycopg.AsyncConnection[Any],
    row: dict[str, Any],
    batch_id: uuid.UUID,
    dry_run: bool,
) -> uuid.UUID | None:
    """
    Inserta o actualiza un cliente.
    PII (full_name, email, phone) cifrados con pgp_sym_encrypt.
    Idempotente vía ON CONFLICT (notion_page_id).
    """
    notion_id = row.get("notion_page_id") or None
    full_name = row.get("full_name") or ""
    if not full_name:
        log.warning("cliente_sin_nombre", notion_id=notion_id)
        return None

    pgkey = settings.CLINICAL_DB_PGCRYPTO_KEY

    if dry_run:
        log.info("[dry-run] cliente", notion_id=notion_id, nombre=full_name[:20])
        return uuid.uuid4()   # ID ficticio para dry-run

    # Parsear JSON de emociones
    predominant_emotions = row.get("predominant_emotions")
    if isinstance(predominant_emotions, str) and predominant_emotions:
        try:
            predominant_emotions = json.loads(predominant_emotions)
        except json.JSONDecodeError:
            predominant_emotions = None

    email = row.get("email") or None
    phone = row.get("phone") or None
    emo_json = json.dumps(predominant_emotions) if predominant_emotions else None

    async with conn.cursor(row_factory=dict_row) as cur:
        await cur.execute(
            """
            INSERT INTO clients (
                id,
                full_name,
                email,
                phone,
                birth_date,
                birth_place,
                residence_place,
                marital_status,
                profession,
                num_children,
                num_siblings,
                birth_order,
                predominant_emotions,
                family_abortions,
                deaths_before_41,
                important_notes,
                motivation_general,
                notion_page_id,
                migration_batch_id
            ) VALUES (
                gen_random_uuid(),
                pgp_sym_encrypt(%s, %s),
                CASE WHEN %s IS NOT NULL THEN pgp_sym_encrypt(%s, %s) ELSE NULL END,
                CASE WHEN %s IS NOT NULL THEN pgp_sym_encrypt(%s, %s) ELSE NULL END,
                %s, %s, %s,
                %s::marital_status_enum,
                %s,
                %s, %s, %s,
                %s::jsonb,
                %s, %s, %s, %s,
                %s, %s
            )
            ON CONFLICT (notion_page_id) DO UPDATE SET
                full_name           = pgp_sym_encrypt(%s, %s),
                email               = CASE WHEN %s IS NOT NULL THEN pgp_sym_encrypt(%s, %s) ELSE NULL END,
                phone               = CASE WHEN %s IS NOT NULL THEN pgp_sym_encrypt(%s, %s) ELSE NULL END,
                birth_date          = EXCLUDED.birth_date,
                birth_place         = EXCLUDED.birth_place,
                residence_place     = EXCLUDED.residence_place,
                marital_status      = EXCLUDED.marital_status,
                profession          = EXCLUDED.profession,
                num_children        = EXCLUDED.num_children,
                num_siblings        = EXCLUDED.num_siblings,
                birth_order         = EXCLUDED.birth_order,
                predominant_emotions = EXCLUDED.predominant_emotions,
                family_abortions    = EXCLUDED.family_abortions,
                deaths_before_41    = EXCLUDED.deaths_before_41,
                important_notes     = EXCLUDED.important_notes,
                motivation_general  = EXCLUDED.motivation_general,
                updated_at          = now()
            RETURNING id
            """,
            (
                # ── INSERT ────────────────────────────────────────────
                full_name, pgkey,                        # full_name
                email, email, pgkey,                     # email CASE WHEN
                phone, phone, pgkey,                     # phone CASE WHEN
                row.get("birth_date"),
                row.get("birth_place"),
                row.get("residence_place"),
                row.get("marital_status"),
                row.get("profession"),
                row.get("num_children"),
                row.get("num_siblings"),
                row.get("birth_order"),
                emo_json,
                row.get("family_abortions"),
                row.get("deaths_before_41"),
                row.get("important_notes"),
                row.get("motivation_general"),
                notion_id,
                str(batch_id),
                # ── ON CONFLICT DO UPDATE (re-pasar plaintext PII) ───
                full_name, pgkey,                        # full_name
                email, email, pgkey,                     # email CASE WHEN
                phone, phone, pgkey,                     # phone CASE WHEN
            ),
        )
        result = await cur.fetchone()

    if result:
        client_id = uuid.UUID(str(result["id"]))
        log.debug("cliente_migrado", notion_id=notion_id, client_id=str(client_id))
        return client_id
    return None


async def insert_conditions(
    conn: psycopg.AsyncConnection[Any],
    client_id: uuid.UUID,
    conditions_path: Path,
    dry_run: bool,
) -> int:
    """Inserta condiciones médicas desde Padecimientos.csv."""
    if not conditions_path.exists():
        return 0
    df = pd.read_csv(conditions_path, dtype=str, keep_default_na=False)
    count = 0
    for _, row in df.iterrows():
        desc = str(row.get("Descripción", row.get("Description", ""))).strip()
        tipo_raw = str(row.get("Tipo", row.get("Type", "médico"))).strip().lower()
        tipo = CONDITION_TYPE_MAP.get(tipo_raw, "medical")
        if not desc:
            continue
        if dry_run:
            count += 1
            continue
        await conn.execute(
            """
            INSERT INTO client_conditions (id, client_id, condition_type, description)
            VALUES (gen_random_uuid(), %s, %s::condition_type_enum, %s)
            ON CONFLICT DO NOTHING
            """,
            (str(client_id), tipo, desc),
        )
        count += 1
    return count


async def insert_medications(
    conn: psycopg.AsyncConnection[Any],
    client_id: uuid.UUID,
    meds_path: Path,
    dry_run: bool,
) -> int:
    """Inserta medicamentos desde Medicamentos.csv."""
    if not meds_path.exists():
        return 0
    df = pd.read_csv(meds_path, dtype=str, keep_default_na=False)
    count = 0
    for _, row in df.iterrows():
        name = str(row.get("Medicamento", row.get("Nombre", ""))).strip()
        notes = str(row.get("Notas", row.get("Notes", ""))).strip() or None
        if not name:
            continue
        if dry_run:
            count += 1
            continue
        await conn.execute(
            """
            INSERT INTO client_medications (id, client_id, name, notes)
            VALUES (gen_random_uuid(), %s, %s, %s)
            ON CONFLICT DO NOTHING
            """,
            (str(client_id), name, notes),
        )
        count += 1
    return count


async def insert_sleep(
    conn: psycopg.AsyncConnection[Any],
    client_id: uuid.UUID,
    sleep_path: Path,
    dry_run: bool,
) -> bool:
    """Inserta hábitos de sueño desde Sueño.csv."""
    if not sleep_path.exists():
        return False
    df = pd.read_csv(sleep_path, dtype=str, keep_default_na=False)
    if df.empty:
        return False
    row = df.iloc[0]
    hrs_raw = str(row.get("Horas", row.get("Horas de sueño", ""))).strip()
    qual_raw = str(row.get("Calidad", row.get("Calidad de sueño", ""))).strip().lower()
    try:
        hrs: int | None = int(float(hrs_raw)) if hrs_raw else None
    except ValueError:
        hrs = None
    quality = SLEEP_QUALITY_MAP.get(qual_raw, None)
    if dry_run:
        return True
    await conn.execute(
        """
        INSERT INTO client_sleep (id, client_id, avg_hours, quality)
        VALUES (gen_random_uuid(), %s, %s, %s::sleep_quality_enum)
        ON CONFLICT (client_id) DO UPDATE SET
            avg_hours = EXCLUDED.avg_hours,
            quality   = EXCLUDED.quality
        """,
        (str(client_id), hrs, quality),
    )
    return True


async def insert_family(
    conn: psycopg.AsyncConnection[Any],
    client_id: uuid.UUID,
    family_path: Path,
    dry_run: bool,
) -> int:
    """Inserta descripción familiar desde Familia.csv."""
    if not family_path.exists():
        return 0
    df = pd.read_csv(family_path, dtype=str, keep_default_na=False)
    count = 0
    for _, row in df.iterrows():
        tipo_raw = str(row.get("Tipo", "nuclear")).strip().lower()
        tipo = FAMILY_TYPE_MAP.get(tipo_raw, "nuclear")
        desc = str(row.get("Descripción", row.get("Description", ""))).strip()
        if not desc:
            continue
        if dry_run:
            count += 1
            continue
        await conn.execute(
            """
            INSERT INTO family_members (id, client_id, family_type, description)
            VALUES (gen_random_uuid(), %s, %s::family_type_enum, %s)
            """,
            (str(client_id), tipo, desc),
        )
        count += 1
    return count


# ══════════════════════════════════════════════════════════════
# Orquestador principal
# ══════════════════════════════════════════════════════════════

async def migrate_clients(batch_id: uuid.UUID, dry_run: bool) -> None:
    clean_path = Path(settings.DATA_CLEAN_DIR) / "clients_clean.csv"
    raw_dir = Path(settings.DATA_RAW_DIR)
    clients_sub_dir = raw_dir / "Clientes"   # sub-carpetas por cliente

    if not clean_path.exists():
        log.error("csv_no_encontrado", path=str(clean_path))
        log.error("ejecuta_normalize_primero")
        sys.exit(1)

    df = pd.read_csv(clean_path, dtype=str, keep_default_na=False)
    total = len(df)
    ok = error = skipped = 0

    log.info(
        "iniciando_migracion_clientes",
        total=total,
        batch_id=str(batch_id),
        dry_run=dry_run,
    )

    db_url = settings.CLINICAL_DATABASE_URL
    # psycopg3 async connection (no pool — script de un sólo uso)
    async with await psycopg.AsyncConnection.connect(db_url) as conn:
        for idx, row in df.iterrows():
            notion_id = str(row.get("notion_page_id", "")).strip() or None
            full_name = str(row.get("full_name", "")).strip()

            if not full_name:
                log.warning("fila_sin_nombre", idx=idx)
                skipped += 1
                continue

            try:
                async with conn.transaction():
                    client_id = await upsert_client(conn, row.to_dict(), batch_id, dry_run)
                    if client_id is None:
                        skipped += 1
                        continue

                    # Sub-carpeta del cliente (por notion_page_id)
                    sub_dir = clients_sub_dir / notion_id if notion_id else None
                    if sub_dir and sub_dir.exists():
                        n_cond = await insert_conditions(
                            conn, client_id, sub_dir / "Padecimientos.csv", dry_run
                        )
                        n_meds = await insert_medications(
                            conn, client_id, sub_dir / "Medicamentos.csv", dry_run
                        )
                        await insert_sleep(conn, client_id, sub_dir / "Sueño.csv", dry_run)
                        await insert_family(conn, client_id, sub_dir / "Familia.csv", dry_run)
                        log.debug(
                            "sub_tablas_insertadas",
                            client_id=str(client_id),
                            condiciones=n_cond,
                            medicamentos=n_meds,
                        )

                    if not dry_run:
                        await log_migration(
                            conn, batch_id, "migrate_clients.py",
                            notion_id, "clients", client_id, "success",
                        )
                    ok += 1

            except Exception as exc:
                log.error(
                    "error_migrando_cliente",
                    notion_id=notion_id,
                    nombre=full_name[:30],
                    error=str(exc),
                )
                if not dry_run:
                    try:
                        async with conn.transaction():
                            await log_migration(
                                conn, batch_id, "migrate_clients.py",
                                notion_id, "clients", None, "error", str(exc),
                            )
                    except Exception:
                        pass
                error += 1

    log.info(
        "migracion_clientes_completada",
        ok=ok, error=error, skipped=skipped, total=total,
        dry_run=dry_run,
    )


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Migración de clientes Notion → SDC")
    p.add_argument("--batch-id", type=str, default=None, help="UUID del batch (auto si omitido)")
    p.add_argument("--dry-run", action="store_true", help="No escribe en BD")
    return p.parse_args()


if __name__ == "__main__":
    args = parse_args()
    batch_id = uuid.UUID(args.batch_id) if args.batch_id else uuid.uuid4()
    log.info("batch_id", value=str(batch_id))
    asyncio.run(migrate_clients(batch_id, args.dry_run))
