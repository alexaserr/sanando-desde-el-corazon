"""
Fase 3-E: Verificación cruzada Notion JSON vs clinical_db.

Compara conteos en los JSONs limpios vs filas en BD.
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

import psycopg
import structlog
from psycopg import sql as psql
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
    clients y sessions pueden filtrarse por batch_id.
    """
    batch_tables = ["clients", "sessions"]
    sub_tables = [
        "client_conditions", "client_medications", "client_sleep", "family_members",
        "session_energy_readings", "session_chakra_readings",
        "session_cleaning_events", "session_lnt", "session_affectations",
        "session_organs", "session_topics",
    ]

    counts: dict[str, int] = {}
    async with conn.cursor(row_factory=dict_row) as cur:
        for table in batch_tables:
            if batch_id:
                await cur.execute(
                    psql.SQL("SELECT COUNT(*) AS n FROM {} WHERE migration_batch_id = %s").format(
                        psql.Identifier(table)
                    ),
                    (str(batch_id),),
                )
            else:
                await cur.execute(
                    psql.SQL("SELECT COUNT(*) AS n FROM {}").format(psql.Identifier(table))
                )
            row = await cur.fetchone()
            counts[table] = int(row["n"]) if row else 0

        for table in sub_tables:
            await cur.execute(
                psql.SQL("SELECT COUNT(*) AS n FROM {}").format(psql.Identifier(table))
            )
            row = await cur.fetchone()
            counts[table] = int(row["n"]) if row else 0

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


def get_json_counts() -> dict[str, int]:
    """Cuenta registros en los JSONs limpios producidos por normalize.py."""
    clean_dir = Path(settings.DATA_CLEAN_DIR)
    counts: dict[str, int] = {}

    for key, filename in [
        ("sessions_json", "sessions_clean.json"),
        ("clients_json", "clients_clean.json"),
    ]:
        path = clean_dir / filename
        if path.exists():
            with open(path, encoding="utf-8") as f:
                data = json.load(f)
            counts[key] = len(data)
        else:
            counts[key] = -1  # no encontrado

    return counts


async def verify_notion_ids(conn: psycopg.AsyncConnection[Any]) -> dict[str, Any]:
    """
    Verifica que todos los notion_page_id del JSON de clientes estén en BD.
    Para sesiones: no hay notion_page_id en el JSON → solo verifica conteos.
    """
    missing: dict[str, list[str]] = {"clients": []}
    clean_dir = Path(settings.DATA_CLEAN_DIR)

    async with conn.cursor(row_factory=dict_row) as cur:
        clients_json = clean_dir / "clients_clean.json"
        if clients_json.exists():
            with open(clients_json, encoding="utf-8") as f:
                client_records = json.load(f)

            csv_ids = {
                r["notion_page_id"]
                for r in client_records
                if r.get("notion_page_id") and not r.get("is_placeholder")
            }

            await cur.execute(
                "SELECT notion_page_id FROM clients WHERE notion_page_id IS NOT NULL"
            )
            db_ids = {r["notion_page_id"] for r in await cur.fetchall()}
            missing["clients"] = sorted(csv_ids - db_ids)

    return missing


async def run_verify(batch_id: uuid.UUID | None) -> None:
    db_url = settings.CLINICAL_DATABASE_URL
    reports_dir = Path(settings.REPORTS_DIR)

    json_counts = get_json_counts()
    log.info("conteos_json", **json_counts)

    async with await psycopg.AsyncConnection.connect(db_url) as conn:
        db_counts = await get_db_counts(conn, batch_id)
        missing = await verify_notion_ids(conn)

    issues: list[str] = []

    clients_in_db = db_counts.get("clients", 0)
    clients_in_json = json_counts.get("clients_json", -1)
    sessions_in_db = db_counts.get("sessions", 0)
    sessions_in_json = json_counts.get("sessions_json", -1)

    if clients_in_json >= 0 and clients_in_db != clients_in_json:
        issues.append(
            f"CLIENTES: JSON={clients_in_json} BD={clients_in_db} "
            f"(diferencia={clients_in_json - clients_in_db})"
        )

    if sessions_in_json >= 0 and sessions_in_db != sessions_in_json:
        issues.append(
            f"SESIONES: JSON={sessions_in_json} BD={sessions_in_db} "
            f"(diferencia={sessions_in_json - sessions_in_db})"
        )

    if missing["clients"]:
        issues.append(
            f"CLIENTES SIN MATCH: {len(missing['clients'])} notion_ids no migrados"
        )

    report: dict[str, Any] = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "batch_id": str(batch_id) if batch_id else "all",
        "json_counts": json_counts,
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
    p = argparse.ArgumentParser(description="Verificación cruzada Notion JSON vs SDC")
    p.add_argument("--batch-id", type=str, default=None, help="Filtrar por batch UUID")
    return p.parse_args()


if __name__ == "__main__":
    args = parse_args()
    batch_id = uuid.UUID(args.batch_id) if args.batch_id else None
    asyncio.run(run_verify(batch_id))
