"""
Fase 3-C: Migración de sesiones Notion → clinical_db.

Prerrequisitos:
  1. normalize.py  completado (data/clean/sessions_clean.csv)
  2. migrate_clients.py completado (clientes con notion_page_id en BD)

Tablas destino:
  - sessions
  - session_energy_readings  (9 dimensiones activas)
  - session_chakra_readings  (chakras 1-7, escala 0-14)
  - session_cleaning_events  (sub-carpeta Limpiezas.csv)
  - session_lnt              (sub-carpeta LNT.csv)
  - session_affectations     (sub-carpeta Afectaciones.csv)
  - session_organs           (sub-carpetas ColumnaVertebral.csv, Organos.csv)

Sub-carpetas esperadas en DATA_RAW_DIR/Sesiones/{notion_page_id}/:
  - Afectaciones.csv
  - LNT.csv
  - Limpiezas.csv
  - Organos.csv
  - ColumnaVertebral.csv

Uso:
  python migrate_sessions.py [--batch-id UUID] [--dry-run]
"""
import argparse
import asyncio
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
from migrate_clients import log_migration

structlog.configure(
    wrapper_class=structlog.make_filtering_bound_logger(
        getattr(logging, settings.LOG_LEVEL, logging.INFO)
    ),
)
log = structlog.get_logger(__name__)

# ── Dimensiones energéticas (orden = display_order en BD) ─────
# Las dimensiones se resuelven por nombre desde energy_dimensions.
ENERGY_DIMENSION_COLS: list[tuple[str, str, str]] = [
    # (col_inicial, col_final, nombre_en_bd)
    ("dim_vibracion_i",      "dim_vibracion_f",      "Vibración"),
    ("dim_masculina_i",      "dim_masculina_f",       "Masculina"),
    ("dim_femenina_i",       "dim_femenina_f",        "Femenina"),
    ("dim_fisica_i",         "dim_fisica_f",          "Física"),
    ("dim_psiquica_i",       "dim_psiquica_f",        "Psíquica"),
    ("dim_abundancia_i",     "dim_abundancia_f",      "Abundancia"),
    ("dim_prosperidad_i",    "dim_prosperidad_f",     "Prosperidad"),
    ("dim_relacion_dinero_i","dim_relacion_dinero_f", "Relación c/Dinero"),
    ("dim_polucion_i",       "dim_polucion_f",        "Polución"),
]

# ── Columnas de chakras en sessions_clean.csv ─────────────────
CHAKRA_COLS: list[tuple[int, str, str]] = [
    (n, f"chakra_{n}_i", f"chakra_{n}_f") for n in range(1, 8)
]

# ── Sub-tablas LNT: mapeo columnas ────────────────────────────
LNT_COL_MAP: dict[str, str] = {
    "Tema/Órgano": "theme_organ",
    "Tema": "theme_organ",
    "N.E. Inicial": "initial_energy",
    "N.E. Final": "final_energy",
    "Sanación cuerpo energético": "healing_energy_body",
    "Sanación cuerpo espiritual": "healing_spiritual_body",
    "Sanación cuerpo físico": "healing_physical_body",
}

# ── Sub-tablas Afectaciones: mapeo columnas ───────────────────
AFECT_COL_MAP: dict[str, str] = {
    "Chakra": "chakra_position",
    "Órgano/Glándula": "organ_gland",
    "Tipo de afectación": "affectation_type",
    "Energía Inicial": "initial_energy",
    "Energía Final": "final_energy",
    "Edad Adulto": "adult_age",
    "Edad Infancia": "child_age",
    "Tema Adultez": "adult_theme",
    "Tema Infancia": "child_theme",
}

# ── Sub-tablas Limpiezas: mapeo columnas ──────────────────────
CLEAN_COL_MAP: dict[str, str] = {
    "Capa": "layer",
    "Cantidad": "quantity",
    "Color de aura": "aura_color",
    "Limpiezas requeridas": "cleanings_required",
    "Manifestación": "manifestation",
    "Materiales utilizados": "materials_used",
    "Momento de creación": "creation_moment",
    "Nivel energético": "energy_level",
    "Origen": "origin",
    "Persona": "person",
    "Trabajos realizados": "work_done",
    "Área de vida": "life_area",
}

# ── Sub-tablas Órganos/Columna Vertebral ──────────────────────
ORGAN_COL_MAP: dict[str, str] = {
    "Órgano": "name",
    "Nombre": "name",
    "N.E. Inicial": "initial_energy",
    "N.E. Final": "final_energy",
    "Edad Adulto": "adult_age",
    "Edad Infancia": "child_age",
    "Tema Adultez": "adult_theme",
    "Tema Infancia": "child_theme",
    "Emociones": "emotions",
    "Zona": "name",   # para columna vertebral
}


