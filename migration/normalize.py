"""
normalize.py — Sanando desde el Corazón: Notion Export Normalizer

Reads raw Notion exports (2 ZIPs already extracted) and produces:
  output/clients_clean.json          Clean client records ready for migration
  output/sessions_clean.json         Clean session records ready for migration
  output/outliers_report.json        Values outside valid ranges (for manual review)
  output/duplicates_candidates.json  Possible duplicate clients (for Sanando to confirm)
  output/birth_date_errors.json      Suspicious birth dates
  output/outliers_para_sanando.md    Human-readable outlier report for Sanando

Usage:
  python normalize.py --clients-dir ./export_2_data --sessions-dir ./export_1_data --output ./output

Requires: Python 3.12+, no external dependencies.
"""

from __future__ import annotations

import argparse
import csv
import json
import re
import sys
import unicodedata
from dataclasses import asdict, dataclass, field
from datetime import date, datetime
from pathlib import Path
from typing import Any

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

MONTHS_ES: dict[str, int] = {
    "enero": 1,
    "febrero": 2,
    "marzo": 3,
    "abril": 4,
    "mayo": 5,
    "junio": 6,
    "julio": 7,
    "agosto": 8,
    "septiembre": 9,
    "octubre": 10,
    "noviembre": 11,
    "diciembre": 12,
}

MARITAL_STATUS_MAP: dict[str, str] = {
    "casada/o": "casado",
    "casado": "casado",
    "casada": "casado",
    "soltera/o": "soltero",
    "soltero": "soltero",
    "soltera": "soltero",
    "divorciada/o": "divorciado",
    "divorciado": "divorciado",
    "divorciada": "divorciado",
    "viuda/o": "viudo",
    "viudo": "viudo",
    "viuda": "viudo",
    "unión libre": "union_libre",
    "union libre": "union_libre",
    "separada/o": "separado",
    "separado": "separado",
    "separada": "separado",
}

SLEEP_QUALITY_MAP: dict[str, str] = {
    "buena": "good",
    "regular": "fair",
    "mala": "poor",
}

# Chakra columns in the session CSV (initial values)
CHAKRA_COLS_INITIAL: list[str] = [
    "Primer Chakra",
    "Segundo Chakra",
    "Tercer Chakra",
    "Cuarto Chakra",
    "Quinto Chakra",
    "Sexto Chakra",
    "Séptimo Chakra",
]

# Chakra columns (final values)
CHAKRA_COLS_FINAL: list[str] = [
    "Primer Chakra - F",
    "Segundo Chakra - F",
    "Tercer Chakra - F",
    "Cuarto Chakra - F",
    "Quinto Chakra - F",
    "Sexto Chakra - F",
    "Séptimo Chakra - F",
]

# Chakra name mapping (column → canonical name)
CHAKRA_NAMES: dict[str, str] = {
    "Primer Chakra": "raiz",
    "Segundo Chakra": "sacro",
    "Tercer Chakra": "plexo_solar",
    "Cuarto Chakra": "corazon",
    "Quinto Chakra": "garganta",
    "Sexto Chakra": "tercer_ojo",
    "Séptimo Chakra": "coronilla",
}

# Energy dimension columns (initial, final)
DIMENSION_COLS: list[tuple[str, str | None, str]] = [
    # (initial_col, final_col_or_none, dimension_name)
    ("Vibración", "Vibración Final", "vibracion"),
    ("Masculina", "Masculina Final", "masculina"),
    ("Femenina", "Femenina Final", "femenina"),
    ("Física", "Física Final", "fisica"),
    ("Psíquica", "Psíquica Final", "psiquica"),
    ("Abundancia", "Abundancia Final", "abundancia"),
    ("Prosperidad", "Prosperidad Final", "prosperidad"),
    ("Relación c/Dinero", "Relación c/Dinero Final", "relacion_dinero"),
    ("Polución", None, "polucion"),
]

MAX_CHAKRA_VALUE = 14.0
MAX_DIMENSION_PERCENT = 100

# Chakra auto-correction heuristics:
# Pattern A — no decimal point, value ÷1000 yields valid result:
#   "500" → 0.5, "1000" → 1.0, "14000" → 14.0
# Pattern B — .000 suffix but value is 10× too high:
#   "140.000" → 14.0, "130.000" → 13.0, "120.000" → 12.0, "30.000" → 3.0
CHAKRA_AUTOCORRECT_THRESHOLD = MAX_CHAKRA_VALUE

# Valores confirmados manualmente por Sanando (aplicar ANTES de la heurística).
# Clave: (nombre_cliente, fecha_sesion_iso, campo_o_tipo, fase)
# Para chakras: campo="chakras" aplica a TODOS los chakras de esa fase/sesión.
# Para dimensiones: campo=nombre de columna inicial (sin " Final").
MANUAL_OVERRIDES: dict[tuple[str, str, str, str], float] = {
    # Tanya Sesión 01 (2025-05-07): todos los chakras iniciales = 14.0
    ("Tanya Itzamara Negrete Pacheco", "2025-05-07", "chakras", "initial"): 14.0,
    # Tanya (2026-01-13): Relación c/Dinero final = 100%
    ("Tanya Itzamara Negrete Pacheco", "2026-01-13", "Relación c/Dinero", "final"): 100.0,
    # María Fernanda (2026-01-29): Física final = 100%, Psíquica final = 100%
    ("María Fernanda Trejo Aguilar", "2026-01-29", "Física", "final"): 100.0,
    ("María Fernanda Trejo Aguilar", "2026-01-29", "Psíquica", "final"): 100.0,
    # Mayte (2026-01-31): Relación c/Dinero inicial = 85%
    ("Mayte Andrea Ruiz Zúñiga", "2026-01-31", "Relación c/Dinero", "initial"): 85.0,
}

# Clientes cuya fecha de nacimiento debe ser null (errores de captura confirmados).
NULL_BIRTH_DATES: set[str] = {
    "Adriana Quintero Iñiguez",
    "Beatriz Pizarro Bernal",
    "Dolores Bernal Martinez Del Campo",
    "Elisa Margarita Vargaslugo Gaytán",
    "Fernando Pizarro Bernal",
    "Jimena Muciño Bermejo",
    "Jose Eduardo Campos",
    "Joshua Emanuel Vega cruz",
    "José Gerardo López Mergold",
    "María Eugenia Gricelda Zepeda López",
    "Noe Lugo Sánchez",
}

# ---------------------------------------------------------------------------
# Date parsing
# ---------------------------------------------------------------------------

