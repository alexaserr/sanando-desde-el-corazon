"""
Fase 3-A: Normalización de CSVs exportados de Notion.

INPUT  (DATA_RAW_DIR):
  - Sesiones.csv          → 782 filas, 45 columnas
  - Clientes.csv          → 418 filas (lista de clientes)
  - Clientes/{nombre}/   → sub-carpetas con CSVs de sesión detallados

OUTPUT (DATA_CLEAN_DIR):
  - sessions_clean.csv
  - clients_clean.csv
  - outliers_report.csv   → valores fuera de rango marcados como null
  - duplicates_report.csv → posibles clientes duplicados

Ejecutar antes que cualquier script de migración:
  python normalize.py

Reglas:
  - Chakras 0-14: valores > 14 → null, formato "11.000" → 11.0
  - Energía 0-100: valores > 100 → null
  - Fechas en español: "15 de enero de 2025" o ISO 8601
  - Teléfonos MX: 10 dígitos → "+52XXXXXXXXXX"
  - "Nuevo Cliente" (7 filas) → descartar
  - 2 sesiones sin cliente → mantener con notion_client_id vacío
  - Fechas nacimiento futuras o < 18 años → marcar para revisión manual
"""
import csv
import json
import logging
import re
import sys
from dataclasses import dataclass
from datetime import date, datetime
from pathlib import Path
from typing import Any

import pandas as pd
import structlog

from config import settings

# Configurar logging
structlog.configure(
    wrapper_class=structlog.make_filtering_bound_logger(
        getattr(logging, settings.LOG_LEVEL, logging.INFO)
    ),
)
log = structlog.get_logger(__name__)

# ── Mapeo de meses español → número ──────────────────────────
_MES_MAP: dict[str, int] = {
    "enero": 1, "febrero": 2, "marzo": 3, "abril": 4,
    "mayo": 5, "junio": 6, "julio": 7, "agosto": 8,
    "septiembre": 9, "octubre": 10, "noviembre": 11, "diciembre": 12,
}

# ── Mapeo de columnas CSV Notion → nombre interno ─────────────
# NOTE: Ajustar según el export real de Notion si difieren.
SESSION_COLUMN_MAP: dict[str, str] = {
    # Identificación
    "ID": "notion_page_id",
    "Nombre": "client_name",
    "Cliente": "client_name",         # alias posible
    "Sesión": "session_number",
    "Fecha": "measured_at",
    "Fecha de sesión": "measured_at",
    "Tipo de terapia": "therapy_type",
    "Terapia": "therapy_type",
    # Energía general
    "General": "general_energy_level",
    # Dimensiones energéticas (inicial / final)
    "Vibración I": "dim_vibracion_i",
    "Vibración F": "dim_vibracion_f",
    "Masculina I": "dim_masculina_i",
    "Masculina F": "dim_masculina_f",
    "Femenina I": "dim_femenina_i",
    "Femenina F": "dim_femenina_f",
    "Física I": "dim_fisica_i",
    "Física F": "dim_fisica_f",
    "Psíquica I": "dim_psiquica_i",
    "Psíquica F": "dim_psiquica_f",
    "Abundancia I": "dim_abundancia_i",
    "Abundancia F": "dim_abundancia_f",
    "Prosperidad I": "dim_prosperidad_i",
    "Prosperidad F": "dim_prosperidad_f",
    "Relación c/Dinero I": "dim_relacion_dinero_i",
    "Relación c/Dinero F": "dim_relacion_dinero_f",
    "Polución I": "dim_polucion_i",
    "Polución F": "dim_polucion_f",
    # Chakras (inicial / final, posiciones 1-7)
    **{f"Chakra {n} I": f"chakra_{n}_i" for n in range(1, 8)},
    **{f"Chakra {n} F": f"chakra_{n}_f" for n in range(1, 8)},
    # Limpieza energética
    "Entidades": "entities_count",
    "Implantes": "implants_count",
    "Total Limpiezas": "total_cleanings",
    "Limpiezas": "total_cleanings",
    "Bud": "bud",
    "Bud Chakra": "bud_chakra",
    # Costo
    "Costo": "cost",
    "Precio": "cost",
    # Notas de pago
    "Pago": "payment_notes",
    "Notas de pago": "payment_notes",
}

