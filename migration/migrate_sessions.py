"""
Fase 3-C: Migración de sesiones Notion → clinical_db.

Prerrequisitos:
  1. normalize.py  completado (data/clean/sessions_clean.json)
  2. migrate_clients.py completado (clientes con notion_page_id en BD)

Fuente principal: sessions_clean.json (columnas reales del CSV de Notion).
  - Campo cliente: "Clientes" con formato "Nombre (URL UUID)"
  - Columnas de energía: "Vibración"/"Vibración Final", "Masculina"/"Masculina Final", etc.
  - Chakras ya normalizados en el JSON como lista chakra_readings

Sub-carpetas de sesión en Medición Energética/:
  - "Chakra Raíz {UUID}.csv"          → session_affectations (posición 1)
  - "Chakra Sacro {UUID}.csv"         → session_affectations (posición 2)
  - "Chakra Plexo Solar {UUID}.csv"   → session_affectations (posición 3)
  - "Chakra Corazón {UUID}.csv"       → session_affectations (posición 4)
  - "Chakra Garganta {UUID}.csv"      → session_affectations (posición 5)
  - "Chakra Tercer Ojo {UUID}.csv"    → session_affectations (posición 6)
  - "Chakra Corona/Coronilla {UUID}.csv" → session_affectations (posición 7)
  - "Información - Capas {UUID}.csv"  → session_cleaning_events
  - "Columna Vertebr* {UUID}.csv"     → session_topics (source_type='spine')
  - "Nivel energético * {UUID}.csv"   → session_organs (source_type='organ')
  - "Terapia LNT {UUID}.csv"          → session_lnt

Estrategia de matching de sub-carpetas:
  Los archivos .md junto a las sub-carpetas contienen el cliente y la fecha.
  Se usa {short_uuid} (primeros4 + últimos4 del UUID completo) para vincular
  la sub-carpeta con el .md, y luego con la sesión en BD por
  (client_notion_id, session_number).

Uso:
  python migrate_sessions.py [--batch-id UUID] [--dry-run]
"""
import argparse
import asyncio
import csv
import logging
import json
import re
import sys
import uuid
from pathlib import Path
from typing import Any

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

# ── Mapeo nombre de chakra (JSON) → posición numérica ─────────
CHAKRA_NAME_TO_POSITION: dict[str, int] = {
    "raiz": 1,
    "sacro": 2,
    "plexo_solar": 3,
    "corazon": 4,
    "garganta": 5,
    "tercer_ojo": 6,
    "coronilla": 7,
}

# ── Mapeo nombre de dimensión (JSON) → nombre en BD ───────────
# En el JSON, normalize.py usa nombres cortos (sin acentos, minúsculas)
DIMENSION_NAME_TO_DB: dict[str, str] = {
    "vibracion": "Vibración",
    "masculina": "Masculina",
    "femenina": "Femenina",
    "fisica": "Física",
    "psiquica": "Psíquica",
    "abundancia": "Abundancia",
    "prosperidad": "Prosperidad",
    "relacion_dinero": "Relación c/Dinero",
    "polucion": "Polución",
}

# ── Mapeo prefijo de nombre de archivo chakra → posición ──────
CHAKRA_FILE_PREFIX_TO_POSITION: list[tuple[str, int]] = [
    ("Chakra Raíz", 1),
    ("Chakra Sacro", 2),
    ("Chakra Plexo Solar", 3),
    ("Chakra Corazón", 4),
    ("Chakra Garganta", 5),
    ("Chakra Tercer Ojo", 6),
    ("Chakra Corona", 7),      # Coronilla y Corona ambos → posición 7
]

_NOTION_UUID_RE = re.compile(r"([0-9a-f]{32})", re.IGNORECASE)
_SESSION_NUM_RE = re.compile(r"[Ss]esi[oó]n\s+(\d+)", re.IGNORECASE)
_SHORT_UUID_RE = re.compile(r"([0-9a-f]{4})-([0-9a-f]{4})$", re.IGNORECASE)
_CLIENT_UUID_IN_CONTENT_RE = re.compile(
    r"Clientes:.*?([0-9a-f]{32})", re.IGNORECASE | re.DOTALL
)