_DATE_RE = re.compile(
    r"(\d{1,2})\s+de\s+(\w+)\s+de\s+(\d{4})(?:\s+(\d{1,2}):(\d{2}))?",
    re.IGNORECASE,
)


def parse_spanish_date(raw: str) -> datetime | None:
    """Parse '27 de enero de 2026 11:27' → datetime. Returns None on failure."""
    raw = raw.strip()
    if not raw:
        return None
    m = _DATE_RE.search(raw)
    if not m:
        return None
    day = int(m.group(1))
    month_name = m.group(2).lower()
    year = int(m.group(3))
    hour = int(m.group(4)) if m.group(4) else 0
    minute = int(m.group(5)) if m.group(5) else 0
    month = MONTHS_ES.get(month_name)
    if month is None:
        return None
    try:
        return datetime(year, month, day, hour, minute)
    except ValueError:
        return None


def parse_spanish_date_only(raw: str) -> date | None:
    """Parse date, return date only (no time)."""
    dt = parse_spanish_date(raw)
    return dt.date() if dt else None


# ---------------------------------------------------------------------------
# Number parsing
# ---------------------------------------------------------------------------


def parse_chakra_value(raw: str) -> float | None:
    """
    Parse Notion chakra values. Format uses dot as thousands separator.

    "11.000" → 11.0
    "14.000" → 14.0
    "2.500"  → 2.5
    "0"      → 0.0
    ""       → None
    "500"    → 0.5 (likely outlier, but parse as 500.0 for now and handle in validation)
    """
    raw = raw.strip()
    if not raw:
        return None

    # Remove any non-numeric chars except dots
    cleaned = raw.replace(",", ".")

    # Strategy: if the value has multiple dots, it's thousands separators
    # e.g. "1.999.000" → treat as garbage (outlier)
    dots = cleaned.count(".")
    if dots > 1:
        # Multiple dots = thousands separator format like "1.999.000"
        # Remove all dots and try as integer
        no_dots = cleaned.replace(".", "")
        try:
            val = float(no_dots)
        except ValueError:
            return None
        return val  # Will be flagged as outlier downstream if > MAX_CHAKRA_VALUE

    if dots == 1:
        # Single dot: could be "11.000" (=11) or "2.500" (=2.5)
        parts = cleaned.split(".")
        integer_part = parts[0]
        decimal_part = parts[1]

        if decimal_part == "000":
            # Thousands separator: "11.000" → 11
            try:
                return float(integer_part)
            except ValueError:
                return None
        elif decimal_part == "500":
            # Real decimal: "2.500" → 2.5
            try:
                return float(f"{integer_part}.5")
            except ValueError:
                return None
        else:
            # Other decimal: try as-is
            try:
                return float(cleaned)
            except ValueError:
                return None

    # No dots: plain integer
    try:
        return float(cleaned)
    except ValueError:
        return None


def attempt_chakra_autocorrect(
    raw: str, parsed: float
) -> tuple[float | None, str | None]:
    """
    Attempt to auto-correct out-of-range chakra values using known patterns.

    Returns (corrected_value, explanation) or (None, None) if no heuristic applies.
    """
    if parsed <= MAX_CHAKRA_VALUE:
        return (None, None)  # Already valid

    # Pattern A: no dot in raw, value ÷1000 is valid (e.g. "500" → 0.5)
    if "." not in raw and parsed / 1000 <= MAX_CHAKRA_VALUE:
        corrected = parsed / 1000
        return (corrected, f"÷1000 → {corrected} (raw '{raw}' has no decimal point)")

    # Pattern B: .000 suffix, value ÷10 is valid (e.g. "140.000" → 14.0)
    if raw.endswith(".000") and parsed / 10 <= MAX_CHAKRA_VALUE:
        corrected = parsed / 10
        return (corrected, f"÷10 → {corrected} (likely extra zero: '{raw}')")

    # Pattern B variant: .500 suffix after ÷10 (e.g. "135.000" would be parsed as 135)
    # Already handled above since 135/10 = 13.5 ≤ 14

    return (None, None)  # Genuinely corrupt — no safe correction


def parse_percentage(raw: str) -> int | None:
    """
    Parse Notion percentage values.

    "85 %"  → 85
    "100 %" → 100
    "0,3 %" → 0  (round down)
    ""      → None
    """
    raw = raw.strip()
    if not raw:
        return None

    # Remove " %" or "%" suffix (including non-breaking space \xa0)
    cleaned = raw.replace("\xa0%", "").replace(" %", "").replace("%", "").strip()
    # Handle comma as decimal separator
    cleaned = cleaned.replace(",", ".")

    try:
        val = float(cleaned)
        return round(val)
    except ValueError:
        return None


def attempt_pct_autocorrect(raw: str, parsed: int) -> tuple[int | None, str | None]:
    """
    Attempt to auto-correct out-of-range percentage values.

    Pattern: "8000 %" likely means 80% (÷100). "1000 %" likely means 10%.
    Some Notion entries stored the value as integer × 100.
    """
    if parsed <= MAX_DIMENSION_PERCENT:
        return (None, None)

    # ÷100 heuristic: if result is in valid range
    if parsed % 100 == 0 and 0 <= parsed // 100 <= MAX_DIMENSION_PERCENT:
        corrected = parsed // 100
        return (corrected, f"÷100 → {corrected}% (raw '{raw}' is likely ×100)")

    # ÷100 with remainder (e.g. "8500" → 85)
    if 0 < parsed / 100 <= MAX_DIMENSION_PERCENT:
        corrected = round(parsed / 100)
        return (corrected, f"÷100 → {corrected}% (raw '{raw}' is likely ×100)")

    return (None, None)


def parse_cost(raw: str) -> float | None:
    """Parse session cost. '12500' → 12500.00, '' → None."""
    raw = raw.strip()
    if not raw:
        return None
    # Remove any thousands separators (shouldn't have them but just in case)
    cleaned = raw.replace(",", "").replace(" ", "")
    try:
        return float(cleaned)
    except ValueError:
        return None


def parse_int_safe(raw: str) -> int | None:
    """Parse integer safely. '' → None, '3' → 3."""
    raw = raw.strip()
    if not raw:
        return None
    try:
        return int(float(raw))
    except (ValueError, OverflowError):
        return None


# ---------------------------------------------------------------------------
# Phone normalization
# ---------------------------------------------------------------------------

_PHONE_DIGITS_RE = re.compile(r"\d+")