CLIENT_COLUMN_MAP: dict[str, str] = {
    "ID": "notion_page_id",
    "Nombre": "full_name",
    "Nombre completo": "full_name",
    "Email": "email",
    "Correo": "email",
    "Teléfono": "phone",
    "Celular": "phone",
    "Fecha de nacimiento": "birth_date",
    "Lugar de nacimiento": "birth_place",
    "Lugar de residencia": "residence_place",
    "Estado civil": "marital_status",
    "Profesión": "profession",
    "Ocupación": "profession",
    "Número de hijos": "num_children",
    "Hijos": "num_children",
    "Número de hermanos": "num_siblings",
    "Hermanos": "num_siblings",
    "Número de hijo": "birth_order",        # posición en hermandad
    "Emociones predominantes": "predominant_emotions",
    "Abortos en la familia": "family_abortions",
    "Muertes antes de los 41": "deaths_before_41",
    "Notas importantes": "important_notes",
    "Motivo de consulta": "motivation_general",
    "Motivación": "motivation_general",
}

# Estado civil Notion → enum SDC
MARITAL_STATUS_MAP: dict[str, str] = {
    "soltero": "single", "soltera": "single",
    "casado": "married", "casada": "married",
    "divorciado": "divorced", "divorciada": "divorced",
    "viudo": "widowed", "viuda": "widowed",
    "unión libre": "common_law", "union libre": "common_law",
    "concubinato": "common_law",
    "otro": "other", "otra": "other",
}

# Posibles duplicados conocidos (para el reporte)
KNOWN_DUPLICATES: list[tuple[str, str]] = [
    ("Mauricio Jair", "Mauricio Jaur Palacios Ruiz"),
    ("Sigrid Blancas Suástegui", "Sigrid Viridiana Blancas Suastegui"),
    ("Ingrid Rodgers", "Ingrid del Rosario Rodgers Echeverry"),
    ("Nelly Montes Otero", "Nelly Otero Velázquez"),
]


# ══════════════════════════════════════════════════════════════
# Funciones de normalización
# ══════════════════════════════════════════════════════════════

def parse_notion_date(value: Any) -> date | None:
    """
    Parsea fecha de Notion. Formatos posibles:
      - ISO 8601: "2025-01-15"
      - Español largo: "15 de enero de 2025"
      - Corto: "15/01/2025"
    """
    if not value or str(value).strip() in ("", "nan", "NaT", "None"):
        return None
    s = str(value).strip()
    # ISO 8601
    try:
        return date.fromisoformat(s[:10])
    except ValueError:
        pass
    # Español largo: "15 de enero de 2025"
    m = re.match(r"(\d{1,2})\s+de\s+(\w+)\s+de\s+(\d{4})", s, re.IGNORECASE)
    if m:
        d, mes_str, y = m.group(1), m.group(2).lower(), m.group(3)
        mes = _MES_MAP.get(mes_str)
        if mes:
            try:
                return date(int(y), mes, int(d))
            except ValueError:
                pass
    # DD/MM/YYYY
    m2 = re.match(r"(\d{1,2})/(\d{1,2})/(\d{4})", s)
    if m2:
        try:
            return date(int(m2.group(3)), int(m2.group(2)), int(m2.group(1)))
        except ValueError:
            pass
    log.warning("fecha_no_parseable", value=s)
    return None


def parse_notion_datetime(value: Any) -> datetime | None:
    """
    Parsea datetime de Notion. Cae a parse_notion_date si no hay hora.
    """
    if not value or str(value).strip() in ("", "nan", "NaT", "None"):
        return None
    s = str(value).strip()
    # ISO 8601 con hora
    for fmt in ("%Y-%m-%dT%H:%M:%S.%f%z", "%Y-%m-%dT%H:%M:%S%z",
                "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d %H:%M:%S"):
        try:
            return datetime.strptime(s, fmt)
        except ValueError:
            pass
    d = parse_notion_date(s)
    if d:
        return datetime(d.year, d.month, d.day, tzinfo=None)
    return None


def parse_notion_number(value: Any, max_val: float | None = None) -> float | None:
    """
    Parsea número de Notion con manejo de separadores MX.
    "11.000" → 11.0 (punto como separador de miles en enteros)
    "2.500"  → 2.5  (punto como decimal)
    Estrategia: si la parte decimal es "000", es separador de miles → truncar.
    Si max_val dado y resultado > max_val → None (outlier).
    """
    if not value or str(value).strip() in ("", "nan", "None"):
        return None
    s = str(value).strip().replace(",", ".")
    # Remover espacios y símbolo $
    s = re.sub(r"[$\s]", "", s)
    try:
        num = float(s)
    except ValueError:
        log.warning("numero_no_parseable", value=str(value))
        return None

    if max_val is not None and num > max_val:
        return None   # outlier — caller lo registra
    return num