# ══════════════════════════════════════════════════════════════
# Helpers de conversión
# ══════════════════════════════════════════════════════════════

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


def _read_csv_safe(path: Path) -> list[dict[str, str]]:
    """Lee un CSV ignorando errores de encoding. Descarta filas completamente vacías."""
    rows: list[dict[str, str]] = []
    try:
        with open(path, encoding="utf-8-sig", errors="replace", newline="") as fh:
            reader = csv.DictReader(fh)
            for row in reader:
                if any(v.strip() for v in row.values()):
                    rows.append(dict(row))
    except Exception as exc:
        log.warning("csv_lectura_error", path=str(path), error=str(exc))
    return rows


def _get_col(row: dict[str, str], *keys: str, default: str = "") -> str:
    """Busca la primera clave que existe en la fila (tolerante a variaciones)."""
    for k in keys:
        v = row.get(k, "").strip()
        if v:
            return v
    return default


# ══════════════════════════════════════════════════════════════
# Índice de sub-carpetas de sesión
# ══════════════════════════════════════════════════════════════

def _build_session_subfolder_index(
    sessions_base_dir: Path,
) -> tuple[dict[str, Path], dict[str, dict[str, str | int | None]]]:
    """
    Escanea el directorio de sesiones y construye dos índices:

    subfolder_index: {short_uuid → folder_path}
      Sub-carpetas con UUID abreviado al final del nombre.

    md_index: {short_uuid → {client_notion_id, session_number}}
      Información extraída de los archivos .md contiguos a las sub-carpetas.
      Cada .md tiene UUID completo en el nombre y contiene "Clientes:" con URL.
    """
    subfolder_index: dict[str, Path] = {}
    md_index: dict[str, dict[str, str | int | None]] = {}

    for item in sessions_base_dir.iterdir():
        if item.is_dir():
            m = _SHORT_UUID_RE.search(item.name)
            if m:
                short = m.group(1).lower() + "-" + m.group(2).lower()
                subfolder_index[short] = item

        elif item.suffix == ".md":
            uuid_m = _NOTION_UUID_RE.search(item.stem)
            if not uuid_m:
                continue
            full_uuid = uuid_m.group(1).lower()
            short = full_uuid[:4] + "-" + full_uuid[-4:]

            content = ""
            try:
                content = item.read_text(encoding="utf-8", errors="replace")
            except Exception:
                pass

            num_m = _SESSION_NUM_RE.search(item.stem)
            session_number: int | None = int(num_m.group(1)) if num_m else None

            client_notion_id: str | None = None
            cm = _CLIENT_UUID_IN_CONTENT_RE.search(content)
            if cm:
                client_notion_id = cm.group(1).lower()

            md_index[short] = {
                "session_number": session_number,
                "client_notion_id": client_notion_id,
            }

    return subfolder_index, md_index


def _find_chakra_position(filename: str) -> int | None:
    """Determina la posición de chakra desde el nombre del archivo CSV."""
    for prefix, position in CHAKRA_FILE_PREFIX_TO_POSITION:
        if filename.startswith(prefix) or (f"_{prefix} " in filename):
            return position
    return None


def _glob_first(folder: Path, pattern: str) -> list[Path]:
    """Retorna todos los archivos que coinciden con el patrón (excluye _all.csv)."""
    return [
        p for p in folder.glob(pattern)
        if not p.name.endswith("_all.csv") and not p.name.endswith("_all")
    ]


# ══════════════════════════════════════════════════════════════
# Cache de IDs de BD
# ══════════════════════════════════════════════════════════════