# ══════════════════════════════════════════════════════════════
# Cache de IDs (evita queries repetidas)
# ══════════════════════════════════════════════════════════════

async def load_lookups(conn: psycopg.AsyncConnection[Any]) -> dict[str, Any]:
    """
    Carga en memoria los catálogos necesarios para resolver FKs.
    Retorna dict con 'energy_dims', 'chakras', 'therapy_types', 'clients'.
    """
    async with conn.cursor(row_factory=dict_row) as cur:
        # Energy dimensions: nombre → id
        await cur.execute("SELECT id, name FROM energy_dimensions WHERE is_active = true")
        energy_dims: dict[str, uuid.UUID] = {
            r["name"]: r["id"] for r in await cur.fetchall()
        }

        # Chakra positions: position → id
        await cur.execute("SELECT id, position FROM chakra_positions ORDER BY position")
        chakras: dict[int, uuid.UUID] = {
            r["position"]: r["id"] for r in await cur.fetchall()
        }

        # Therapy types: nombre → id
        await cur.execute("SELECT id, name FROM therapy_types")
        therapy_types: dict[str, uuid.UUID] = {
            r["name"].lower(): r["id"] for r in await cur.fetchall()
        }

        # Clients: notion_page_id → id
        await cur.execute("SELECT id, notion_page_id FROM clients WHERE notion_page_id IS NOT NULL")
        clients: dict[str, uuid.UUID] = {
            r["notion_page_id"]: r["id"] for r in await cur.fetchall()
        }

    log.info(
        "lookups_cargados",
        energy_dims=len(energy_dims),
        chakras=len(chakras),
        therapy_types=len(therapy_types),
        clients=len(clients),
    )
    return {
        "energy_dims": energy_dims,
        "chakras": chakras,
        "therapy_types": therapy_types,
        "clients": clients,
    }


def _to_bool(val: Any) -> bool | None:
    if not val or str(val).strip() in ("", "nan", "None"):
        return None
    return str(val).strip().lower() in ("sí", "si", "yes", "true", "1", "x", "✓")


def _to_float(val: Any) -> float | None:
    if not val or str(val).strip() in ("", "nan", "None"):
        return None
    try:
        return float(str(val).replace(",", "."))
    except ValueError:
        return None


def _to_int(val: Any) -> int | None:
    f = _to_float(val)
    return int(f) if f is not None else None


# ══════════════════════════════════════════════════════════════
# Inserción de sesión principal
# ══════════════════════════════════════════════════════════════

async def upsert_session(
    conn: psycopg.AsyncConnection[Any],
    row: dict[str, Any],
    lookups: dict[str, Any],
    batch_id: uuid.UUID,
    dry_run: bool,
) -> uuid.UUID | None:
    notion_id = str(row.get("notion_page_id", "")).strip() or None

    # Resolver client_id por nombre del cliente (sessions_clean.csv no tiene notion_client_id)
    client_id: uuid.UUID | None = None
    client_name = str(row.get("client_name", "")).strip()
    if client_name:
            # Búsqueda por pgcrypto decrypt — solo si el cliente tiene datos
            async with conn.cursor(row_factory=dict_row) as cur:
                await cur.execute(
                    """
                    SELECT id FROM clients
                    WHERE pgp_sym_decrypt(full_name::bytea, %s) ILIKE %s
                      AND deleted_at IS NULL
                    LIMIT 1
                    """,
                    (settings.CLINICAL_DB_PGCRYPTO_KEY, client_name),
                )
                db_row = await cur.fetchone()
                if db_row:
                    client_id = db_row["id"]

    # Resolver therapy_type_id
    therapy_raw = str(row.get("therapy_type", "")).strip().lower()
    therapy_id: uuid.UUID | None = lookups["therapy_types"].get(therapy_raw)

    measured_at = row.get("measured_at")
    if not measured_at:
        log.warning("sesion_sin_fecha", notion_id=notion_id)
        return None

    if dry_run:
        log.info("[dry-run] sesion", notion_id=notion_id)
        return uuid.uuid4()

    async with conn.cursor(row_factory=dict_row) as cur:
        await cur.execute(
            """
            INSERT INTO sessions (
                id, client_id, therapy_type_id,
                session_number, measured_at,
                general_energy_level, cost,
                entities_count, implants_count, total_cleanings,
                bud, bud_chakra, payment_notes,
                notion_page_id, migration_batch_id
            ) VALUES (
                gen_random_uuid(), %s, %s,
                %s, %s::timestamptz,
                %s, %s,
                %s, %s, %s,
                %s, %s, %s,
                %s, %s
            )
            ON CONFLICT (notion_page_id) DO UPDATE SET
                client_id           = EXCLUDED.client_id,
                therapy_type_id     = EXCLUDED.therapy_type_id,
                session_number      = EXCLUDED.session_number,
                measured_at         = EXCLUDED.measured_at,
                general_energy_level= EXCLUDED.general_energy_level,
                cost                = EXCLUDED.cost,
                entities_count      = EXCLUDED.entities_count,
                implants_count      = EXCLUDED.implants_count,
                total_cleanings     = EXCLUDED.total_cleanings,
                bud                 = EXCLUDED.bud,
                bud_chakra          = EXCLUDED.bud_chakra,
                payment_notes       = EXCLUDED.payment_notes,
                updated_at          = now()
            RETURNING id
            """,
            (
                str(client_id) if client_id else None,
                str(therapy_id) if therapy_id else None,
                _to_int(row.get("session_number")),
                measured_at,
                _to_int(row.get("general_energy_level")),
                _to_float(row.get("cost")),
                _to_int(row.get("entities_count")),
                _to_int(row.get("implants_count")),
                _to_int(row.get("total_cleanings")),
                row.get("bud") or None,
                row.get("bud_chakra") or None,
                row.get("payment_notes") or None,
                notion_id,
                str(batch_id),
            ),
        )
        result = await cur.fetchone()

    if result:
        return uuid.UUID(str(result["id"]))
    return None