def normalize_phone(raw: str) -> str | None:
    """
    Normalize Mexican phone numbers to +52XXXXXXXXXX format.

    "5530449797"     → "+525530449797"
    "55 3034 7069"   → "+525530347069"
    "+525530449797"  → "+525530449797"
    ""               → None
    """
    raw = raw.strip()
    if not raw:
        return None

    # Extract all digits
    digits = "".join(_PHONE_DIGITS_RE.findall(raw))

    if not digits:
        return None

    # Already has country code
    if digits.startswith("52") and len(digits) == 12:
        return f"+{digits}"

    # 10-digit local number
    if len(digits) == 10:
        return f"+52{digits}"

    # 11 digits starting with 1 (old mobile prefix)
    if len(digits) == 11 and digits.startswith("1"):
        return f"+52{digits[1:]}"

    # Can't normalize — return original cleaned
    return raw.strip()


# ---------------------------------------------------------------------------
# Client reference parsing (from session CSV)
# ---------------------------------------------------------------------------

_NOTION_UUID_RE = re.compile(r"([0-9a-f]{32})")


def parse_client_ref(raw: str) -> tuple[str, str | None]:
    """
    Parse the Clientes field from session CSV.

    Input: 'Tanya Itzamara Negrete Pacheco (https://www.notion.so/...-1b523255a86080679ce9f41baf26d720?pvs=21)'
    Returns: ('Tanya Itzamara Negrete Pacheco', '1b523255a86080679ce9f41baf26d720')
    """
    raw = raw.strip()
    if not raw:
        return ("", None)

    # Split on first '('
    if "(" in raw:
        name_part = raw[: raw.index("(")].strip()
        url_part = raw[raw.index("(") :]
        # Extract 32-char hex UUID from URL
        m = _NOTION_UUID_RE.search(url_part)
        notion_id = m.group(1) if m else None
        return (name_part, notion_id)

    return (raw, None)


def parse_therapy_ref(raw: str) -> tuple[str, str | None]:
    """Parse Terapia Aplicada field. Same format as client ref."""
    return parse_client_ref(raw)


# ---------------------------------------------------------------------------
# Session number parsing
# ---------------------------------------------------------------------------

_SESSION_NUM_RE = re.compile(r"Sesión\s+(\d+)", re.IGNORECASE)


def parse_session_number(raw: str) -> int | None:
    """'Sesión 01' → 1, 'Sesión #' → None."""
    raw = raw.strip()
    if not raw:
        return None
    m = _SESSION_NUM_RE.search(raw)
    if m:
        return int(m.group(1))
    return None


# ---------------------------------------------------------------------------
# Client MD parser
# ---------------------------------------------------------------------------


@dataclass
class ClientRecord:
    """Normalized client record from Notion MD export."""

    source_filename: str = ""
    notion_page_id: str | None = None
    full_name: str = ""
    email: str | None = None
    phone: str | None = None
    marital_status: str | None = None
    birth_date: str | None = None  # ISO format YYYY-MM-DD
    birth_place: str | None = None
    residence_place: str | None = None
    profession: str | None = None
    created_at: str | None = None  # ISO format
    motivation_visit: list[str] = field(default_factory=list)
    motivation_general: str | None = None
    body_pains: list[str] = field(default_factory=list)
    medical_conditions: list[str] = field(default_factory=list)
    recurrent_diseases: list[str] = field(default_factory=list)
    medications: str | None = None
    num_children: int | None = None
    num_siblings: int | None = None
    birth_order: int | None = None
    predominant_emotions: list[str] = field(default_factory=list)
    family_abortions: int | None = None
    deaths_before_41: str | None = None
    important_notes: str | None = None
    family_nuclear_desc: str | None = None
    family_current_desc: str | None = None
    sleep_hours: int | None = None
    sleep_quality: str | None = None  # good | fair | poor
    is_placeholder: bool = False


def extract_notion_id_from_filename(filename: str) -> str | None:
    """Extract 32-char hex Notion page ID from filename like 'Name 1fa23255a86080ba9785fabd2e227cd0.md'."""
    m = _NOTION_UUID_RE.search(filename)
    return m.group(1) if m else None


def parse_client_md(filepath: Path) -> ClientRecord:
    """Parse a single client Markdown file into a ClientRecord."""
    content = filepath.read_text(encoding="utf-8")
    lines = content.strip().split("\n")

    record = ClientRecord(
        source_filename=filepath.name,
        notion_page_id=extract_notion_id_from_filename(filepath.name),
    )

    # First line is always "# Name" (or "# Name|" for some placeholders)
    if lines and lines[0].startswith("# "):
        name = lines[0][2:].strip().rstrip("|").strip()
        record.full_name = name
        if name.lower() == "nuevo cliente":
            record.is_placeholder = True

    # Parse key: value pairs
    field_map: dict[str, str] = {}
    for line in lines[1:]:
        line = line.strip()
        if not line or line.startswith("#") or line.startswith("---"):
            continue
        if ": " in line:
            key, _, value = line.partition(": ")
            key = key.strip()
            value = value.strip()
            if value:
                field_map[key] = value

    # Map fields to record
    if email := field_map.get("Correo electrónico"):
        record.email = email.lower().strip()

    if phone := field_map.get("Teléfono"):
        record.phone = normalize_phone(phone)

    if ms := field_map.get("Estado Civil"):
        record.marital_status = MARITAL_STATUS_MAP.get(ms.lower(), ms.lower())

    if bd := field_map.get("Fecha de Nacimiento"):
        parsed = parse_spanish_date_only(bd)
        record.birth_date = parsed.isoformat() if parsed else None

    if created := field_map.get("Fecha de creación"):
        parsed_dt = parse_spanish_date(created)
        record.created_at = parsed_dt.isoformat() if parsed_dt else None

    record.birth_place = field_map.get("Lugar de Nacimiento")
    record.residence_place = field_map.get("Lugar de Residencia")

    if prof := field_map.get("Profesión"):
        record.profession = None if prof.lower() == "otro" else prof

    # List fields (comma-separated)
    if mv := field_map.get("Motivación para venir"):
        record.motivation_visit = [s.strip() for s in mv.split(",") if s.strip()]

    record.motivation_general = field_map.get("Descripción de Motivación")

    if dp := field_map.get("Dolor en cuerpo"):
        record.body_pains = [s.strip() for s in dp.split(",") if s.strip()]

    if pm := field_map.get("Problemas médicos diagnosticados"):
        items = [s.strip() for s in pm.split(",") if s.strip()]
        record.medical_conditions = [
            i for i in items if i.lower() != "no tengo ninguna enfermedad"
        ]

    if rd := field_map.get("Enfermedades médicas recurrentes"):
        record.recurrent_diseases = [s.strip() for s in rd.split(",") if s.strip()]

    record.medications = field_map.get("Medicamentos")

    record.num_children = parse_int_safe(field_map.get("Hijos", ""))
    record.num_siblings = parse_int_safe(field_map.get("Número de hermanos", ""))
    record.birth_order = parse_int_safe(field_map.get("Número de hijo", "").strip(" :"))

    if em := field_map.get("Emociones Predominantes"):
        record.predominant_emotions = [s.strip() for s in em.split(",") if s.strip()]

    record.family_abortions = parse_int_safe(
        field_map.get("Abortos en el sistema familiar", "")
    )

    if d41 := field_map.get("Fallecimientos antes de los 41"):
        record.deaths_before_41 = None if d41.strip().upper() == "N/A" else d41

    record.important_notes = field_map.get("Notas importantes")
    record.family_nuclear_desc = field_map.get("Familia Nuclear") or field_map.get(
        "Descripción de familia nuclear"
    )
    record.family_current_desc = field_map.get("Familia Actual") or field_map.get(
        "Descripción de familia actual"
    )

    record.sleep_hours = parse_int_safe(field_map.get("Horas de sueño", ""))

    if sq := field_map.get("Calidad de sueño"):
        record.sleep_quality = SLEEP_QUALITY_MAP.get(sq.lower(), sq.lower())

    return record