async def load_lookups(conn: psycopg.AsyncConnection[Any]) -> dict[str, Any]:
    """
    Carga catálogos en memoria para resolver FKs sin queries repetidas.
    """
    async with conn.cursor(row_factory=dict_row) as cur:
        # energy_dimensions: nombre_db → id
        await cur.execute(
            "SELECT id, name FROM energy_dimensions WHERE is_active = true"
        )
        energy_dims: dict[str, uuid.UUID] = {
            r["name"]: r["id"] for r in await cur.fetchall()
        }

        # chakra_positions: position → id
        await cur.execute("SELECT id, position FROM chakra_positions ORDER BY position")
        chakras: dict[int, uuid.UUID] = {
            r["position"]: r["id"] for r in await cur.fetchall()
        }

        # therapy_types: nombre_lower → id
        await cur.execute("SELECT id, name FROM therapy_types")
        therapy_types: dict[str, uuid.UUID] = {
            r["name"].lower(): r["id"] for r in await cur.fetchall()
        }

        # clients: notion_page_id → id
        await cur.execute(
            "SELECT id, notion_page_id FROM clients WHERE notion_page_id IS NOT NULL"
        )
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


# ══════════════════════════════════════════════════════════════
# Inserción de sesión principal
# ══════════════════════════════════════════════════════════════

async def insert_session(
    conn: psycopg.AsyncConnection[Any],
    record: dict[str, Any],
    lookups: dict[str, Any],
    batch_id: uuid.UUID,
    dry_run: bool,
) -> uuid.UUID | None:
    """
    Inserta una sesión. Retorna el UUID generado o None si se omite.
    No usa ON CONFLICT porque sessions no tiene notion_page_id en el export.
    """
    measured_at = record.get("measured_at")
    if not measured_at:
        log.warning("sesion_sin_fecha", client=record.get("client_name"))
        return None

    # Resolver client_id por client_notion_id
    client_notion_id = record.get("client_notion_id")
    client_id: uuid.UUID | None = None
    if client_notion_id:
        client_id = lookups["clients"].get(client_notion_id)
        if not client_id:
            log.warning(
                "cliente_no_encontrado",
                client_notion_id=client_notion_id,
                client_name=record.get("client_name"),
            )

    # Resolver therapy_type_id
    therapy_raw = (record.get("therapy_name") or "").strip().lower()
    therapy_id: uuid.UUID | None = lookups["therapy_types"].get(therapy_raw)

    if dry_run:
        log.info("[dry-run] sesión", cliente=record.get("client_name"), fecha=measured_at)
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
                migration_batch_id
            ) VALUES (
                gen_random_uuid(), %s, %s,
                %s, %s::timestamptz,
                %s, %s,
                %s, %s, %s,
                %s, %s, %s,
                %s
            )
            RETURNING id
            """,
            (
                str(client_id) if client_id else None,
                str(therapy_id) if therapy_id else None,
                record.get("session_number"),
                measured_at,
                record.get("general_energy_level"),
                record.get("cost"),
                record.get("entities_count"),
                record.get("implants_count"),
                record.get("total_cleanings"),
                record.get("bud") or None,
                record.get("bud_chakra") or None,
                record.get("payment_notes") or None,
                str(batch_id),
            ),
        )
        result = await cur.fetchone()

    return uuid.UUID(str(result["id"])) if result else None


# ══════════════════════════════════════════════════════════════
# Lecturas de energía y chakras (del JSON)
# ══════════════════════════════════════════════════════════════

async def insert_energy_readings(
    conn: psycopg.AsyncConnection[Any],
    session_id: uuid.UUID,
    record: dict[str, Any],
    lookups: dict[str, Any],
    dry_run: bool,
) -> int:
    """
    Inserta lecturas de dimensiones energéticas desde el JSON.
    dimension_readings: [{dimension: "vibracion", phase: "initial"|"final", value: N}]
    """
    # Agrupar por dimensión: {dim_name: {initial: v, final: v}}
    grouped: dict[str, dict[str, float]] = {}
    for reading in record.get("dimension_readings") or []:
        dim = reading.get("dimension", "")
        phase = reading.get("phase", "")
        value = reading.get("value")
        if dim and phase and value is not None:
            grouped.setdefault(dim, {})[phase] = float(value)

    count = 0
    for dim_key, values in grouped.items():
        db_name = DIMENSION_NAME_TO_DB.get(dim_key)
        if not db_name:
            continue
        dim_id = lookups["energy_dims"].get(db_name)
        if not dim_id:
            continue
        initial = values.get("initial")
        final = values.get("final")
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


async def insert_chakra_readings(
    conn: psycopg.AsyncConnection[Any],
    session_id: uuid.UUID,
    record: dict[str, Any],
    lookups: dict[str, Any],
    dry_run: bool,
) -> int:
    """
    Inserta lecturas de chakras desde el JSON.
    chakra_readings: [{chakra: "raiz", phase: "initial"|"final", value: N}]
    """
    # Agrupar por chakra_name: {name: {initial: v, final: v}}
    grouped: dict[str, dict[str, float]] = {}
    for reading in record.get("chakra_readings") or []:
        chakra = reading.get("chakra", "")
        phase = reading.get("phase", "")
        value = reading.get("value")
        if chakra and phase and value is not None:
            grouped.setdefault(chakra, {})[phase] = float(value)

    count = 0
    for chakra_name, values in grouped.items():
        position = CHAKRA_NAME_TO_POSITION.get(chakra_name)
        if position is None:
            continue
        chakra_id = lookups["chakras"].get(position)
        if not chakra_id:
            continue
        initial = values.get("initial")
        final = values.get("final")
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
# Procesamiento de sub-carpetas (datos detallados por sesión)
# ══════════════════════════════════════════════════════════════

async def insert_lnt(
    conn: psycopg.AsyncConnection[Any],
    session_id: uuid.UUID,
    folder: Path,
    dry_run: bool,
) -> int:
    """Terapia LNT {UUID}.csv → session_lnt."""
    count = 0
    for csv_path in _glob_first(folder, "Terapia LNT*.csv"):
        for row in _read_csv_safe(csv_path):
            theme = _get_col(row, "Tema / Órgano", "Tema/Órgano", "Tema") or None
            if dry_run:
                count += 1
                continue
            await conn.execute(
                """
                INSERT INTO session_lnt (
                    id, session_id, theme_organ,
                    initial_energy, final_energy,
                    healing_physical_body, healing_energy_body, healing_spiritual_body
                ) VALUES (gen_random_uuid(), %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    str(session_id), theme,
                    _to_float(_get_col(row, "N.E. Inicial", "N.E.Inicial")),
                    _to_float(_get_col(row, "N.E. Final", "N.E.Final")),
                    _to_bool(_get_col(row, "Sanación cuerpo físico")),
                    _to_bool(_get_col(row, "Sanación cuerpo energético")),
                    _to_bool(_get_col(row, "Sanación cuerpo espiritual")),
                ),
            )
            count += 1
    return count