# ══════════════════════════════════════════════════════════════
# Energy readings
# ══════════════════════════════════════════════════════════════

async def insert_energy_readings(
    conn: psycopg.AsyncConnection[Any],
    session_id: uuid.UUID,
    row: dict[str, Any],
    lookups: dict[str, Any],
    dry_run: bool,
) -> int:
    count = 0
    for col_i, col_f, dim_name in ENERGY_DIMENSION_COLS:
        dim_id = lookups["energy_dims"].get(dim_name)
        if not dim_id:
            continue
        initial = _to_float(row.get(col_i))
        final = _to_float(row.get(col_f))
        if initial is None and final is None:
            continue
        if dry_run:
            count += 1
            continue
        await conn.execute(
            """
            INSERT INTO session_energy_readings
                (id, session_id, dimension_id, initial_value, final_value)
            VALUES (gen_random_uuid(), %s, %s, %s, %s)
            ON CONFLICT (session_id, dimension_id) DO UPDATE SET
                initial_value = EXCLUDED.initial_value,
                final_value   = EXCLUDED.final_value
            """,
            (str(session_id), str(dim_id), initial, final),
        )
        count += 1
    return count


# ══════════════════════════════════════════════════════════════
# Chakra readings
# ══════════════════════════════════════════════════════════════

async def insert_chakra_readings(
    conn: psycopg.AsyncConnection[Any],
    session_id: uuid.UUID,
    row: dict[str, Any],
    lookups: dict[str, Any],
    dry_run: bool,
) -> int:
    count = 0
    for position, col_i, col_f in CHAKRA_COLS:
        chakra_id = lookups["chakras"].get(position)
        if not chakra_id:
            continue
        initial = _to_float(row.get(col_i))
        final = _to_float(row.get(col_f))
        if initial is None and final is None:
            continue
        if dry_run:
            count += 1
            continue
        await conn.execute(
            """
            INSERT INTO session_chakra_readings
                (id, session_id, chakra_position_id, initial_value, final_value)
            VALUES (gen_random_uuid(), %s, %s, %s, %s)
            ON CONFLICT (session_id, chakra_position_id) DO UPDATE SET
                initial_value = EXCLUDED.initial_value,
                final_value   = EXCLUDED.final_value
            """,
            (str(session_id), str(chakra_id), initial, final),
        )
        count += 1
    return count


# ══════════════════════════════════════════════════════════════
# Sub-CSV parsers
# ══════════════════════════════════════════════════════════════

