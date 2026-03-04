"""
Rollback de migración por batch_id.

Elimina TODOS los registros insertados en un batch específico,
en orden inverso a las dependencias FK.

PRECAUCIÓN: Esta operación es destructiva e irreversible.
            Usar solo en ambiente de desarrollo/staging.

Uso:
  python rollback.py --batch-id <UUID>
  python rollback.py --batch-id <UUID> --confirm

Sin --confirm muestra el plan pero NO ejecuta.
"""
import argparse
import asyncio
import logging
import uuid
from typing import Any

import psycopg
import structlog
from psycopg.rows import dict_row

from config import settings

log = structlog.get_logger(__name__)

structlog.configure(
    wrapper_class=structlog.make_filtering_bound_logger(
        getattr(logging, settings.LOG_LEVEL, logging.INFO)
    ),
)

# Orden de eliminación (inverso a FK dependencies)
# Las sub-tablas de sesión tienen CASCADE, pero las listamos explícitamente.
DELETE_ORDER: list[tuple[str, str]] = [
    # (tabla, columna_filtro) — columna_filtro puede ser migration_batch_id o via join
    ("session_organs",           "session_id"),
    ("session_affectations",     "session_id"),
    ("session_lnt",              "session_id"),
    ("session_cleaning_events",  "session_id"),
    ("session_chakra_readings",  "session_id"),
    ("session_energy_readings",  "session_id"),
    ("sessions",                 "migration_batch_id"),
    ("cleaning_materials",       "client_id"),
    ("family_members",           "client_id"),
    ("client_sleep",             "client_id"),
    ("client_medications",       "client_id"),
    ("client_conditions",        "client_id"),
    ("clients",                  "migration_batch_id"),
]


async def count_affected(
    conn: psycopg.AsyncConnection[Any],
    batch_id: uuid.UUID,
) -> dict[str, int]:
    """Cuenta cuántas filas se eliminarían por tabla."""
    counts: dict[str, int] = {}

    async with conn.cursor(row_factory=dict_row) as cur:
        # Primero: obtener session_ids y client_ids del batch
        await cur.execute(
            "SELECT id FROM sessions WHERE migration_batch_id = %s",
            (str(batch_id),),
        )
        session_ids: list[str] = [str(r["id"]) for r in await cur.fetchall()]

        await cur.execute(
            "SELECT id FROM clients WHERE migration_batch_id = %s",
            (str(batch_id),),
        )
        client_ids: list[str] = [str(r["id"]) for r in await cur.fetchall()]

        counts["sessions"] = len(session_ids)
        counts["clients"] = len(client_ids)

        if session_ids:
            for table in (
                "session_organs", "session_affectations", "session_lnt",
                "session_cleaning_events", "session_chakra_readings", "session_energy_readings",
            ):
                await cur.execute(
                    f"SELECT COUNT(*) AS n FROM {table} WHERE session_id = ANY(%s::uuid[])",
                    (session_ids,),
                )
                row = await cur.fetchone()
                counts[table] = int(row["n"]) if row else 0

            # cleaning_materials también puede estar vinculada a sesiones
            await cur.execute(
                "SELECT COUNT(*) AS n FROM cleaning_materials WHERE session_id = ANY(%s::uuid[])",
                (session_ids,),
            )
            row = await cur.fetchone()
            counts["cleaning_materials_by_session"] = int(row["n"]) if row else 0

        if client_ids:
            for table in (
                "cleaning_materials", "family_members", "client_sleep",
                "client_medications", "client_conditions",
            ):
                await cur.execute(
                    f"SELECT COUNT(*) AS n FROM {table} WHERE client_id = ANY(%s::uuid[])",
                    (client_ids,),
                )
                row = await cur.fetchone()
                counts[table] = int(row["n"]) if row else 0

        # Migration log
        await cur.execute(
            "SELECT COUNT(*) AS n FROM migration_log WHERE batch_id = %s",
            (str(batch_id),),
        )
        row = await cur.fetchone()
        counts["migration_log"] = int(row["n"]) if row else 0

    return counts


