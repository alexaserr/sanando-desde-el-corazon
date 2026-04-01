#!/usr/bin/env python3
"""
normalize_new.py — Transforma exports Notion (marzo 2026) al formato
esperado por migrate_clients.py y migrate_sessions.py.

Nuevo formato de Notion:
  - Clientes: CSV directo con 30 columnas (no MDs individuales)
  - Sesiones: CSV principal + subdirectorios por sesión con sub-CSVs
  - Page IDs: en nombres de archivo .md (32 hex chars)

Genera:
  output/clients_clean.csv          → para migrate_clients.py
  output/sessions_clean.csv         → para migrate_sessions.py  
  output/Sesiones/{page_id}/        → sub-CSVs por sesión
    - Limpiezas.csv
    - LNT.csv
    - Organos.csv
    - ColumnaVertebral.csv
    - Afectaciones.csv
  output/Clientes/{page_id}/        → sub-CSVs por cliente (from _all CSV)
  output/normalize_report.json      → reporte de normalización

Uso:
  python normalize_new.py \
    --clients-dir ./data/raw/new_clientes \
    --sessions-dir ./data/raw/new_sesiones \
    --output ./data/clean
"""

import argparse
import csv
import json
import os
import re
import shutil
import sys
from datetime import datetime
from pathlib import Path
from typing import Any

# ── Spanish month parsing ─────────────────────────────────────
MONTHS_ES = {
    "enero": 1, "febrero": 2, "marzo": 3, "abril": 4,
    "mayo": 5, "junio": 6, "julio": 7, "agosto": 8,
    "septiembre": 9, "octubre": 10, "noviembre": 11, "diciembre": 12,
}

MARITAL_MAP = {
    "casada/o": "casado", "casado": "casado", "casada": "casado",
    "soltera/o": "soltero", "soltero": "soltero", "soltera": "soltero",
    "divorciada/o": "divorciado", "divorciado": "divorciado", "divorciada": "divorciado",
    "viuda/o": "viudo", "viudo": "viudo", "viuda": "viudo",
    "unión libre": "union_libre", "union libre": "union_libre",
    "separada/o": "separado", "separado": "separado", "separada": "separado",
}

SLEEP_MAP = {
    "buena": "good", "bueno": "good", "bien": "good",
    "regular": "fair",
    "mala": "poor", "malo": "poor", "mal": "poor",
}

# Map from Notion CSV columns → migrate_sessions.py expected columns
THERAPY_MAP = {
    "sanación energética": "sanación energética",
    "sanación a distancia": "sanación a distancia",
    "medicina cuántica": "medicina cuántica",
    "terapia lnt": "terapia lnt",
    "limpieza energética": "limpieza energética",
    "extracción de energías densas": "extracción de energías densas",
    "armonización y mandala": "armonización y mandala",
    "recuperación del alma": "recuperación del alma",
    "despacho": "despacho",
}


def parse_spanish_date(s: str) -> str | None:
    """Parse '5 de marzo de 2025 13:54' → ISO 8601 string."""
    if not s or not s.strip():
        return None
    s = s.strip()
    # Pattern: DD de MES de YYYY HH:MM
    m = re.match(
        r"(\d{1,2})\s+de\s+(\w+)\s+de\s+(\d{4})\s+(\d{1,2}):(\d{2})",
        s, re.IGNORECASE,
    )
    if m:
        day, month_str, year, hour, minute = m.groups()
        month = MONTHS_ES.get(month_str.lower())
        if month:
            try:
                dt = datetime(int(year), month, int(day), int(hour), int(minute))
                return dt.isoformat()
            except ValueError:
                pass
    # Fallback: just date without time
    m2 = re.match(r"(\d{1,2})\s+de\s+(\w+)\s+de\s+(\d{4})", s, re.IGNORECASE)
    if m2:
        day, month_str, year = m2.groups()
        month = MONTHS_ES.get(month_str.lower())
        if month:
            try:
                dt = datetime(int(year), month, int(day))
                return dt.isoformat()
            except ValueError:
                pass
    return None


def extract_name_from_notion_field(field: str) -> str:
    """Extract clean name from 'Name (https://www.notion.so/...)' format."""
    if not field:
        return ""
    return re.sub(r"\s*\(https?://.*", "", field).strip()


def extract_page_id_from_notion_field(field: str) -> str:
    """Extract 32-char hex page ID from Notion URL in field."""
    if not field:
        return ""
    m = re.search(r"([0-9a-f]{32})", field)
    return m.group(1) if m else ""