async def insert_lnt(
    conn: psycopg.AsyncConnection[Any],
    session_id: uuid.UUID,
    csv_path: Path,
    dry_run: bool,
) -> int:
    if not csv_path.exists():
        return 0
    df = pd.read_csv(csv_path, dtype=str, keep_default_na=False)
    df = df.rename(columns={k: v for k, v in LNT_COL_MAP.items() if k in df.columns})
    count = 0
    for _, row in df.iterrows():
        theme = str(row.get("theme_organ", "")).strip() or None
        if dry_run:
            count += 1
            continue
        await conn.execute(
            """
            INSERT INTO session_lnt (
                id, session_id, theme_organ,
                initial_energy, final_energy,
                healing_energy_body, healing_spiritual_body, healing_physical_body
            ) VALUES (gen_random_uuid(), %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                str(session_id), theme,
                _to_float(row.get("initial_energy")),
                _to_float(row.get("final_energy")),
                _to_bool(row.get("healing_energy_body")),
                _to_bool(row.get("healing_spiritual_body")),
                _to_bool(row.get("healing_physical_body")),
            ),
        )
        count += 1
    return count


async def insert_affectations(
    conn: psycopg.AsyncConnection[Any],
    session_id: uuid.UUID,
    csv_path: Path,
    lookups: dict[str, Any],
    dry_run: bool,
) -> int:
    if not csv_path.exists():
        return 0
    df = pd.read_csv(csv_path, dtype=str, keep_default_na=False)
    df = df.rename(columns={k: v for k, v in AFECT_COL_MAP.items() if k in df.columns})
    count = 0
    for _, row in df.iterrows():
        # Resolver chakra_position_id
        chakra_raw = str(row.get("chakra_position", "")).strip()
        chakra_id: uuid.UUID | None = None
        if chakra_raw and chakra_raw.isdigit():
            chakra_id = lookups["chakras"].get(int(chakra_raw))
        if dry_run:
            count += 1
            continue
        await conn.execute(
            """
            INSERT INTO session_affectations (
                id, session_id, chakra_position_id,
                organ_gland, affectation_type,
                initial_energy, final_energy,
                adult_age, child_age, adult_theme, child_theme
            ) VALUES (gen_random_uuid(), %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                str(session_id),
                str(chakra_id) if chakra_id else None,
                str(row.get("organ_gland", "")).strip() or None,
                str(row.get("affectation_type", "")).strip() or None,
                _to_float(row.get("initial_energy")),
                _to_float(row.get("final_energy")),
                _to_int(row.get("adult_age")),
                _to_int(row.get("child_age")),
                str(row.get("adult_theme", "")).strip() or None,
                str(row.get("child_theme", "")).strip() or None,
            ),
        )
        count += 1
    return count