async def insert_cleaning_events(
    conn: psycopg.AsyncConnection[Any],
    session_id: uuid.UUID,
    folder: Path,
    dry_run: bool,
) -> int:
    """Información - Capas {UUID}*.csv → session_cleaning_events."""
    count = 0
    for csv_path in _glob_first(folder, "Información - Capas*.csv"):
        for row in _read_csv_safe(csv_path):
            layer = _get_col(row, "Capa") or None
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
                    str(session_id), layer,
                    _to_int(_get_col(row, "Cantidad", "Cantidad (para entidades)")),
                    _get_col(row, "Color de aura que afecta", "Color de aura") or None,
                    _to_int(_get_col(row, "Limpiezas requeridas")),
                    _get_col(row, "Manifestación") or None,
                    _get_col(row, "Materiales utilizados") or None,
                    _get_col(row, "Momento de creación") or None,
                    _to_float(_get_col(row, "Nivel energético")),
                    _get_col(row, "Origen") or None,
                    _get_col(row, "Persona") or None,
                    _get_col(row, "Trabajos realizados") or None,
                    _get_col(row, "Área de vida que afecta", "Área de vida") or None,
                ),
            )
            count += 1
    return count


async def insert_spine_topics(
    conn: psycopg.AsyncConnection[Any],
    session_id: uuid.UUID,
    folder: Path,
    dry_run: bool,
) -> int:
    """Columna Vertebr* {UUID}.csv → session_topics (source_type='spine')."""
    count = 0
    for csv_path in _glob_first(folder, "Columna Vertebr*.csv"):
        for row in _read_csv_safe(csv_path):
            vertebra_id = _get_col(row, "ID") or None
            zone_raw = _get_col(row, "Zona") or None
            # Combina ID + Zona para el campo zone
            zone = f"{vertebra_id} ({zone_raw})" if vertebra_id and zone_raw else vertebra_id or zone_raw
            if dry_run:
                count += 1
                continue
            await conn.execute(
                """
                INSERT INTO session_topics (
                    id, session_id, source_type, zone,
                    initial_energy,
                    adult_age, adult_theme,
                    child_age, child_theme,
                    emotions
                ) VALUES (
                    gen_random_uuid(), %s, 'spine'::organ_source_type_enum, %s,
                    %s, %s, %s, %s, %s, %s
                )
                """,
                (
                    str(session_id), zone,
                    _to_float(_get_col(row, "Energía")),
                    _to_int(_get_col(row, "Edad Adultez", "Edad Adulto")),
                    _get_col(row, "Tema Adultez", "Tema Adulto") or None,
                    _to_int(_get_col(row, "Edad Infancia")),
                    _get_col(row, "Tema Infancia") or None,
                    _get_col(row, "Emociones") or None,
                ),
            )
            count += 1
    return count


