"""
Fase 3-B: Migración de clientes Notion → clinical_db.

Prerrequisito: normalize.py completado (data/clean/clients_clean.json existe).

Fuente: archivos .md individuales ya normalizados por normalize.py.
  - No hay sub-CSVs (Padecimientos.csv, etc. no existen en el export real).
  - Todos los datos de intake están en el JSON producido por normalize.py.

Tablas destino:
  - clients            (PII: full_name, email, phone cifrados con pgcrypto)
  - client_conditions  (medical_conditions + recurrent_diseases del JSON)
  - client_medications (campo medications, separado por comas)
  - client_sleep       (sleep_hours + sleep_quality del JSON)

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

# ── Mapeos Notion → enum de BD ─────────────────────────────────

# normalize.py produce valores en español; la BD usa inglés
MARITAL_STATUS_DB_MAP: dict[str, str] = {
    "casado": "married",
    "soltero": "single",
    "divorciado": "divorced",
    "viudo": "widowed",
    "union_libre": "common_law",
    "separado": "other",
}

# normalize.py produce: good / fair / poor; BD: good / regular / bad
SLEEP_QUALITY_DB_MAP: dict[str, str] = {
    "good": "good",
    "fair": "regular",
    "poor": "bad",
}


# ══════════════════════════════════════════════════════════════
# Helpers
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


# ══════════════════════════════════════════════════════════════
# Inserción de cliente principal
# ══════════════════════════════════════════════════════════════

async def upsert_client(
    conn: psycopg.AsyncConnection[Any],
    record: dict[str, Any],
    batch_id: uuid.UUID,
    dry_run: bool,
) -> uuid.UUID | None:
    """
    Inserta o actualiza un cliente.
    PII (full_name, email, phone) cifrados con pgp_sym_encrypt.
    Idempotente vía ON CONFLICT (notion_page_id).
    """
    notion_id = record.get("notion_page_id") or None
    full_name = (record.get("full_name") or "").strip()
    if not full_name:
        log.warning("cliente_sin_nombre", notion_id=notion_id)
        return None

    if dry_run:
        log.info("[dry-run] cliente", notion_id=notion_id, nombre=full_name[:30])
        return uuid.uuid4()

    pgkey = settings.CLINICAL_DB_PGCRYPTO_KEY

    email = record.get("email") or None
    phone = record.get("phone") or None

    # Mapear marital_status español → enum BD
    ms_raw = (record.get("marital_status") or "").strip().lower()
    marital_status = MARITAL_STATUS_DB_MAP.get(ms_raw) or None

    # JSONB: predominant_emotions y motivation_visit son listas
    emotions_list = record.get("predominant_emotions") or []
    emotions_json = json.dumps(emotions_list) if emotions_list else None

    motivation_list = record.get("motivation_visit") or []
    motivation_json = json.dumps(motivation_list) if motivation_list else None

    async with conn.cursor(row_factory=dict_row) as cur:
        await cur.execute(
            """
            INSERT INTO clients (
                id,
                full_name, email, phone,
                birth_date, birth_place, residence_place,
                marital_status, profession,
                num_children, num_siblings, birth_order,
                predominant_emotions,
                family_abortions, deaths_before_41, important_notes,
                family_nuclear_desc, family_current_desc,
                is_animal,
                motivation_visit, motivation_general,
                notion_page_id, migration_batch_id
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
                %s, %s, %s,
                %s, %s,
                FALSE,
                %s::jsonb, %s,
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
                family_nuclear_desc = EXCLUDED.family_nuclear_desc,
                family_current_desc = EXCLUDED.family_current_desc,
                motivation_visit    = EXCLUDED.motivation_visit,
                motivation_general  = EXCLUDED.motivation_general,
                updated_at          = now()
            RETURNING id
            """,
            (
                # INSERT
                full_name, pgkey,
                email, email, pgkey,
                phone, phone, pgkey,
                record.get("birth_date"),
                record.get("birth_place"),
                record.get("residence_place"),
                marital_status,
                record.get("profession"),
                record.get("num_children"),
                record.get("num_siblings"),
                record.get("birth_order"),
                emotions_json,
                record.get("family_abortions"),
                record.get("deaths_before_41"),
                record.get("important_notes"),
                record.get("family_nuclear_desc"),
                record.get("family_current_desc"),
                motivation_json,
                record.get("motivation_general"),
                notion_id,
                str(batch_id),
                # ON CONFLICT DO UPDATE
                full_name, pgkey,
                email, email, pgkey,
                phone, phone, pgkey,
            ),
        )
        result = await cur.fetchone()

    if result:
        client_id = uuid.UUID(str(result["id"]))
        log.debug("cliente_migrado", notion_id=notion_id, client_id=str(client_id))
        return client_id
    return None


# ══════════════════════════════════════════════════════════════
# Sub-tablas (datos del JSON, no de CSVs externos)
# ══════════════════════════════════════════════════════════════

async def insert_conditions(
    conn: psycopg.AsyncConnection[Any],
    client_id: uuid.UUID,
    record: dict[str, Any],
    dry_run: bool,
) -> int:
    """
    Inserta condiciones médicas desde medical_conditions y recurrent_diseases del JSON.
    medical_conditions → condition_type='medical'
    recurrent_diseases → condition_type='recurring_disease'
    """
    count = 0
    pairs: list[tuple[str, str]] = []

    for desc in record.get("medical_conditions") or []:
        if desc.strip():
            pairs.append((desc.strip(), "medical"))

    for desc in record.get("recurrent_diseases") or []:
        if desc.strip():
            pairs.append((desc.strip(), "recurring_disease"))

    for desc, ctype in pairs:
        if dry_run:
            count += 1
            continue
        await conn.execute(
            """
            INSERT INTO client_conditions (id, client_id, condition_type, description)
            VALUES (gen_random_uuid(), %s, %s::condition_type_enum, %s)
            ON CONFLICT DO NOTHING
            """,
            (str(client_id), ctype, desc),
        )
        count += 1

    return count


async def insert_medications(
    conn: psycopg.AsyncConnection[Any],
    client_id: uuid.UUID,
    record: dict[str, Any],
    dry_run: bool,
) -> int:
    """
    Inserta medicamentos desde el campo medications (string separado por comas).
    """
    meds_raw = record.get("medications") or ""
    count = 0

    for med in (m.strip() for m in meds_raw.split(",") if m.strip()):
        if dry_run:
            count += 1
            continue
        await conn.execute(
            """
            INSERT INTO client_medications (id, client_id, name)
            VALUES (gen_random_uuid(), %s, %s)
            ON CONFLICT DO NOTHING
            """,
            (str(client_id), med),
        )
        count += 1

    return count


async def insert_sleep(
    conn: psycopg.AsyncConnection[Any],
    client_id: uuid.UUID,
    record: dict[str, Any],
    dry_run: bool,
) -> bool:
    """Inserta hábitos de sueño desde sleep_hours y sleep_quality del JSON."""
    sleep_hours = record.get("sleep_hours")
    sq_raw = (record.get("sleep_quality") or "").strip().lower()
    quality = SLEEP_QUALITY_DB_MAP.get(sq_raw) or None

    if sleep_hours is None and quality is None:
        return False

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
        (str(client_id), sleep_hours, quality),
    )
    return True


# ══════════════════════════════════════════════════════════════
# Orquestador principal
# ══════════════════════════════════════════════════════════════

async def migrate_clients(batch_id: uuid.UUID, dry_run: bool) -> None:
    clean_path = Path(settings.DATA_CLEAN_DIR) / "clients_clean.json"

    if not clean_path.exists():
        log.error("json_no_encontrado", path=str(clean_path))
        log.error("ejecuta_normalize_primero")
        sys.exit(1)

    with open(clean_path, encoding="utf-8") as f:
        records: list[dict[str, Any]] = json.load(f)

    total = len(records)
    ok = error = skipped = 0

    log.info(
        "iniciando_migracion_clientes",
        total=total,
        batch_id=str(batch_id),
        dry_run=dry_run,
    )

    db_url = settings.CLINICAL_DATABASE_URL
    async with await psycopg.AsyncConnection.connect(db_url) as conn:
        for record in records:
            notion_id = record.get("notion_page_id") or None
            full_name = (record.get("full_name") or "").strip()

            if not full_name or record.get("is_placeholder"):
                log.warning("fila_sin_nombre_o_placeholder", notion_id=notion_id)
                skipped += 1
                continue

            try:
                async with conn.transaction():
                    client_id = await upsert_client(conn, record, batch_id, dry_run)
                    if client_id is None:
                        skipped += 1
                        continue

                    n_cond = await insert_conditions(conn, client_id, record, dry_run)
                    n_meds = await insert_medications(conn, client_id, record, dry_run)
                    has_sleep = await insert_sleep(conn, client_id, record, dry_run)

                    log.debug(
                        "sub_tablas_insertadas",
                        client_id=str(client_id),
                        condiciones=n_cond,
                        medicamentos=n_meds,
                        sueño=has_sleep,
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