async def execute_rollback(
    conn: psycopg.AsyncConnection[Any],
    batch_id: uuid.UUID,
    session_ids: list[str],
    client_ids: list[str],
) -> dict[str, int]:
    """Ejecuta el rollback en una transacción usando parámetros psycopg3 (sin interpolación)."""
    deleted: dict[str, int] = {}

    async with conn.transaction():
        # Sub-tablas de sesión (usando ANY con array parametrizado — sin SQL injection)
        if session_ids:
            for table in (
                "session_organs", "session_affectations", "session_lnt",
                "session_cleaning_events", "session_chakra_readings", "session_energy_readings",
            ):
                result = await conn.execute(
                    f"DELETE FROM {table} WHERE session_id = ANY(%s::uuid[])",
                    (session_ids,),
                )
                deleted[table] = result.rowcount

            # cleaning_materials vinculadas a sesiones del batch
            result = await conn.execute(
                "DELETE FROM cleaning_materials WHERE session_id = ANY(%s::uuid[])",
                (session_ids,),
            )
            deleted["cleaning_materials_by_session"] = result.rowcount

        # Sesiones
        result = await conn.execute(
            "DELETE FROM sessions WHERE migration_batch_id = %s",
            (str(batch_id),),
        )
        deleted["sessions"] = result.rowcount

        # Sub-tablas de cliente (cleaning_materials que queden vinculadas al cliente)
        if client_ids:
            for table in (
                "cleaning_materials", "family_members", "client_sleep",
                "client_medications", "client_conditions",
            ):
                result = await conn.execute(
                    f"DELETE FROM {table} WHERE client_id = ANY(%s::uuid[])",
                    (client_ids,),
                )
                deleted[table] = result.rowcount

        # Clientes
        result = await conn.execute(
            "DELETE FROM clients WHERE migration_batch_id = %s",
            (str(batch_id),),
        )
        deleted["clients"] = result.rowcount

        # Migration log — se elimina en rollback (metadata de migración, no audit trail clínico)
        result = await conn.execute(
            "DELETE FROM migration_log WHERE batch_id = %s",
            (str(batch_id),),
        )
        deleted["migration_log"] = result.rowcount

    return deleted


async def run_rollback(batch_id: uuid.UUID, confirmed: bool) -> None:
    db_url = settings.CLINICAL_DATABASE_URL

    async with await psycopg.AsyncConnection.connect(db_url) as conn:
        # Verificar que el batch existe
        async with conn.cursor(row_factory=dict_row) as cur:
            await cur.execute(
                "SELECT COUNT(*) AS n FROM migration_log WHERE batch_id = %s",
                (str(batch_id),),
            )
            row = await cur.fetchone()
            if not row or row["n"] == 0:
                log.error("batch_no_encontrado", batch_id=str(batch_id))
                return

            # Obtener IDs para la ejecución (como strings para ANY(%s::uuid[]))
            await cur.execute(
                "SELECT id FROM sessions WHERE migration_batch_id = %s",
                (str(batch_id),),
            )
            session_ids: list[str] = [str(r["id"]) for r in await cur.fetchall()]

            await cur.execute(
                "SELECT id FROM clients WHERE migration_batch_id = %s",
                (str(batch_id),),
            )
            client_ids: list[str] = [str(r["id"]) for r in await cur.fetchall()]

        counts = await count_affected(conn, batch_id)

        log.info("plan_de_rollback", batch_id=str(batch_id))
        log.info("registros_a_eliminar", **counts)

        total = sum(counts.values())
        if total == 0:
            log.info("nada_que_eliminar")
            return

        if not confirmed:
            log.warning(
                "modo_dry_run",
                mensaje="Agrega --confirm para ejecutar el rollback",
                total_filas=total,
            )
            return

        log.warning("ejecutando_rollback", batch_id=str(batch_id), total_filas=total)
        deleted = await execute_rollback(conn, batch_id, session_ids, client_ids)

        log.info("rollback_completado", **deleted)


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Rollback de migración por batch_id")
    p.add_argument("--batch-id", type=str, required=True, help="UUID del batch a revertir")
    p.add_argument(
        "--confirm",
        action="store_true",
        help="Confirmar ejecución (sin esto solo muestra el plan)",
    )
    return p.parse_args()


if __name__ == "__main__":
    args = parse_args()
    batch_id = uuid.UUID(args.batch_id)
    asyncio.run(run_rollback(batch_id, args.confirm))