async def insert_organ_levels(
    conn: psycopg.AsyncConnection[Any],
    session_id: uuid.UUID,
    folder: Path,
    dry_run: bool,
) -> int:
    """Nivel energético * {UUID}.csv → session_organs (source_type='organ')."""
    count = 0
    for csv_path in _glob_first(folder, "Nivel energético*.csv"):
        for row in _read_csv_safe(csv_path):
            name = _get_col(row, "Órgano o tema", "Tema / órgano", "Tema/Órgano") or None
            if dry_run:
                count += 1
                continue
            await conn.execute(
                """
                INSERT INTO session_organs (
                    id, session_id, source_type, name,
                    initial_energy, final_energy
                ) VALUES (
                    gen_random_uuid(), %s, 'organ'::organ_source_type_enum, %s,
                    %s, %s
                )
                """,
                (
                    str(session_id), name,
                    _to_float(_get_col(row, "Inicio")),
                    _to_float(_get_col(row, "Final")),
                ),
            )
            count += 1
    return count


async def insert_chakra_affectations(
    conn: psycopg.AsyncConnection[Any],
    session_id: uuid.UUID,
    folder: Path,
    lookups: dict[str, Any],
    dry_run: bool,
) -> int:
    """
    Chakra {nombre} {UUID}.csv → session_affectations.
    También maneja el formato "Sin título {UUID}_Chakra {nombre} {UUID}.csv".
    """
    count = 0
    # Recopilar todos los CSVs de chakra en la carpeta (incluyendo sub-carpetas de chakra)
    csv_files: list[tuple[Path, int | None]] = []

    for csv_path in folder.rglob("*.csv"):
        if csv_path.name.endswith("_all.csv"):
            continue
        position = _find_chakra_position(csv_path.name)
        if position is not None:
            csv_files.append((csv_path, position))

    for csv_path, position in csv_files:
        chakra_id = lookups["chakras"].get(position) if position else None

        for row in _read_csv_safe(csv_path):
            afect_type = _get_col(row, "Tipo de afectación") or None
            if dry_run:
                count += 1
                continue
            await conn.execute(
                """
                INSERT INTO session_affectations (
                    id, session_id, chakra_position_id,
                    organ_gland, affectation_type,
                    initial_energy, final_energy,
                    adult_age, adult_theme,
                    child_age, child_theme
                ) VALUES (gen_random_uuid(), %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    str(session_id),
                    str(chakra_id) if chakra_id else None,
                    _get_col(row, "Órgano / Glándula", "Órgano/Glándula") or None,
                    afect_type,
                    _to_float(_get_col(row, "Energía")),
                    None,  # final_energy no está en el CSV de chakras
                    _to_int(_get_col(row, "Edad Adulto")),
                    _get_col(row, "Tema Adultez", "Tema Adulto") or None,
                    _to_int(_get_col(row, "Edad Infancia")),
                    _get_col(row, "Tema Infancia") or None,
                ),
            )
            count += 1
    return count


async def process_subfolder(
    conn: psycopg.AsyncConnection[Any],
    session_id: uuid.UUID,
    folder: Path,
    lookups: dict[str, Any],
    dry_run: bool,
) -> dict[str, int]:
    """Procesa todos los sub-CSVs de una carpeta de sesión."""
    n_lnt = await insert_lnt(conn, session_id, folder, dry_run)
    n_clean = await insert_cleaning_events(conn, session_id, folder, dry_run)
    n_spine = await insert_spine_topics(conn, session_id, folder, dry_run)
    n_organs = await insert_organ_levels(conn, session_id, folder, dry_run)
    n_afect = await insert_chakra_affectations(conn, session_id, folder, lookups, dry_run)
    return {
        "lnt": n_lnt, "cleaning": n_clean, "spine": n_spine,
        "organs": n_organs, "affectations": n_afect,
    }


# ══════════════════════════════════════════════════════════════
# Orquestador principal
# ══════════════════════════════════════════════════════════════

async def build_registry_from_db(
    conn: psycopg.AsyncConnection[Any],
) -> dict[tuple[str | None, int | None], uuid.UUID]:
    """
    Reconstruye session_registry desde la BD para --subfolders-only.
    JOIN sessions → clients para recuperar client.notion_page_id.
    """
    async with conn.cursor(row_factory=dict_row) as cur:
        await cur.execute(
            """
            SELECT s.id, s.session_number, c.notion_page_id
            FROM sessions s
            LEFT JOIN clients c ON c.id = s.client_id
            """
        )
        rows = await cur.fetchall()
    registry: dict[tuple[str | None, int | None], uuid.UUID] = {}
    for r in rows:
        key = (r["notion_page_id"], r["session_number"])
        registry[key] = r["id"]
    log.info("registry_reconstruido_desde_bd", sesiones=len(registry))
    return registry


async def migrate_sessions(batch_id: uuid.UUID, dry_run: bool, subfolders_only: bool = False) -> None:
    clean_path = Path(settings.DATA_CLEAN_DIR) / "sessions_clean.json"

    if not clean_path.exists():
        log.error("json_no_encontrado", path=str(clean_path))
        sys.exit(1)

    with open(clean_path, encoding="utf-8") as f:
        records: list[dict[str, Any]] = json.load(f)

    total = len(records)
    ok = error = skipped = 0

    # Directorio de sub-carpetas de sesión
    sessions_base = (
        Path(settings.DATA_RAW_DIR)
        / "sesiones"
        / "Privado y Compartido"
        / "Medición Energética"
    )
    if not sessions_base.exists():
        log.warning("directorio_sesiones_no_encontrado", path=str(sessions_base))

    db_url = settings.CLINICAL_DATABASE_URL
    async with await psycopg.AsyncConnection.connect(db_url) as conn:
        lookups = await load_lookups(conn)

        log.info(
            "iniciando_migracion_sesiones",
            total=total,
            batch_id=str(batch_id),
            dry_run=dry_run,
            subfolders_only=subfolders_only,
        )

        # ── Fase 1: Insertar sesiones principales ─────────────
        # session_registry: (client_notion_id, session_number) → session_db_id
        session_registry: dict[tuple[str | None, int | None], uuid.UUID] = {}

        if subfolders_only:
            # Reconstruir registry desde BD — no insertar sesiones nuevas
            session_registry = await build_registry_from_db(conn)
            ok = skipped = error = 0
        else:
            for record in records:
                client_notion_id = record.get("client_notion_id")
                session_number = record.get("session_number")

                try:
                    async with conn.transaction():
                        session_id = await insert_session(
                            conn, record, lookups, batch_id, dry_run
                        )
                        if session_id is None:
                            skipped += 1
                            continue

                        n_energy = await insert_energy_readings(
                            conn, session_id, record, lookups, dry_run
                        )
                        n_chakra = await insert_chakra_readings(
                            conn, session_id, record, lookups, dry_run
                        )

                        log.debug(
                            "sesion_insertada",
                            client=record.get("client_name"),
                            sesion=session_number,
                            energy=n_energy,
                            chakra=n_chakra,
                        )

                        if not dry_run:
                            await log_migration(
                                conn, batch_id, "migrate_sessions.py",
                                None, "sessions", session_id, "success",
                            )

                        session_registry[(client_notion_id, session_number)] = session_id
                        ok += 1

                except Exception as exc:
                    log.error(
                        "error_migrando_sesion",
                        client=record.get("client_name"),
                        sesion=session_number,
                        error=str(exc),
                    )
                    if not dry_run:
                        try:
                            async with conn.transaction():
                                await log_migration(
                                    conn, batch_id, "migrate_sessions.py",
                                    None, "sessions", None, "error", str(exc),
                                )
                        except Exception:
                            pass
                    error += 1

            log.info(
                "fase1_completada",
                ok=ok, error=error, skipped=skipped,
            )

        # ── Fase 2: Procesar sub-carpetas ─────────────────────
        if not sessions_base.exists():
            log.warning("saltando_subfolderes_directorio_inexistente")
            return

        subfolder_index, md_index = _build_session_subfolder_index(sessions_base)
        log.info(
            "indices_construidos",
            subfolders=len(subfolder_index),
            md_files=len(md_index),
        )

        subfolder_ok = subfolder_skip = subfolder_error = 0

        for short_uuid, folder in subfolder_index.items():
            md_info = md_index.get(short_uuid)
            if not md_info:
                log.debug("subfolder_sin_md", short_uuid=short_uuid, folder=folder.name)
                subfolder_skip += 1
                continue

            client_notion_id = md_info.get("client_notion_id")
            session_number = md_info.get("session_number")
            key = (client_notion_id, session_number)

            session_id = session_registry.get(key)
            if not session_id:
                log.debug(
                    "subfolder_sin_sesion_en_bd",
                    short_uuid=short_uuid,
                    client_notion_id=client_notion_id,
                    session_number=session_number,
                )
                subfolder_skip += 1
                continue

            try:
                async with conn.transaction():
                    counts = await process_subfolder(
                        conn, session_id, folder, lookups, dry_run
                    )
                    log.debug(
                        "subfolder_procesado",
                        folder=folder.name,
                        **counts,
                    )
                    subfolder_ok += 1

            except Exception as exc:
                log.error(
                    "error_subfolder",
                    folder=folder.name,
                    error=str(exc),
                )
                subfolder_error += 1

        log.info(
            "migracion_sesiones_completada",
            sesiones_ok=ok,
            sesiones_error=error,
            sesiones_skipped=skipped,
            subfolder_ok=subfolder_ok,
            subfolder_skip=subfolder_skip,
            subfolder_error=subfolder_error,
            dry_run=dry_run,
        )


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Migración de sesiones Notion → SDC")
    p.add_argument("--batch-id", type=str, default=None)
    p.add_argument("--dry-run", action="store_true")
    p.add_argument(
        "--subfolders-only",
        action="store_true",
        help="Saltar Fase 1 (sesiones) y solo re-procesar sub-carpetas usando BD existente",
    )
    return p.parse_args()


if __name__ == "__main__":
    args = parse_args()
    batch_id = uuid.UUID(args.batch_id) if args.batch_id else uuid.uuid4()
    log.info("batch_id", value=str(batch_id))
    asyncio.run(migrate_sessions(batch_id, args.dry_run, args.subfolders_only))
