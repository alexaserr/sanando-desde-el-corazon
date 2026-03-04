"""
Fase 3-E: Verificación cruzada Notion CSV vs clinical_db.

Compara conteos en los CSVs limpios vs filas en BD.
Genera reports/verify_report.json con el resultado.

Uso:
  python verify.py [--batch-id UUID]
  python verify.py          # verifica todos los registros
"""
import argparse
import asyncio
import json
import logging
import uuid
from datetime import datetime, timezone
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


async def get_db_counts(
    conn: psycopg.AsyncConnection[Any],
    batch_id: uuid.UUID | None,
) -> dict[str, int]:
    """
    Cuenta registros en cada tabla destino.

    Para clients y sessions se puede filtrar por batch_id (tienen migration_batch_id).
    Las sub-tablas (energy_readings, chakra_readings, etc.) se cuentan en total
    porque migration_log solo registra entradas a nivel de sesión/cliente, no de sub-tabla.
    """
    # Tablas con migration_batch_id propio — se pueden filtrar por batch
    batch_tables = ["clients", "sessions"]
    # Sub-tablas — siempre se cuentan en total (linked via CASCADE de la sesión/cliente)
    sub_tables = [
        "client_conditions", "client_medications", "client_sleep", "family_members",
        "session_energy_readings", "session_chakra_readings",
        "session_cleaning_events", "session_lnt", "session_affectations", "session_organs",
    ]

    counts: dict[str, int] = {}
    async with conn.cursor(row_factory=dict_row) as cur:
        for table in batch_tables:
            if batch_id:
                await cur.execute(
                    f"SELECT COUNT(*) AS n FROM {table} WHERE migration_batch_id = %s",
                    (str(batch_id),),
                )
            else:
                await cur.execute(f"SELECT COUNT(*) AS n FROM {table}")
            row = await cur.fetchone()
            counts[table] = int(row["n"]) if row else 0

        for table in sub_tables:
            await cur.execute(f"SELECT COUNT(*) AS n FROM {table}")
            row = await cur.fetchone()
            counts[table] = int(row["n"]) if row else 0

        # migration_log: siempre filtrado por batch si se proporciona
        if batch_id:
            await cur.execute(
                "SELECT COUNT(*) AS n FROM migration_log WHERE batch_id = %s",
                (str(batch_id),),
            )
        else:
            await cur.execute("SELECT COUNT(*) AS n FROM migration_log")
        row = await cur.fetchone()
        counts["migration_log"] = int(row["n"]) if row else 0

    return counts


def get_csv_counts() -> dict[str, int]:
    """Cuenta filas en los CSVs limpios."""
    clean_dir = Path(settings.DATA_CLEAN_DIR)
    counts: dict[str, int] = {}

    sessions_csv = clean_dir / "sessions_clean.csv"
    if sessions_csv.exists():
        df = pd.read_csv(sessions_csv, dtype=str, keep_default_na=False)
        counts["sessions_csv"] = len(df)
    else:
        counts["sessions_csv"] = -1  # no encontrado

    clients_csv = clean_dir / "clients_clean.csv"
    if clients_csv.exists():
        df = pd.read_csv(clients_csv, dtype=str, keep_default_na=False)
        counts["clients_csv"] = len(df)
    else:
        counts["clients_csv"] = -1

    return counts


async def verify_notion_ids(conn: psycopg.AsyncConnection[Any]) -> dict[str, Any]:
    """
    Verifica que todos los notion_page_id del CSV estén en BD.
    Retorna notion_ids sin match.
    """
    missing: dict[str, list[str]] = {"clients": [], "sessions": []}
    clean_dir = Path(settings.DATA_CLEAN_DIR)

    async with conn.cursor(row_factory=dict_row) as cur:
        # Clientes
        clients_csv = clean_dir / "clients_clean.csv"
        if clients_csv.exists():
            df = pd.read_csv(clients_csv, dtype=str, keep_default_na=False)
            csv_ids = set(df["notion_page_id"].dropna().tolist())
            await cur.execute("SELECT notion_page_id FROM clients WHERE notion_page_id IS NOT NULL")
            db_ids = {r["notion_page_id"] for r in await cur.fetchall()}
            missing["clients"] = sorted(csv_ids - db_ids)

        # Sesiones
        sessions_csv = clean_dir / "sessions_clean.csv"
        if sessions_csv.exists():
            df = pd.read_csv(sessions_csv, dtype=str, keep_default_na=False)
            if "notion_page_id" in df.columns:
                csv_ids = set(df["notion_page_id"].dropna().tolist())
                await cur.execute("SELECT notion_page_id FROM sessions WHERE notion_page_id IS NOT NULL")
                db_ids = {r["notion_page_id"] for r in await cur.fetchall()}
                missing["sessions"] = sorted(csv_ids - db_ids)

    return missing


async def run_verify(batch_id: uuid.UUID | None) -> None:
    db_url = settings.CLINICAL_DATABASE_URL
    reports_dir = Path(settings.REPORTS_DIR)

    csv_counts = get_csv_counts()
    log.info("conteos_csv", **csv_counts)

    async with await psycopg.AsyncConnection.connect(db_url) as conn:
        db_counts = await get_db_counts(conn, batch_id)
        missing = await verify_notion_ids(conn)

    # Construir resumen
    issues: list[str] = []

    clients_in_db = db_counts.get("clients", 0)
    clients_in_csv = csv_counts.get("clients_csv", -1)
    sessions_in_db = db_counts.get("sessions", 0)
    sessions_in_csv = csv_counts.get("sessions_csv", -1)

    if clients_in_csv >= 0 and clients_in_db != clients_in_csv:
        issues.append(
            f"CLIENTES: CSV={clients_in_csv} BD={clients_in_db} "
            f"(diferencia={clients_in_csv - clients_in_db})"
        )

    if sessions_in_csv >= 0 and sessions_in_db != sessions_in_csv:
        issues.append(
            f"SESIONES: CSV={sessions_in_csv} BD={sessions_in_db} "
            f"(diferencia={sessions_in_csv - sessions_in_db})"
        )

    if missing["clients"]:
        issues.append(f"CLIENTES SIN MATCH: {len(missing['clients'])} notion_ids no migrados")
    if missing["sessions"]:
        issues.append(f"SESIONES SIN MATCH: {len(missing['sessions'])} notion_ids no migrados")

    report: dict[str, Any] = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "batch_id": str(batch_id) if batch_id else "all",
        "csv_counts": csv_counts,
        "db_counts": db_counts,
        "missing_notion_ids": missing,
        "issues": issues,
        "status": "OK" if not issues else "ISSUES_FOUND",
    }

    out_path = reports_dir / "verify_report.json"
    out_path.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")

    if issues:
        log.warning("verificacion_con_problemas", issues=issues, report=str(out_path))
        for issue in issues:
            log.warning(issue)
    else:
        log.info("verificacion_ok", report=str(out_path))

    log.info("db_counts", **db_counts)


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Verificación cruzada Notion CSV vs SDC")
    p.add_argument("--batch-id", type=str, default=None, help="Filtrar por batch UUID")
    return p.parse_args()


if __name__ == "__main__":
    args = parse_args()
    batch_id = uuid.UUID(args.batch_id) if args.batch_id else None
    asyncio.run(run_verify(batch_id))