async def insert_cleaning_events(
    conn: psycopg.AsyncConnection[Any],
    session_id: uuid.UUID,
    csv_path: Path,
    dry_run: bool,
) -> int:
    if not csv_path.exists():
        return 0
    df = pd.read_csv(csv_path, dtype=str, keep_default_na=False)
    df = df.rename(columns={k: v for k, v in CLEAN_COL_MAP.items() if k in df.columns})
    count = 0
    for _, row in df.iterrows():
        if dry_run:
            count += 1
            continue
        await conn.execute(
            """
            INSERT INTO session_cleaning_events (
                id, session_id, layer, quantity, aura_color,
                cleanings_required, manifestation, materials_used,
                creation_moment, energy_level, origin, person,
                work_done, life_area
            ) VALUES (gen_random_uuid(), %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                str(session_id),
                str(row.get("layer", "")).strip() or None,
                _to_int(row.get("quantity")),
                str(row.get("aura_color", "")).strip() or None,
                _to_int(row.get("cleanings_required")),
                str(row.get("manifestation", "")).strip() or None,
                str(row.get("materials_used", "")).strip() or None,
                str(row.get("creation_moment", "")).strip() or None,
                _to_float(row.get("energy_level")),
                str(row.get("origin", "")).strip() or None,
                str(row.get("person", "")).strip() or None,
                str(row.get("work_done", "")).strip() or None,
                str(row.get("life_area", "")).strip() or None,
            ),
        )
        count += 1
    return count


async def insert_organs(
    conn: psycopg.AsyncConnection[Any],
    session_id: uuid.UUID,
    csv_path: Path,
    source_type: str,   # "organ" | "spine"
    dry_run: bool,
) -> int:
    if not csv_path.exists():
        return 0
    df = pd.read_csv(csv_path, dtype=str, keep_default_na=False)
    df = df.rename(columns={k: v for k, v in ORGAN_COL_MAP.items() if k in df.columns})
    count = 0
    for _, row in df.iterrows():
        if dry_run:
            count += 1
            continue
        await conn.execute(
            """
            INSERT INTO session_organs (
                id, session_id, source_type, name,
                initial_energy, final_energy,
                adult_age, child_age, adult_theme, child_theme, emotions
            ) VALUES (
                gen_random_uuid(), %s, %s::organ_source_type_enum, %s,
                %s, %s, %s, %s, %s, %s, %s
            )
            """,
            (
                str(session_id), source_type,
                str(row.get("name", "")).strip() or None,
                _to_float(row.get("initial_energy")),
                _to_float(row.get("final_energy")),
                _to_int(row.get("adult_age")),
                _to_int(row.get("child_age")),
                str(row.get("adult_theme", "")).strip() or None,
                str(row.get("child_theme", "")).strip() or None,
                str(row.get("emotions", "")).strip() or None,
            ),
        )
        count += 1
    return count


# ══════════════════════════════════════════════════════════════
# Orquestador principal
# ══════════════════════════════════════════════════════════════

async def migrate_sessions(batch_id: uuid.UUID, dry_run: bool) -> None:
    clean_path = Path(settings.DATA_CLEAN_DIR) / "sessions_clean.csv"
    sessions_sub_dir = Path(settings.DATA_RAW_DIR) / "Sesiones"

    if not clean_path.exists():
        log.error("csv_no_encontrado", path=str(clean_path))
        sys.exit(1)

    df = pd.read_csv(clean_path, dtype=str, keep_default_na=False)
    total = len(df)
    ok = error = skipped = 0

    db_url = settings.CLINICAL_DATABASE_URL
    async with await psycopg.AsyncConnection.connect(db_url) as conn:
        # Cargar lookups una sola vez
        lookups = await load_lookups(conn)

        log.info(
            "iniciando_migracion_sesiones",
            total=total,
            batch_id=str(batch_id),
            dry_run=dry_run,
        )

        for _, row in df.iterrows():
            notion_id = str(row.get("notion_page_id", "")).strip() or None
            try:
                async with conn.transaction():
                    session_id = await upsert_session(conn, row.to_dict(), lookups, batch_id, dry_run)
                    if session_id is None:
                        skipped += 1
                        continue

                    # Energy readings (del CSV principal)
                    n_energy = await insert_energy_readings(conn, session_id, row.to_dict(), lookups, dry_run)

                    # Chakra readings (del CSV principal)
                    n_chakra = await insert_chakra_readings(conn, session_id, row.to_dict(), lookups, dry_run)

                    # Sub-CSVs de la carpeta de sesión
                    sub_dir = sessions_sub_dir / notion_id if notion_id else None
                    n_lnt = n_afect = n_clean = n_organs = 0

                    if sub_dir and sub_dir.exists():
                        n_lnt = await insert_lnt(conn, session_id, sub_dir / "LNT.csv", dry_run)
                        n_afect = await insert_affectations(
                            conn, session_id, sub_dir / "Afectaciones.csv", lookups, dry_run
                        )
                        n_clean = await insert_cleaning_events(
                            conn, session_id, sub_dir / "Limpiezas.csv", dry_run
                        )
                        n_organs += await insert_organs(
                            conn, session_id, sub_dir / "Organos.csv", "organ", dry_run
                        )
                        n_organs += await insert_organs(
                            conn, session_id, sub_dir / "ColumnaVertebral.csv", "spine", dry_run
                        )

                    log.debug(
                        "sesion_migrada",
                        notion_id=notion_id,
                        energy=n_energy,
                        chakra=n_chakra,
                        lnt=n_lnt,
                        afect=n_afect,
                        clean=n_clean,
                        organs=n_organs,
                    )

                    if not dry_run:
                        await log_migration(
                            conn, batch_id, "migrate_sessions.py",
                            notion_id, "sessions", session_id, "success",
                        )
                    ok += 1

            except Exception as exc:
                log.error("error_migrando_sesion", notion_id=notion_id, error=str(exc))
                if not dry_run:
                    try:
                        async with conn.transaction():
                            await log_migration(
                                conn, batch_id, "migrate_sessions.py",
                                notion_id, "sessions", None, "error", str(exc),
                            )
                    except Exception:
                        pass
                error += 1

    log.info(
        "migracion_sesiones_completada",
        ok=ok, error=error, skipped=skipped, total=total,
        dry_run=dry_run,
    )


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Migración de sesiones Notion → SDC")
    p.add_argument("--batch-id", type=str, default=None)
    p.add_argument("--dry-run", action="store_true")
    return p.parse_args()


if __name__ == "__main__":
    args = parse_args()
    batch_id = uuid.UUID(args.batch_id) if args.batch_id else uuid.uuid4()
    log.info("batch_id", value=str(batch_id))
    asyncio.run(migrate_sessions(batch_id, args.dry_run))