def parse_chakra_value(value: Any) -> float | None:
    """
    Chakras 0-14. "11.000" → 11.0, "2.500" → 2.5.
    Valores > 14 → None (outlier).
    """
    raw = parse_notion_number(value)
    if raw is None:
        return None
    if raw > 14:
        return None   # outlier — registrado por el llamador
    return round(raw, 2)


def parse_energy_value(value: Any) -> float | None:
    """Energía 0-100. Valores > 100 → None (outlier)."""
    raw = parse_notion_number(value)
    if raw is None:
        return None
    if raw > 100:
        return None
    return round(raw, 2)


def normalize_phone(value: Any) -> str | None:
    """
    Normaliza teléfono MX a formato E.164 (+52XXXXXXXXXX).
    Acepta 10 dígitos, con/sin prefijo 52 o +52.
    """
    if not value or str(value).strip() in ("", "nan", "None"):
        return None
    digits = re.sub(r"[^\d]", "", str(value).strip())
    if digits.startswith("521") and len(digits) == 13:
        return f"+{digits}"
    if digits.startswith("52") and len(digits) == 12:
        return f"+{digits}"
    if len(digits) == 10:
        return f"+52{digits}"
    log.warning("telefono_formato_desconocido", raw=str(value)[:20])
    return str(value).strip()   # devolver tal cual para revisión manual


def normalize_marital_status(value: Any) -> str | None:
    if not value or str(value).strip() in ("", "nan", "None"):
        return None
    key = str(value).strip().lower()
    return MARITAL_STATUS_MAP.get(key, "other")


def is_nuevo_cliente(row: pd.Series) -> bool:
    """Detecta los 7 registros "Nuevo Cliente" sin datos reales."""
    name_col = _find_col(row, ["Nombre", "full_name", "Nombre completo"])
    if name_col and str(row.get(name_col, "")).strip().lower() == "nuevo cliente":
        return True
    return False


def _find_col(row: pd.Series | dict[str, Any], candidates: list[str]) -> str | None:
    """Retorna el primer candidato de columna que exista."""
    cols = row.index if isinstance(row, pd.Series) else row.keys()
    for c in candidates:
        if c in cols:
            return c
    return None


# ══════════════════════════════════════════════════════════════
# Normalización de sesiones
# ══════════════════════════════════════════════════════════════

@dataclass
class OutlierRecord:
    notion_id: str
    field: str
    raw_value: str
    reason: str