# ---------------------------------------------------------------------------
# Session CSV parser
# ---------------------------------------------------------------------------


@dataclass
class OutlierRecord:
    """An outlier value detected during normalization."""

    source: str  # "session" or "client"
    record_identifier: str  # client name or session description
    field_name: str
    raw_value: str
    reason: str
    suggested_correction: float | None = (
        None  # auto-corrected value if heuristic applies
    )
    auto_corrected: bool = False  # True if heuristic was applied


@dataclass
class ChakraReading:
    chakra_name: str  # raiz, sacro, etc.
    phase: str  # initial | final
    value: float


@dataclass
class DimensionReading:
    dimension: str  # vibracion, masculina, etc.
    phase: str  # initial | final
    value: int


@dataclass
class SessionRecord:
    """Normalized session record from Notion CSV export."""

    csv_row_index: int = 0
    client_name: str = ""
    client_notion_id: str | None = None
    session_number: int | None = None
    measured_at: str | None = None  # ISO format
    therapy_name: str | None = None
    therapy_notion_id: str | None = None
    cost: float | None = None
    general_energy_level: int | None = None
    entities_count: int | None = None
    implants_count: int | None = None
    total_cleanings: int | None = None
    bud: str | None = None
    bud_chakra: str | None = None
    tables_used: str | None = None
    payment_notes: str | None = None
    chakra_readings: list[dict[str, Any]] = field(default_factory=list)
    dimension_readings: list[dict[str, Any]] = field(default_factory=list)