def safe_float(val: str) -> float | None:
    """Parse a number that might use comma as decimal separator."""
    if not val or not val.strip():
        return None
    val = val.strip().replace(",", ".").replace("%", "").replace(" ", "")
    try:
        return float(val)
    except ValueError:
        return None


def safe_int(val: str) -> int | None:
    f = safe_float(val)
    return int(f) if f is not None else None


# ══════════════════════════════════════════════════════════════
# CLIENTS
# ══════════════════════════════════════════════════════════════

def normalize_clients(clients_dir: Path, output_dir: Path) -> dict:
    """Read client CSVs and produce clients_clean.csv."""
    report = {"total": 0, "ok": 0, "errors": []}

    # Find the _all CSV
    all_csvs = list(clients_dir.rglob("*_all.csv"))
    if not all_csvs:
        print("ERROR: No _all.csv found in clients dir", file=sys.stderr)
        return report
    client_csv = all_csvs[0]
    print(f"  Client CSV: {client_csv}")

    # Find the non-_all CSV (has page IDs via Notion URLs)
    non_all = Path(str(client_csv).replace("_all.csv", ".csv"))

    # Build page_id map from non-_all CSV
    # The non-_all CSV has fewer columns but client names link to Notion pages
    # We need to read the _all CSV for full data
    # Page IDs come from the MD files in the clients directory
    # BUT this new export doesn't have individual client MDs!
    # We need to extract page IDs from the Historial de Sesiones links
    # or from the session CSV client fields

    # Read _all CSV
    rows = []
    with open(client_csv, encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            rows.append(dict(row))
    report["total"] = len(rows)
    print(f"  Clients in CSV: {len(rows)}")

    # Try to get page IDs from the non-_all CSV (Historial has Notion URLs)
    name_to_page_id: dict[str, str] = {}
    if non_all.exists():
        with open(non_all, encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            for row in reader:
                name = row.get("\ufeffNombre completo", row.get("Nombre completo", "")).strip()
                historial = row.get("Historial de Sesiones", "")
                # The historial field doesn't have the CLIENT page ID directly
                # But we can use session CSV to map client names → page IDs
                # For now, store names for later matching
                # Actually, the Notion URL in _all CSV Correo electrónico won't have it either
                # We need another source...

    # Alternative: Extract client page IDs from session MDs
    # Session MDs have: "Clientes: Name (https://www.notion.so/Name-PAGEID)"
    # We'll populate this map in normalize_sessions and pass it back

    # For now, generate clients_clean.csv with placeholder page_ids
    # We'll update after session processing

    # Clean and output
    clean_rows = []
    for row in rows:
        # Handle BOM in first column
        name_key = "\ufeffNombre completo" if "\ufeffNombre completo" in row else "Nombre completo"
        full_name = row.get(name_key, "").strip()
        if not full_name:
            report["errors"].append({"row": row, "error": "empty name"})
            continue

        email = row.get("Correo electrónico", "").strip()
        phone = row.get("Teléfono", "").strip()
        birth_date_raw = row.get("Fecha de Nacimiento", "").strip()
        birth_date = parse_spanish_date(birth_date_raw) if birth_date_raw else ""
        marital_raw = row.get("Estado Civil", "").strip().lower()
        marital = MARITAL_MAP.get(marital_raw, marital_raw)
        profession = row.get("Profesión", "").strip()
        sleep_hours = safe_float(row.get("Horas de sueño", ""))
        sleep_quality_raw = row.get("Calidad de sueño", "").strip().lower()
        sleep_quality = SLEEP_MAP.get(sleep_quality_raw, sleep_quality_raw)
        
        # Places
        birthplace = row.get("Lugar de Nacimiento", "").strip()
        residence = row.get("Lugar de Residencia", "").strip()
        
        # Family
        siblings = safe_int(row.get("Número de hermanos", ""))
        birth_order = safe_int(row.get("Número de hijo ", ""))  # note trailing space
        children = row.get("Hijos", "").strip()
        abortions = safe_int(row.get("Abortos en el sistema familiar", ""))
        deaths_41 = row.get("Fallecimientos antes de los 41", "").strip()
        
        # Health
        conditions = row.get("Problemas médicos diagnosticados", "").strip()
        diseases = row.get("Enfermedades médicas recurrentes", "").strip()
        medications = row.get("Medicamentos", "").strip()
        body_pain = row.get("Dolor en cuerpo", "").strip()
        
        # Motivation & emotions
        motivation = row.get("Motivación para venir", "").strip()
        motivation_desc = row.get("Descripción de Motivación", "").strip()
        emotions = row.get("Emociones Predominantes", "").strip()
        
        # Family descriptions
        nuclear_desc = row.get("Descripción de familia nuclear", "").strip()
        actual_desc = row.get("Descripción de familia actual", "").strip()
        nuclear = row.get("Familia Nuclear", "").strip()
        actual = row.get("Familia Actual", "").strip()
        
        notes = row.get("Notas importantes", "").strip()
        created = row.get("Fecha de creación", "").strip()
        created_iso = parse_spanish_date(created) if created else ""

        clean_rows.append({
            "notion_page_id": "",  # Will be populated later
            "full_name": full_name,
            "email": email,
            "phone": phone,
            "birth_date": birth_date or "",
            "marital_status": marital,
            "profession": profession,
            "birthplace": birthplace,
            "residence": residence,
            "sleep_hours": sleep_hours or "",
            "sleep_quality": sleep_quality,
            "siblings": siblings or "",
            "birth_order": birth_order or "",
            "children": children,
            "abortions": abortions or "",
            "deaths_before_41": deaths_41,
            "conditions": conditions,
            "diseases": diseases,
            "medications": medications,
            "body_pain": body_pain,
            "motivation": motivation,
            "motivation_description": motivation_desc,
            "emotions": emotions,
            "family_nuclear": nuclear,
            "family_nuclear_desc": nuclear_desc,
            "family_actual": actual,
            "family_actual_desc": actual_desc,
            "notes": notes,
            "created_at": created_iso or "",
        })
        report["ok"] += 1

    # Write clients_clean.csv
    if clean_rows:
        out_path = output_dir / "clients_clean.csv"
        with open(out_path, "w", encoding="utf-8", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=clean_rows[0].keys())
            writer.writeheader()
            writer.writerows(clean_rows)
        print(f"  Written: {out_path} ({len(clean_rows)} rows)")

    return report


# ══════════════════════════════════════════════════════════════
# SESSIONS
# ══════════════════════════════════════════════════════════════

def build_session_md_index(sessions_dir: Path) -> dict[str, dict]:
    """Parse all session MD files to build page_id → metadata index."""
    session_base = None
    # Find the Medición Energética directory
    for candidate in sessions_dir.rglob("Medición Energética"):
        if candidate.is_dir():
            session_base = candidate
            break
    if not session_base:
        # Try one level up
        for candidate in sessions_dir.rglob("Privado y Compartido"):
            me_dir = candidate / "Medición Energética"
            if me_dir.is_dir():
                session_base = me_dir
                break
    if not session_base:
        print("ERROR: Cannot find 'Medición Energética' directory", file=sys.stderr)
        return {}

    index = {}
    id_pattern = re.compile(r"([0-9a-f]{32})\.md$")

    for f in os.listdir(session_base):
        if not f.endswith(".md"):
            continue
        m = id_pattern.search(f)
        if not m:
            continue
        page_id = m.group(1)
        md_path = session_base / f
        with open(md_path, encoding="utf-8") as fh:
            content = fh.read()

        fecha = ""
        fm = re.search(r"Fecha de Medición:\s*(.*?)(?:\n|$)", content)
        if fm:
            fecha = fm.group(1).strip()

        client_name = ""
        client_page_id = ""
        cm = re.search(r"Clientes:\s*([^\(]+)", content)
        if cm:
            client_name = cm.group(1).strip()
        ci = re.search(r"Clientes:.*?([0-9a-f]{32})", content)
        if ci:
            client_page_id = ci.group(1)

        # Extract session label
        label = f.replace(f" {page_id}.md", "").strip()

        index[page_id] = {
            "page_id": page_id,
            "label": label,
            "fecha_raw": fecha,
            "fecha_iso": parse_spanish_date(fecha) or "",
            "client_name": client_name,
            "client_page_id": client_page_id,
        }

    return index


def find_session_dir(session_base: Path, page_id: str) -> Path | None:
    """Find the session subdirectory matching a page_id."""
    # Directories are named like: "Sesión # 2802-452a" where 2802 and 452a
    # are the first 4 and last 4 chars of the page_id
    prefix = page_id[:4]
    suffix = page_id[-4:]
    short_id = f"{prefix}-{suffix}"

    for d in os.listdir(session_base):
        if os.path.isdir(session_base / d) and d.endswith(short_id):
            return session_base / d

    # Fallback: try matching just the prefix
    for d in os.listdir(session_base):
        full_path = session_base / d
        if os.path.isdir(full_path) and prefix in d:
            # Verify by checking more characters
            if suffix in d:
                return full_path

    return None


def find_sub_csvs(session_dir: Path, pattern: str) -> list[Path]:
    """Find _all.csv files matching a pattern in a session directory."""
    results = []
    for f in os.listdir(session_dir):
        if pattern.lower() in f.lower() and f.endswith("_all.csv"):
            results.append(session_dir / f)
    return results


def copy_sub_csv(source_csvs: list[Path], dest_path: Path, expected_headers: list[str] | None = None) -> int:
    """Copy and merge sub-CSVs to destination, return row count."""
    all_rows = []
    all_headers: list[str] = []
    seen_headers: set[str] = set()

    for src in source_csvs:
        try:
            with open(src, encoding="utf-8-sig") as f:
                reader = csv.DictReader(f)
                for h in (reader.fieldnames or []):
                    if h not in seen_headers:
                        all_headers.append(h)
                        seen_headers.add(h)
                for row in reader:
                    # Only include rows that have at least one non-empty value
                    if any(v.strip() for v in row.values() if v):
                        all_rows.append(row)
        except Exception as e:
            print(f"  Warning: error reading {src}: {e}", file=sys.stderr)

    if not all_rows or not all_headers:
        return 0

    dest_path.parent.mkdir(parents=True, exist_ok=True)
    with open(dest_path, "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=all_headers, extrasaction="ignore", restval="")
        writer.writeheader()
        writer.writerows(all_rows)

    return len(all_rows)


def normalize_sessions(sessions_dir: Path, output_dir: Path) -> tuple[dict, dict[str, str]]:
    """
    Read session exports and produce:
    - sessions_clean.csv
    - output/Sesiones/{page_id}/ sub-CSVs
    
    Returns (report, client_page_id_map) where client_page_id_map is {name: page_id}
    """
    report = {"total": 0, "ok": 0, "matched": 0, "unmatched": 0, "errors": [], "sub_data": {}}
    client_page_ids: dict[str, str] = {}  # client_name → client_page_id

    # Find session base directory
    session_base = None
    for candidate in sessions_dir.rglob("Medición Energética"):
        if candidate.is_dir():
            session_base = candidate
            break
    if not session_base:
        for candidate in sessions_dir.rglob("Privado y Compartido"):
            me_dir = candidate / "Medición Energética"
            if me_dir.is_dir():
                session_base = me_dir
                break
    if not session_base:
        print("ERROR: Cannot find session directory", file=sys.stderr)
        return report, client_page_ids

    # Find main CSV
    all_csvs = [session_base.parent / f for f in os.listdir(session_base.parent)
                if "Medición Energética" in f and f.endswith("_all.csv")]
    if not all_csvs:
        all_csvs = list(sessions_dir.rglob("Medición Energética*_all.csv"))
    if not all_csvs:
        print("ERROR: No session _all.csv found", file=sys.stderr)
        return report, client_page_ids
    session_csv = all_csvs[0]
    print(f"  Session CSV: {session_csv}")

    # Build MD index
    print("  Building MD index...")
    md_index = build_session_md_index(sessions_dir)
    print(f"  MD index: {len(md_index)} sessions")

    # Build lookup: (fecha_raw, client_page_id) → page_id
    md_by_date_client: dict[tuple[str, str], str] = {}
    for page_id, meta in md_index.items():
        key = (meta["fecha_raw"], meta["client_page_id"])
        md_by_date_client[key] = page_id
        # Collect client page IDs
        if meta["client_name"] and meta["client_page_id"]:
            client_page_ids[meta["client_name"]] = meta["client_page_id"]

    # Read main CSV
    csv_rows = []
    with open(session_csv, encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            csv_rows.append(dict(row))
    report["total"] = len(csv_rows)
    print(f"  CSV rows: {len(csv_rows)}")

    # Process each row
    clean_rows = []
    sesiones_dir = output_dir / "Sesiones"
    sesiones_dir.mkdir(parents=True, exist_ok=True)

    for i, row in enumerate(csv_rows):
        fecha_raw = row.get("Fecha de Medición", "").strip()
        client_field = row.get("Clientes", "")
        client_name = extract_name_from_notion_field(client_field)
        client_page_id = extract_page_id_from_notion_field(client_field)

        # Match to MD file for page_id
        key = (fecha_raw, client_page_id)
        page_id = md_by_date_client.get(key, "")

        if not page_id:
            # Try matching by date only (for rows with empty client)
            for pid, meta in md_index.items():
                if meta["fecha_raw"] == fecha_raw:
                    page_id = pid
                    break

        if not page_id:
            report["unmatched"] += 1
            report["errors"].append({"row_idx": i, "fecha": fecha_raw, "client": client_name, "error": "no page_id match"})
            # Generate a placeholder page_id
            page_id = f"unmapped_{i:04d}"
        else:
            report["matched"] += 1

        # Parse session data
        session_name = row.get("Sesión", "").strip()
        session_num_m = re.search(r"(\d+)", session_name)
        session_number = int(session_num_m.group(1)) if session_num_m else None

        therapy_field = row.get("Terapia Aplicada", "")
        therapy_name = extract_name_from_notion_field(therapy_field).lower()
        therapy_type = THERAPY_MAP.get(therapy_name, therapy_name)

        fecha_iso = parse_spanish_date(fecha_raw) or ""

        # Energy dimensions (values are in ×1000 format or percentage)
        # Notion exports: "70 %" or "10000" or ""
        def parse_energy(val: str) -> str:
            v = safe_float(val)
            if v is None:
                return ""
            # Values > 100 are in ×1000 format (e.g., 10000 = 10.0)
            # Values ≤ 100 are percentages
            if v > 100:
                return str(v)  # Keep as-is, migration script handles ÷1000
            return str(v)

        # Chakra values (in ×1000 format: 14000 = 14.0 on 0-14 scale)
        def parse_chakra(val: str) -> str:
            v = safe_float(val)
            if v is None:
                return ""
            return str(v)  # Keep as-is, migration script handles ÷1000

        clean_row = {
            "notion_page_id": page_id,
            "client_name": client_name,
            "therapy_type": therapy_type,
            "measured_at": fecha_iso,
            "session_number": session_number or "",
            "general_energy": parse_energy(row.get("General", "")),
            "cost": row.get("Costo", "").strip(),
            "entities_count": row.get("Entidades", "").strip(),
            "implants_count": row.get("Implantes", "").strip(),
            "total_cleanings": row.get("Total de limpiezas", row.get("Limpiezas totales", "")).strip(),
            "bud": "",  # parse from Bud field
            "bud_chakra": row.get("Bud chakra", "").strip(),
            "payment_notes": row.get("Notas de pagos", "").strip(),
            "mesas_usadas": row.get("Mesas usadas", "").strip(),
            # Energy dimensions - initial
            "dim_vibracion_i": parse_energy(row.get("Vibración", "")),
            "dim_masculina_i": parse_energy(row.get("Masculina", "")),
            "dim_femenina_i": parse_energy(row.get("Femenina", "")),
            "dim_fisica_i": parse_energy(row.get("Física", "")),
            "dim_psiquica_i": parse_energy(row.get("Psíquica", "")),
            "dim_abundancia_i": parse_energy(row.get("Abundancia", "")),
            "dim_prosperidad_i": parse_energy(row.get("Prosperidad", "")),
            "dim_relacion_dinero_i": parse_energy(row.get("Relación c/Dinero", "")),
            "dim_polucion_i": parse_energy(row.get("Polución", "")),
            # Energy dimensions - final
            "dim_vibracion_f": parse_energy(row.get("Vibración Final", "")),
            "dim_masculina_f": parse_energy(row.get("Masculina Final", "")),
            "dim_femenina_f": parse_energy(row.get("Femenina Final", "")),
            "dim_fisica_f": parse_energy(row.get("Física Final", "")),
            "dim_psiquica_f": parse_energy(row.get("Psíquica Final", "")),
            "dim_abundancia_f": parse_energy(row.get("Abundancia Final", "")),
            "dim_prosperidad_f": parse_energy(row.get("Prosperidad Final", "")),
            "dim_relacion_dinero_f": parse_energy(row.get("Relación c/Dinero Final", "")),
            "dim_polucion_f": "",  # No "Polución Final" in CSV
            # Chakras - initial
            "chakra_1_i": parse_chakra(row.get("Primer Chakra", "")),
            "chakra_2_i": parse_chakra(row.get("Segundo Chakra", "")),
            "chakra_3_i": parse_chakra(row.get("Tercer Chakra", "")),
            "chakra_4_i": parse_chakra(row.get("Cuarto Chakra", "")),
            "chakra_5_i": parse_chakra(row.get("Quinto Chakra", "")),
            "chakra_6_i": parse_chakra(row.get("Sexto Chakra", "")),
            "chakra_7_i": parse_chakra(row.get("Séptimo Chakra", "")),
            # Chakras - final
            "chakra_1_f": parse_chakra(row.get("Primer Chakra - F", "")),
            "chakra_2_f": parse_chakra(row.get("Segundo Chakra - F", "")),
            "chakra_3_f": parse_chakra(row.get("Tercer Chakra - F", "")),
            "chakra_4_f": parse_chakra(row.get("Cuarto Chakra - F", "")),
            "chakra_5_f": parse_chakra(row.get("Quinto Chakra - F", "")),
            "chakra_6_f": parse_chakra(row.get("Sexto Chakra - F", "")),
            "chakra_7_f": parse_chakra(row.get("Séptimo Chakra - F", "")),
        }

        # Parse Bud
        bud_raw = row.get("Bud", "").strip()
        if bud_raw:
            bud_val = safe_float(bud_raw)
            clean_row["bud"] = str(bud_val) if bud_val is not None else ""

        clean_rows.append(clean_row)

        # ── Process sub-data from session directory ──
        if page_id and not page_id.startswith("unmapped_"):
            session_dir = find_session_dir(session_base, page_id)
            if session_dir:
                out_session_dir = sesiones_dir / page_id
                out_session_dir.mkdir(parents=True, exist_ok=True)

                # Limpiezas (Información - Capas)
                capas_csvs = find_sub_csvs(session_dir, "Información - Capas")
                if capas_csvs:
                    n = copy_sub_csv(capas_csvs, out_session_dir / "Limpiezas.csv")
                    report["sub_data"].setdefault("Limpiezas", 0)
                    report["sub_data"]["Limpiezas"] += n

                # LNT (Terapia LNT)
                lnt_csvs = find_sub_csvs(session_dir, "Terapia LNT")
                if lnt_csvs:
                    n = copy_sub_csv(lnt_csvs, out_session_dir / "LNT.csv")
                    report["sub_data"].setdefault("LNT", 0)
                    report["sub_data"]["LNT"] += n

                # Órganos (Nivel energético de órgano)
                organ_csvs = find_sub_csvs(session_dir, "Nivel energético")
                if organ_csvs:
                    n = copy_sub_csv(organ_csvs, out_session_dir / "Organos.csv")
                    report["sub_data"].setdefault("Organos", 0)
                    report["sub_data"]["Organos"] += n

                # Columna Vertebral
                col_csvs = find_sub_csvs(session_dir, "Columna Vertebra")
                if col_csvs:
                    n = copy_sub_csv(col_csvs, out_session_dir / "ColumnaVertebral.csv")
                    report["sub_data"].setdefault("ColumnaVertebral", 0)
                    report["sub_data"]["ColumnaVertebral"] += n

                # Afectaciones (Sin título — these are Notion rollup tables)
                # Only copy if they have meaningful data (not just empty rollups)
                sin_csvs = find_sub_csvs(session_dir, "Sin título")
                # Filter out empty rollup tables
                meaningful = []
                for csv_path in sin_csvs:
                    try:
                        with open(csv_path, encoding="utf-8-sig") as f:
                            reader = csv.DictReader(f)
                            headers = reader.fieldnames or []
                            # Skip pure rollup tables (Name, Rollup only)
                            if len(headers) > 2:
                                meaningful.append(csv_path)
                    except Exception:
                        pass
                if meaningful:
                    n = copy_sub_csv(meaningful, out_session_dir / "Afectaciones.csv")
                    report["sub_data"].setdefault("Afectaciones", 0)
                    report["sub_data"]["Afectaciones"] += n

                # Chakra sub-CSVs (individual chakra detail tables)
                for chakra_name in ["Chakra Raíz", "Chakra Sacro", "Chakra Plexo Solar",
                                     "Chakra Corazón", "Chakra Garganta", "Chakra Tercer Ojo",
                                     "Chakra Corona"]:
                    chakra_csvs = find_sub_csvs(session_dir, chakra_name)
                    if chakra_csvs:
                        safe_name = chakra_name.replace(" ", "_")
                        n = copy_sub_csv(chakra_csvs, out_session_dir / f"{safe_name}.csv")
                        report["sub_data"].setdefault("ChakraDetail", 0)
                        report["sub_data"]["ChakraDetail"] += n

        report["ok"] += 1

    # Write sessions_clean.csv
    if clean_rows:
        out_path = output_dir / "sessions_clean.csv"
        with open(out_path, "w", encoding="utf-8", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=clean_rows[0].keys())
            writer.writeheader()
            writer.writerows(clean_rows)
        print(f"  Written: {out_path} ({len(clean_rows)} rows)")

    return report, client_page_ids


def update_client_page_ids(output_dir: Path, client_page_ids: dict[str, str]) -> int:
    """Update clients_clean.csv with page IDs extracted from session MDs."""
    csv_path = output_dir / "clients_clean.csv"
    if not csv_path.exists():
        return 0

    rows = []
    updated = 0
    with open(csv_path, encoding="utf-8") as f:
        reader = csv.DictReader(f)
        fieldnames = reader.fieldnames
        for row in reader:
            name = row.get("full_name", "").strip()
            if not row.get("notion_page_id") and name in client_page_ids:
                row["notion_page_id"] = client_page_ids[name]
                updated += 1
            rows.append(row)

    with open(csv_path, "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    return updated


# ══════════════════════════════════════════════════════════════
# MAIN
# ══════════════════════════════════════════════════════════════

def main():
    parser = argparse.ArgumentParser(description="Normalize Notion exports (Mar 2026) for SDC migration")
    parser.add_argument("--clients-dir", type=Path, required=True, help="Path to extracted clients export")
    parser.add_argument("--sessions-dir", type=Path, required=True, help="Path to extracted sessions/mediciones export")
    parser.add_argument("--output", type=Path, default=Path("output"), help="Output directory")
    args = parser.parse_args()

    output_dir: Path = args.output
    output_dir.mkdir(parents=True, exist_ok=True)

    print("=" * 70)
    print("  Sanando desde el Corazón — Notion Export Normalizer v2")
    print("  (New format: March 2026 exports)")
    print("=" * 70)
    print()

    # 1. Normalize clients
    print("[1/3] Normalizing clients...")
    client_report = normalize_clients(args.clients_dir, output_dir)
    print(f"  Result: {client_report['ok']} ok, {len(client_report['errors'])} errors")
    print()

    # 2. Normalize sessions (also extracts client page IDs)
    print("[2/3] Normalizing sessions...")
    session_report, client_page_ids = normalize_sessions(args.sessions_dir, output_dir)
    print(f"  Result: {session_report['ok']} ok, {session_report['matched']} matched, "
          f"{session_report['unmatched']} unmatched")
    print(f"  Sub-data: {session_report.get('sub_data', {})}")
    print(f"  Client page IDs extracted: {len(client_page_ids)}")
    print()

    # 3. Update client page IDs
    print("[3/3] Updating client page IDs from session data...")
    updated = update_client_page_ids(output_dir, client_page_ids)
    print(f"  Updated: {updated} clients with page IDs")
    print()

    # Write report
    full_report = {
        "timestamp": datetime.now().isoformat(),
        "clients": client_report,
        "sessions": session_report,
        "client_page_ids_found": len(client_page_ids),
        "client_page_ids_updated": updated,
    }
    report_path = output_dir / "normalize_report.json"
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(full_report, f, indent=2, ensure_ascii=False, default=str)
    print(f"Report: {report_path}")

    # Summary
    print()
    print("=" * 70)
    print(f"  Clients:  {client_report['ok']} normalized")
    print(f"  Sessions: {session_report['ok']} normalized ({session_report['matched']} with page IDs)")
    print(f"  Sub-data: {session_report.get('sub_data', {})}")
    clients_with_id = sum(1 for _ in client_page_ids)
    clients_without = client_report["ok"] - updated
    print(f"  Client IDs: {updated} found, {clients_without} without page ID")
    print("=" * 70)
    print()
    print("Next steps:")
    print(f"  1. Review: {report_path}")
    print(f"  2. Copy output to migration data dirs")
    print(f"  3. Run: python migrate_clients.py --dry-run")
    print(f"  4. Run: python migrate_sessions.py --dry-run")


if __name__ == "__main__":
    main()