def normalize_sessions(raw_path: Path) -> tuple[pd.DataFrame, list[OutlierRecord]]:
    """
    Lee Sesiones.csv, normaliza, devuelve DataFrame limpio + lista de outliers.
    Descarta 7 "Nuevo Cliente". Marca 2 sin cliente con notion_client_id vacío.
    """
    log.info("leyendo_sesiones", path=str(raw_path))
    df = pd.read_csv(raw_path, dtype=str, keep_default_na=False)

    # Renombrar columnas según SESSION_COLUMN_MAP (solo las que existen)
    rename_map = {k: v for k, v in SESSION_COLUMN_MAP.items() if k in df.columns}
    df = df.rename(columns=rename_map)

    outliers: list[OutlierRecord] = []
    rows_clean: list[dict[str, Any]] = []

    for _, row in df.iterrows():
        notion_id = str(row.get("notion_page_id", "")).strip()

        # Descartar "Nuevo Cliente"
        if is_nuevo_cliente(row):
            log.info("descartando_nuevo_cliente", notion_id=notion_id)
            continue

        clean: dict[str, Any] = {"notion_page_id": notion_id}

        # Fecha sesión
        raw_date = row.get("measured_at", "")
        dt = parse_notion_datetime(raw_date)
        clean["measured_at"] = dt.isoformat() if dt else None

        # Cliente
        clean["client_name"] = str(row.get("client_name", "")).strip() or None

        # Número de sesión
        sn_raw = str(row.get("session_number", "")).strip()
        m = re.search(r"\d+", sn_raw)
        clean["session_number"] = int(m.group()) if m else None

        # Tipo de terapia
        clean["therapy_type"] = str(row.get("therapy_type", "")).strip() or None

        # Costo
        cost_raw = row.get("cost", "")
        clean["cost"] = parse_notion_number(cost_raw)

        # General
        gen_raw = row.get("general_energy_level", "")
        gen = parse_energy_value(gen_raw)
        if gen is None and str(gen_raw).strip() not in ("", "nan", "None"):
            outliers.append(OutlierRecord(notion_id, "general_energy_level", str(gen_raw), ">100"))
        clean["general_energy_level"] = gen

        # Dimensiones energéticas
        dim_cols = [c for c in df.columns if c.startswith("dim_")]
        for col in dim_cols:
            raw_val = row.get(col, "")
            parsed = parse_energy_value(raw_val)
            if parsed is None and str(raw_val).strip() not in ("", "nan", "None"):
                outliers.append(OutlierRecord(notion_id, col, str(raw_val), ">100 o no numérico"))
            clean[col] = parsed

        # Chakras
        for n in range(1, 8):
            for suffix in ("i", "f"):
                col = f"chakra_{n}_{suffix}"
                raw_val = row.get(col, "")
                parsed = parse_chakra_value(raw_val)
                if parsed is None and str(raw_val).strip() not in ("", "nan", "None"):
                    outliers.append(OutlierRecord(notion_id, col, str(raw_val), ">14 o no numérico"))
                clean[col] = parsed

        # Campos de limpieza
        for field_name in ("entities_count", "implants_count", "total_cleanings"):
            raw_val = row.get(field_name, "")
            clean[field_name] = parse_notion_number(raw_val)

        # Bud / Bud Chakra
        clean["bud"] = str(row.get("bud", "")).strip() or None
        clean["bud_chakra"] = str(row.get("bud_chakra", "")).strip() or None
        clean["payment_notes"] = str(row.get("payment_notes", "")).strip() or None

        rows_clean.append(clean)

    df_clean = pd.DataFrame(rows_clean)
    log.info(
        "sesiones_normalizadas",
        total_raw=len(df),
        total_clean=len(df_clean),
        outliers=len(outliers),
    )
    return df_clean, outliers


# ══════════════════════════════════════════════════════════════
# Normalización de clientes
# ══════════════════════════════════════════════════════════════

def normalize_clients(raw_path: Path) -> tuple[pd.DataFrame, list[str]]:
    """
    Lee Clientes.csv, normaliza.
    Retorna DataFrame limpio + lista de notion_page_ids para revisión manual.
    """
    log.info("leyendo_clientes", path=str(raw_path))
    df = pd.read_csv(raw_path, dtype=str, keep_default_na=False)

    rename_map = {k: v for k, v in CLIENT_COLUMN_MAP.items() if k in df.columns}
    df = df.rename(columns=rename_map)

    manual_review: list[str] = []
    today = date.today()
    rows_clean: list[dict[str, Any]] = []

    for _, row in df.iterrows():
        notion_id = str(row.get("notion_page_id", "")).strip()

        if is_nuevo_cliente(row):
            log.info("descartando_nuevo_cliente", notion_id=notion_id)
            continue

        clean: dict[str, Any] = {"notion_page_id": notion_id}

        clean["full_name"] = str(row.get("full_name", "")).strip() or None
        clean["email"] = str(row.get("email", "")).strip().lower() or None
        clean["phone"] = normalize_phone(row.get("phone", ""))

        # Fecha de nacimiento
        bd = parse_notion_date(row.get("birth_date", ""))
        if bd:
            age = (today - bd).days // 365
            if bd > today or age < 18:
                manual_review.append(f"{notion_id}: birth_date={bd} (futuro o <18 años)")
        clean["birth_date"] = bd.isoformat() if bd else None

        clean["birth_place"] = str(row.get("birth_place", "")).strip() or None
        clean["residence_place"] = str(row.get("residence_place", "")).strip() or None
        clean["marital_status"] = normalize_marital_status(row.get("marital_status", ""))
        clean["profession"] = str(row.get("profession", "")).strip() or None

        # Campos de intake
        for int_field in ("num_children", "num_siblings", "birth_order", "family_abortions"):
            raw_val = row.get(int_field, "")
            n = parse_notion_number(raw_val)
            clean[int_field] = int(n) if n is not None else None

        # Emociones predominantes → JSONB (array)
        emo_raw = str(row.get("predominant_emotions", "")).strip()
        if emo_raw and emo_raw not in ("nan", "None", ""):
            # Multi-select de Notion exporta como "Ansiedad, Miedo, Tristeza"
            emo_list = [e.strip() for e in emo_raw.split(",") if e.strip()]
            clean["predominant_emotions"] = json.dumps(emo_list)
        else:
            clean["predominant_emotions"] = None

        clean["deaths_before_41"] = str(row.get("deaths_before_41", "")).strip() or None
        clean["important_notes"] = str(row.get("important_notes", "")).strip() or None
        clean["motivation_general"] = str(row.get("motivation_general", "")).strip() or None

        rows_clean.append(clean)

    df_clean = pd.DataFrame(rows_clean)
    log.info(
        "clientes_normalizados",
        total_raw=len(df),
        total_clean=len(df_clean),
        para_revision_manual=len(manual_review),
    )
    return df_clean, manual_review