def normalize_sessions(
    csv_path: Path,
    outliers: list[OutlierRecord],
) -> list[SessionRecord]:
    """Parse and normalize the main session CSV."""
    records: list[SessionRecord] = []

    with open(csv_path, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row_idx, row in enumerate(reader, start=1):
            client_name, client_notion_id = parse_client_ref(row.get("Clientes", ""))
            therapy_name, therapy_notion_id = parse_therapy_ref(
                row.get("Terapia Aplicada", "")
            )

            measured_at_dt = parse_spanish_date(row.get("Fecha de Medición", ""))
            session_date = measured_at_dt.date().isoformat() if measured_at_dt else ""

            session_desc = f"{client_name} - {row.get('Sesión', '?')} ({row.get('Fecha de Medición', '?')})"

            rec = SessionRecord(
                csv_row_index=row_idx,
                client_name=client_name,
                client_notion_id=client_notion_id,
                session_number=parse_session_number(row.get("Sesión", "")),
                measured_at=measured_at_dt.isoformat() if measured_at_dt else None,
                therapy_name=therapy_name if therapy_name else None,
                therapy_notion_id=therapy_notion_id,
                cost=parse_cost(row.get("Costo", "")),
                general_energy_level=parse_int_safe(row.get("General", "")),
                entities_count=parse_int_safe(row.get("Entidades", "")),
                implants_count=parse_int_safe(row.get("Implantes", "")),
                total_cleanings=parse_int_safe(
                    row.get("Total de limpiezas", "")
                    or row.get("Limpiezas totales", "")
                ),
                bud=row.get("Bud", "").strip() or None,
                bud_chakra=row.get("Bud chakra", "").strip() or None,
                tables_used=row.get("Mesas usadas", "").strip() or None,
                payment_notes=row.get("Notas de pagos", "").strip() or None,
            )

            # --- Chakra readings ---
            for col in CHAKRA_COLS_INITIAL:
                raw = row.get(col, "").strip()
                if not raw:
                    continue
                val = parse_chakra_value(raw)
                if val is not None and val > MAX_CHAKRA_VALUE:
                    # Overrides manuales confirmados por Sanando tienen prioridad
                    override = MANUAL_OVERRIDES.get(
                        (client_name, session_date, "chakras", "initial")
                    )
                    if override is not None:
                        outliers.append(
                            OutlierRecord(
                                source="session",
                                record_identifier=session_desc,
                                field_name=f"{col} (initial)",
                                raw_value=raw,
                                reason=f"manual_override → {override} (confirmado por Sanando)",
                                suggested_correction=override,
                                auto_corrected=True,
                            )
                        )
                        val = override
                    else:
                        corrected, explanation = attempt_chakra_autocorrect(raw, val)
                        if corrected is not None:
                            outliers.append(
                                OutlierRecord(
                                    source="session",
                                    record_identifier=session_desc,
                                    field_name=f"{col} (initial)",
                                    raw_value=raw,
                                    reason=f"Chakra value {val} exceeds max {MAX_CHAKRA_VALUE}. Auto-corrected: {explanation}",
                                    suggested_correction=corrected,
                                    auto_corrected=True,
                                )
                            )
                            val = corrected  # Use the corrected value
                        else:
                            outliers.append(
                                OutlierRecord(
                                    source="session",
                                    record_identifier=session_desc,
                                    field_name=f"{col} (initial)",
                                    raw_value=raw,
                                    reason=f"Chakra value {val} exceeds max {MAX_CHAKRA_VALUE} — no safe correction",
                                )
                            )
                            val = None  # Null out genuinely corrupt values
                if val is not None:
                    rec.chakra_readings.append(
                        {
                            "chakra": CHAKRA_NAMES[col],
                            "phase": "initial",
                            "value": val,
                        }
                    )

            for col in CHAKRA_COLS_FINAL:
                raw = row.get(col, "").strip()
                if not raw:
                    continue
                base_col = col.replace(" - F", "")
                val = parse_chakra_value(raw)
                if val is not None and val > MAX_CHAKRA_VALUE:
                    override = MANUAL_OVERRIDES.get(
                        (client_name, session_date, "chakras", "final")
                    )
                    if override is not None:
                        outliers.append(
                            OutlierRecord(
                                source="session",
                                record_identifier=session_desc,
                                field_name=f"{base_col} (final)",
                                raw_value=raw,
                                reason=f"manual_override → {override} (confirmado por Sanando)",
                                suggested_correction=override,
                                auto_corrected=True,
                            )
                        )
                        val = override
                    else:
                        corrected, explanation = attempt_chakra_autocorrect(raw, val)
                        if corrected is not None:
                            outliers.append(
                                OutlierRecord(
                                    source="session",
                                    record_identifier=session_desc,
                                    field_name=f"{base_col} (final)",
                                    raw_value=raw,
                                    reason=f"Chakra value {val} exceeds max {MAX_CHAKRA_VALUE}. Auto-corrected: {explanation}",
                                    suggested_correction=corrected,
                                    auto_corrected=True,
                                )
                            )
                            val = corrected
                        else:
                            outliers.append(
                                OutlierRecord(
                                    source="session",
                                    record_identifier=session_desc,
                                    field_name=f"{base_col} (final)",
                                    raw_value=raw,
                                    reason=f"Chakra value {val} exceeds max {MAX_CHAKRA_VALUE} — no safe correction",
                                )
                            )
                            val = None
                if val is not None:
                    rec.chakra_readings.append(
                        {
                            "chakra": CHAKRA_NAMES[base_col],
                            "phase": "final",
                            "value": val,
                        }
                    )

            # --- Energy dimension readings ---
            for initial_col, final_col, dim_name in DIMENSION_COLS:
                # Initial
                raw_i = row.get(initial_col, "").strip()
                if raw_i:
                    val_i = parse_percentage(raw_i)
                    if val_i is not None and val_i > MAX_DIMENSION_PERCENT:
                        override = MANUAL_OVERRIDES.get(
                            (client_name, session_date, initial_col, "initial")
                        )
                        if override is not None:
                            outliers.append(
                                OutlierRecord(
                                    source="session",
                                    record_identifier=session_desc,
                                    field_name=f"{initial_col} (initial)",
                                    raw_value=raw_i,
                                    reason=f"manual_override → {int(override)}% (confirmado por Sanando)",
                                    suggested_correction=float(override),
                                    auto_corrected=True,
                                )
                            )
                            val_i = int(override)
                        else:
                            corrected, explanation = attempt_pct_autocorrect(raw_i, val_i)
                            if corrected is not None:
                                outliers.append(
                                    OutlierRecord(
                                        source="session",
                                        record_identifier=session_desc,
                                        field_name=f"{initial_col} (initial)",
                                        raw_value=raw_i,
                                        reason=f"Percentage {val_i}% exceeds max. Auto-corrected: {explanation}",
                                        suggested_correction=float(corrected),
                                        auto_corrected=True,
                                    )
                                )
                                val_i = corrected
                            else:
                                outliers.append(
                                    OutlierRecord(
                                        source="session",
                                        record_identifier=session_desc,
                                        field_name=f"{initial_col} (initial)",
                                        raw_value=raw_i,
                                        reason=f"Percentage {val_i}% exceeds max {MAX_DIMENSION_PERCENT}% — no safe correction",
                                    )
                                )
                                val_i = None
                    if val_i is not None:
                        rec.dimension_readings.append(
                            {
                                "dimension": dim_name,
                                "phase": "initial",
                                "value": val_i,
                            }
                        )

                # Final
                if final_col:
                    raw_f = row.get(final_col, "").strip()
                    if raw_f:
                        val_f = parse_percentage(raw_f)
                        if val_f is not None and val_f > MAX_DIMENSION_PERCENT:
                            # Usar initial_col como clave (sin " Final")
                            override = MANUAL_OVERRIDES.get(
                                (client_name, session_date, initial_col, "final")
                            )
                            if override is not None:
                                outliers.append(
                                    OutlierRecord(
                                        source="session",
                                        record_identifier=session_desc,
                                        field_name=f"{final_col} (final)",
                                        raw_value=raw_f,
                                        reason=f"manual_override → {int(override)}% (confirmado por Sanando)",
                                        suggested_correction=float(override),
                                        auto_corrected=True,
                                    )
                                )
                                val_f = int(override)
                            else:
                                corrected, explanation = attempt_pct_autocorrect(
                                    raw_f, val_f
                                )
                                if corrected is not None:
                                    outliers.append(
                                        OutlierRecord(
                                            source="session",
                                            record_identifier=session_desc,
                                            field_name=f"{final_col} (final)",
                                            raw_value=raw_f,
                                            reason=f"Percentage {val_f}% exceeds max. Auto-corrected: {explanation}",
                                            suggested_correction=float(corrected),
                                            auto_corrected=True,
                                        )
                                    )
                                    val_f = corrected
                                else:
                                    outliers.append(
                                        OutlierRecord(
                                            source="session",
                                            record_identifier=session_desc,
                                            field_name=f"{final_col} (final)",
                                            raw_value=raw_f,
                                            reason=f"Percentage {val_f}% exceeds max {MAX_DIMENSION_PERCENT}% — no safe correction",
                                        )
                                    )
                                    val_f = None
                        if val_f is not None:
                            rec.dimension_readings.append(
                                {
                                    "dimension": dim_name,
                                    "phase": "final",
                                    "value": val_f,
                                }
                            )

            records.append(rec)

    return records


# ---------------------------------------------------------------------------
# Duplicate detection
# ---------------------------------------------------------------------------


def normalize_for_comparison(name: str) -> str:
    """Normalize name for fuzzy comparison: lowercase, no accents, no extra spaces."""
    # Remove accents
    nfkd = unicodedata.normalize("NFKD", name)
    ascii_name = "".join(c for c in nfkd if not unicodedata.combining(c))
    # Lowercase, collapse whitespace
    return " ".join(ascii_name.lower().split())


def levenshtein_distance(s1: str, s2: str) -> int:
    """Simple Levenshtein distance implementation."""
    if len(s1) < len(s2):
        return levenshtein_distance(s2, s1)
    if len(s2) == 0:
        return len(s1)

    prev_row = list(range(len(s2) + 1))
    for i, c1 in enumerate(s1):
        curr_row = [i + 1]
        for j, c2 in enumerate(s2):
            insertions = prev_row[j + 1] + 1
            deletions = curr_row[j] + 1
            substitutions = prev_row[j] + (c1 != c2)
            curr_row.append(min(insertions, deletions, substitutions))
        prev_row = curr_row

    return prev_row[-1]


@dataclass
class DuplicateCandidate:
    name_a: str
    name_b: str
    notion_id_a: str | None
    notion_id_b: str | None
    distance: int
    similarity_pct: float


def detect_duplicates(
    clients: list[ClientRecord], threshold: float = 0.85
) -> list[DuplicateCandidate]:
    """Detect potential duplicate clients by name similarity."""
    candidates: list[DuplicateCandidate] = []
    normalized: list[tuple[str, ClientRecord]] = [
        (normalize_for_comparison(c.full_name), c)
        for c in clients
        if not c.is_placeholder
    ]

    for i in range(len(normalized)):
        for j in range(i + 1, len(normalized)):
            norm_a, client_a = normalized[i]
            norm_b, client_b = normalized[j]

            # Quick check: if lengths differ by more than 30%, skip
            if abs(len(norm_a) - len(norm_b)) > max(len(norm_a), len(norm_b)) * 0.3:
                continue

            dist = levenshtein_distance(norm_a, norm_b)
            max_len = max(len(norm_a), len(norm_b))
            if max_len == 0:
                continue

            similarity = 1 - (dist / max_len)

            if similarity >= threshold:
                candidates.append(
                    DuplicateCandidate(
                        name_a=client_a.full_name,
                        name_b=client_b.full_name,
                        notion_id_a=client_a.notion_page_id,
                        notion_id_b=client_b.notion_page_id,
                        distance=dist,
                        similarity_pct=round(similarity * 100, 1),
                    )
                )

    return candidates


# ---------------------------------------------------------------------------
# Birth date validation
# ---------------------------------------------------------------------------


@dataclass
class BirthDateError:
    client_name: str
    notion_id: str | None
    raw_value: str
    parsed_value: str | None
    reason: str


def validate_birth_dates(clients: list[ClientRecord]) -> list[BirthDateError]:
    """Detect suspicious birth dates."""
    errors: list[BirthDateError] = []
    today = date.today()

    for c in clients:
        if c.is_placeholder or not c.birth_date:
            continue

        try:
            bd = date.fromisoformat(c.birth_date)
        except ValueError:
            errors.append(
                BirthDateError(
                    client_name=c.full_name,
                    notion_id=c.notion_page_id,
                    raw_value=c.birth_date,
                    parsed_value=None,
                    reason="Cannot parse date",
                )
            )
            continue

        if bd > today:
            errors.append(
                BirthDateError(
                    client_name=c.full_name,
                    notion_id=c.notion_page_id,
                    raw_value=c.birth_date,
                    parsed_value=c.birth_date,
                    reason=f"Birth date is in the future ({c.birth_date})",
                )
            )
        elif bd.year > today.year - 10:
            errors.append(
                BirthDateError(
                    client_name=c.full_name,
                    notion_id=c.notion_page_id,
                    raw_value=c.birth_date,
                    parsed_value=c.birth_date,
                    reason=f"Client would be under 10 years old (born {bd.year})",
                )
            )
        elif bd.year < 1920:
            errors.append(
                BirthDateError(
                    client_name=c.full_name,
                    notion_id=c.notion_page_id,
                    raw_value=c.birth_date,
                    parsed_value=c.birth_date,
                    reason=f"Birth year {bd.year} seems too old",
                )
            )

    return errors


# ---------------------------------------------------------------------------
# Human-readable outlier report for Sanando
# ---------------------------------------------------------------------------


def generate_sanando_report(
    outliers: list[OutlierRecord],
    duplicates: list[DuplicateCandidate],
    birth_errors: list[BirthDateError],
    clients_total: int,
    clients_clean: int,
    sessions_total: int,
) -> str:
    """Generate a Markdown report for Sanando to review."""
    lines: list[str] = []
    lines.append("# Reporte de Revisión Manual — Migración Notion → SDC")
    lines.append("")
    lines.append(f"**Fecha:** {date.today().isoformat()}")
    lines.append(
        f"**Clientes procesados:** {clients_total} total, {clients_clean} válidos"
    )
    lines.append(f"**Sesiones procesadas:** {sessions_total}")
    auto_count = sum(1 for o in outliers if o.auto_corrected)
    corrupt_count = sum(1 for o in outliers if not o.auto_corrected)
    lines.append(
        f"**Outliers detectados:** {len(outliers)} total ({auto_count} auto-corregidos, {corrupt_count} sin corrección)"
    )
    lines.append(f"**Duplicados posibles:** {len(duplicates)}")
    lines.append(f"**Fechas de nacimiento sospechosas:** {len(birth_errors)}")
    lines.append(
        f"**Total registros para revisión:** {corrupt_count + len(duplicates) + len(birth_errors)} (solo los que requieren acción manual)"
    )
    lines.append("")
    lines.append("---")
    lines.append("")

    # Section 1: Outliers
    lines.append("## 1. Valores Fuera de Rango")
    lines.append("")

    auto_corrected = [o for o in outliers if o.auto_corrected]
    genuinely_corrupt = [o for o in outliers if not o.auto_corrected]

    if auto_corrected:
        lines.append("### 1a. Auto-corregidos (confirmar o corregir)")
        lines.append("")
        lines.append(
            "Estos valores estaban fuera de rango pero tienen una corrección probable."
        )
        lines.append(
            "**Se importarán con el valor sugerido a menos que Sanando indique lo contrario.**"
        )
        lines.append("")

        # Group by pattern for cleaner reading
        by_pattern: dict[str, list[OutlierRecord]] = {}
        for o in auto_corrected:
            if "manual_override" in o.reason:
                by_pattern.setdefault("manual_override", []).append(o)
            elif "÷1000" in o.reason:
                by_pattern.setdefault("÷1000", []).append(o)
            elif "÷10" in o.reason:
                by_pattern.setdefault("÷10", []).append(o)
            elif "÷100" in o.reason:
                by_pattern.setdefault("÷100", []).append(o)
            else:
                by_pattern.setdefault("otro", []).append(o)

        for pattern, items in by_pattern.items():
            sessions_affected = set(o.record_identifier for o in items)
            lines.append(
                f"**Patrón {pattern}** ({len(items)} lecturas en {len(sessions_affected)} sesiones):"
            )
            lines.append("")
            if pattern == "manual_override":
                lines.append(
                    "Valores confirmados manualmente por Sanando — importados con el valor indicado:"
                )
            elif pattern == "÷1000":
                lines.append(
                    "Valores como `500` que probablemente significan `0.5` en la escala 0-14:"
                )
            elif pattern == "÷100":
                lines.append(
                    "Valores como `500` que probablemente significan `5.0` en la escala 0-14:"
                )
            elif pattern == "÷10":
                lines.append(
                    "Valores como `140.000` que probablemente tienen un cero de más:"
                )
            lines.append("")

            # Show first few examples
            shown = 0
            for session_desc in sorted(sessions_affected):
                if shown >= 5:
                    remaining = len(sessions_affected) - 5
                    lines.append(
                        f"- *(... y {remaining} sesiones más con el mismo patrón)*"
                    )
                    break
                session_items = [
                    o for o in items if o.record_identifier == session_desc
                ]
                corrections = ", ".join(
                    f"{o.field_name}: `{o.raw_value}` → **{o.suggested_correction}**"
                    for o in session_items
                )
                lines.append(f"- {session_desc[:70]}")
                lines.append(f"  {corrections}")
                shown += 1
            lines.append("")
            lines.append(
                "**ACCIÓN:** ¿Aceptar las correcciones automáticas o indicar valores correctos?"
            )
            lines.append("")

    if genuinely_corrupt:
        lines.append("### 1b. Sin corrección posible (requieren valor manual)")
        lines.append("")
        lines.append("Estos valores no se pueden corregir automáticamente.")
        lines.append(
            "**Se importarán como vacío (null) a menos que Sanando proporcione el valor correcto.**"
        )
        lines.append("")

        by_session: dict[str, list[OutlierRecord]] = {}
        for o in genuinely_corrupt:
            by_session.setdefault(o.record_identifier, []).append(o)

        for session_desc, items in by_session.items():
            lines.append(f"**{session_desc}**")
            for item in items:
                lines.append(f"- {item.field_name}: `{item.raw_value}` — {item.reason}")
            lines.append(
                "- **ACCIÓN:** Indicar valores correctos o confirmar que se descarten."
            )
            lines.append("")

    if not auto_corrected and not genuinely_corrupt:
        lines.append("No se encontraron valores fuera de rango.")
        lines.append("")

    # Section 2: Duplicates
    lines.append("## 2. Posibles Clientes Duplicados")
    lines.append("")
    if duplicates:
        lines.append(
            "Los siguientes pares de nombres son muy similares y podrían ser la misma persona."
        )
        lines.append(
            "Por favor confirmar si son duplicados (unificar) o personas diferentes (mantener separados)."
        )
        lines.append("")
        for i, d in enumerate(duplicates, 1):
            lines.append(f"**Par {i}:** ({d.similarity_pct}% similitud)")
            lines.append(f"- A: {d.name_a}")
            lines.append(f"- B: {d.name_b}")
            lines.append("- **ACCIÓN:** ¿Unificar o mantener separados?")
            lines.append("")
    else:
        lines.append("No se detectaron posibles duplicados.")
        lines.append("")

    # Section 3: Birth dates
    lines.append("## 3. Fechas de Nacimiento Sospechosas")
    lines.append("")
    if birth_errors:
        lines.append("Las siguientes fechas de nacimiento parecen incorrectas.")
        lines.append("")
        for be in birth_errors:
            lines.append(
                f"- **{be.client_name}:** {be.parsed_value or be.raw_value} — {be.reason}"
            )
        lines.append("")
        lines.append("**ACCIÓN:** Indicar la fecha correcta para cada uno.")
    else:
        lines.append("Todas las fechas de nacimiento son razonables.")

    lines.append("")
    lines.append("---")
    lines.append("")
    lines.append("*Por favor responder este documento indicando las correcciones.*")
    lines.append(
        "*Los registros no corregidos se importarán con valor vacío en los campos afectados.*"
    )

    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def find_session_csv(sessions_dir: Path) -> Path | None:
    """Find the main session CSV in the export directory."""
    # It's at: {dir}/Privado y Compartido/Medición Energética *.csv
    candidates = list(sessions_dir.rglob("Medición Energética *.csv"))
    # Filter out sub-CSVs (they're inside session folders)
    root_csvs = [c for c in candidates if c.parent.name in ("Privado y Compartido",)]
    if root_csvs:
        return root_csvs[0]
    # Fallback: find the largest CSV at depth 2
    if candidates:
        return max(candidates, key=lambda p: p.stat().st_size)
    return None


def find_client_mds(clients_dir: Path) -> list[Path]:
    """Find all client MD files at root level of Clientes/."""
    clientes_dir = None
    for candidate in clients_dir.rglob("Clientes"):
        if candidate.is_dir():
            clientes_dir = candidate
            break

    if not clientes_dir:
        print(
            f"ERROR: Could not find 'Clientes' directory in {clients_dir}",
            file=sys.stderr,
        )
        return []

    # Root-level MDs only (not inside sub-folders)
    return sorted(clientes_dir.glob("*.md"))


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Normalize Notion exports for SDC migration"
    )
    parser.add_argument(
        "--clients-dir",
        type=Path,
        required=True,
        help="Path to extracted Export 2 (Clientes)",
    )
    parser.add_argument(
        "--sessions-dir",
        type=Path,
        required=True,
        help="Path to extracted Export 1 (Sesiones)",
    )
    parser.add_argument(
        "--output", type=Path, default=Path("output"), help="Output directory"
    )
    args = parser.parse_args()

    output_dir: Path = args.output
    output_dir.mkdir(parents=True, exist_ok=True)

    print("=" * 70)
    print("  Sanando desde el Corazón — Notion Export Normalizer")
    print("=" * 70)
    print()

    # -----------------------------------------------------------------------
    # 1. Parse clients
    # -----------------------------------------------------------------------
    print("[1/5] Parsing client MD files...")
    client_mds = find_client_mds(args.clients_dir)
    print(f"      Found {len(client_mds)} client files")

    all_clients: list[ClientRecord] = []
    for md_path in client_mds:
        record = parse_client_md(md_path)
        all_clients.append(record)

    placeholders = [c for c in all_clients if c.is_placeholder]
    clean_clients = [c for c in all_clients if not c.is_placeholder]

    print(f"      Placeholders ('Nuevo Cliente') discarded: {len(placeholders)}")
    print(f"      Valid clients: {len(clean_clients)}")

    # Nullificar fechas de nacimiento incorrectas confirmadas por Sanando
    nullified_births = 0
    for c in clean_clients:
        if c.full_name in NULL_BIRTH_DATES and c.birth_date is not None:
            c.birth_date = None
            nullified_births += 1
    if nullified_births:
        print(f"      Birth dates nullified (confirmed errors): {nullified_births}")

    # Merge duplicado Mauricio Jair/Jaur Palacios Ruiz
    _JAUR = "Mauricio Jaur Palacios Ruiz"
    _JAIR = "Mauricio Jair Palacios Ruiz"
    jaur_records = [c for c in clean_clients if c.full_name == _JAUR]
    jair_records = [c for c in clean_clients if c.full_name == _JAIR]
    if jaur_records and jair_records:
        jaur = jaur_records[0]
        jair = jair_records[0]
        # Para cada campo None en "Jair", rellenar con el valor de "Jaur"
        for attr in vars(jair):
            if getattr(jair, attr) is None and getattr(jaur, attr) is not None:
                setattr(jair, attr, getattr(jaur, attr))
        # Eliminar el registro "Jaur" (el typo)
        clean_clients = [c for c in clean_clients if c.full_name != _JAUR]
        print(f"      Merged duplicate: '{_JAUR}' → '{_JAIR}'")

    # Stats
    with_email = sum(1 for c in clean_clients if c.email)
    with_phone = sum(1 for c in clean_clients if c.phone)
    with_birth = sum(1 for c in clean_clients if c.birth_date)
    print(f"      With email: {with_email} ({with_email * 100 // len(clean_clients)}%)")
    print(f"      With phone: {with_phone} ({with_phone * 100 // len(clean_clients)}%)")
    print(
        f"      With birth date: {with_birth} ({with_birth * 100 // len(clean_clients)}%)"
    )
    print()

    # -----------------------------------------------------------------------
    # 2. Parse sessions
    # -----------------------------------------------------------------------
    print("[2/5] Parsing session CSV...")
    session_csv = find_session_csv(args.sessions_dir)
    if not session_csv:
        print("      ERROR: Could not find main session CSV!", file=sys.stderr)
        sys.exit(1)

    print(f"      Found: {session_csv.name}")
    outliers: list[OutlierRecord] = []
    sessions = normalize_sessions(session_csv, outliers)

    # Remap sesiones del duplicado "Jaur" al nombre correcto "Jair"
    for s in sessions:
        if s.client_name == _JAUR:
            s.client_name = _JAIR

    print(f"      Total sessions: {len(sessions)}")
    auto_corrected_count = sum(1 for o in outliers if o.auto_corrected)
    corrupt_count = sum(1 for o in outliers if not o.auto_corrected)
    print(
        f"      Outliers detected: {len(outliers)} ({auto_corrected_count} auto-corrected, {corrupt_count} genuinely corrupt)"
    )

    sessions_with_client = sum(1 for s in sessions if s.client_name)
    sessions_without = len(sessions) - sessions_with_client
    print(f"      Sessions with client: {sessions_with_client}")
    print(f"      Sessions without client: {sessions_without}")
    print()

    # -----------------------------------------------------------------------
    # 3. Detect duplicates
    # -----------------------------------------------------------------------
    print("[3/5] Detecting potential duplicate clients...")
    duplicates = detect_duplicates(clean_clients, threshold=0.82)
    print(f"      Candidates found: {len(duplicates)}")
    for d in duplicates:
        print(f"        {d.similarity_pct}%: '{d.name_a}' ↔ '{d.name_b}'")
    print()

    # -----------------------------------------------------------------------
    # 4. Validate birth dates
    # -----------------------------------------------------------------------
    print("[4/5] Validating birth dates...")
    birth_errors = validate_birth_dates(clean_clients)
    print(f"      Errors found: {len(birth_errors)}")
    for be in birth_errors:
        print(f"        {be.client_name}: {be.reason}")
    print()

    # -----------------------------------------------------------------------
    # 5. Write output files
    # -----------------------------------------------------------------------
    print("[5/5] Writing output files...")

    # clients_clean.json
    clients_out = output_dir / "clients_clean.json"
    with open(clients_out, "w", encoding="utf-8") as f:
        json.dump([asdict(c) for c in clean_clients], f, ensure_ascii=False, indent=2)
    print(f"      {clients_out.name}: {len(clean_clients)} records")

    # sessions_clean.json
    sessions_out = output_dir / "sessions_clean.json"
    with open(sessions_out, "w", encoding="utf-8") as f:
        json.dump([asdict(s) for s in sessions], f, ensure_ascii=False, indent=2)
    print(f"      {sessions_out.name}: {len(sessions)} records")

    # outliers_report.json
    outliers_out = output_dir / "outliers_report.json"
    with open(outliers_out, "w", encoding="utf-8") as f:
        json.dump([asdict(o) for o in outliers], f, ensure_ascii=False, indent=2)
    print(f"      {outliers_out.name}: {len(outliers)} records")

    # duplicates_candidates.json
    dupes_out = output_dir / "duplicates_candidates.json"
    with open(dupes_out, "w", encoding="utf-8") as f:
        json.dump([asdict(d) for d in duplicates], f, ensure_ascii=False, indent=2)
    print(f"      {dupes_out.name}: {len(duplicates)} records")

    # birth_date_errors.json
    birth_out = output_dir / "birth_date_errors.json"
    with open(birth_out, "w", encoding="utf-8") as f:
        json.dump([asdict(b) for b in birth_errors], f, ensure_ascii=False, indent=2)
    print(f"      {birth_out.name}: {len(birth_errors)} records")

    # Human-readable report for Sanando
    report_md = generate_sanando_report(
        outliers=outliers,
        duplicates=duplicates,
        birth_errors=birth_errors,
        clients_total=len(all_clients),
        clients_clean=len(clean_clients),
        sessions_total=len(sessions),
    )
    report_out = output_dir / "outliers_para_sanando.md"
    with open(report_out, "w", encoding="utf-8") as f:
        f.write(report_md)
    print(f"      {report_out.name}: human-readable report")

    print()
    print("=" * 70)
    print("  DONE — All output written to:", output_dir)
    print("=" * 70)
    print()
    print("Next steps:")
    print("  1. Send 'outliers_para_sanando.md' to Sanando for review")
    print("  2. Wait for their corrections on outliers + duplicates + birth dates")
    print("  3. Apply corrections and run migrate_clients.py")


if __name__ == "__main__":
    main()