# ══════════════════════════════════════════════════════════════
# Detección de duplicados
# ══════════════════════════════════════════════════════════════

def detect_duplicates(df_clients: pd.DataFrame) -> list[dict[str, str]]:
    """
    Detecta posibles duplicados por nombre similar.
    Retorna lista con pares para revisión manual.
    """
    duplicates: list[dict[str, str]] = []

    # Duplicados conocidos del audit
    if "full_name" in df_clients.columns:
        names = df_clients["full_name"].dropna().tolist()
        for a, b in KNOWN_DUPLICATES:
            a_matches = [n for n in names if a.lower() in n.lower() or n.lower() in a.lower()]
            b_matches = [n for n in names if b.lower() in n.lower() or n.lower() in b.lower()]
            if a_matches and b_matches:
                duplicates.append({
                    "name_a": a_matches[0],
                    "name_b": b_matches[0],
                    "tipo": "known_duplicate",
                })

    return duplicates


# ══════════════════════════════════════════════════════════════
# Punto de entrada
# ══════════════════════════════════════════════════════════════

def main() -> None:
    raw_dir = Path(settings.DATA_RAW_DIR)
    clean_dir = Path(settings.DATA_CLEAN_DIR)
    reports_dir = Path(settings.REPORTS_DIR)

    # ── Sesiones ───────────────────────────────────────────────
    sessions_raw = raw_dir / "Sesiones.csv"
    if sessions_raw.exists():
        df_sessions, outliers = normalize_sessions(sessions_raw)
        out_sessions = clean_dir / "sessions_clean.csv"
        df_sessions.to_csv(out_sessions, index=False, encoding="utf-8")
        log.info("guardado", path=str(out_sessions))

        # Guardar outliers
        if outliers:
            out_outliers = reports_dir / "outliers_report.csv"
            with out_outliers.open("w", newline="", encoding="utf-8") as f:
                w = csv.DictWriter(f, fieldnames=["notion_id", "field", "raw_value", "reason"])
                w.writeheader()
                for o in outliers:
                    w.writerow({
                        "notion_id": o.notion_id,
                        "field": o.field,
                        "raw_value": o.raw_value,
                        "reason": o.reason,
                    })
            log.info("outliers_guardados", path=str(out_outliers), count=len(outliers))
    else:
        log.warning("sesiones_csv_no_encontrado", expected=str(sessions_raw))

    # ── Clientes ───────────────────────────────────────────────
    clients_raw = raw_dir / "Clientes.csv"
    if clients_raw.exists():
        df_clients, manual_review = normalize_clients(clients_raw)
        out_clients = clean_dir / "clients_clean.csv"
        df_clients.to_csv(out_clients, index=False, encoding="utf-8")
        log.info("guardado", path=str(out_clients))

        # Guardar revisiones manuales
        if manual_review:
            out_review = reports_dir / "manual_review.txt"
            out_review.write_text("\n".join(manual_review), encoding="utf-8")
            log.warning("revisar_manualmente", count=len(manual_review), path=str(out_review))

        # Duplicados
        dups = detect_duplicates(df_clients)
        if dups:
            out_dups = reports_dir / "duplicates_report.csv"
            with out_dups.open("w", newline="", encoding="utf-8") as f:
                w = csv.DictWriter(f, fieldnames=["name_a", "name_b", "tipo"])
                w.writeheader()
                w.writerows(dups)
            log.warning("posibles_duplicados", count=len(dups), path=str(out_dups))
    else:
        log.warning("clientes_csv_no_encontrado", expected=str(clients_raw))

    log.info("normalizacion_completada")


if __name__ == "__main__":
    main()
