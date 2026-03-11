"""
Router de estadísticas del dashboard clínico.

GET /api/v1/clinical/dashboard/stats
  - Admin: estadísticas globales
  - Sanador: solo sus clientes y sesiones
Todo en una sola query con subqueries para eficiencia.
"""
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, status
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Client, Session, SessionEnergyReading, User, UserRole
from app.db.session import get_db
from app.dependencies import require_role

router = APIRouter(prefix="/api/v1/clinical/dashboard", tags=["dashboard"])


# ── Schemas ────────────────────────────────────────────────────

class DashboardStats(BaseModel):
    total_clients: int
    total_sessions: int
    sessions_this_month: int
    sessions_this_week: int
    average_energy: float | None = None


class DashboardStatsResponse(BaseModel):
    data: DashboardStats


# ── Helpers ───────────────────────────────────────────────────

def _week_start(now: datetime) -> datetime:
    """Retorna el lunes de la semana actual a las 00:00 UTC."""
    monday = now - timedelta(days=now.weekday())
    return monday.replace(hour=0, minute=0, second=0, microsecond=0)


def _month_start(now: datetime) -> datetime:
    """Retorna el primer día del mes actual a las 00:00 UTC."""
    return now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)


# ── Endpoint ──────────────────────────────────────────────────

@router.get(
    "/stats",
    response_model=DashboardStatsResponse,
    summary="Estadísticas del dashboard",
)
async def get_dashboard_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.therapist, UserRole.admin)),
) -> DashboardStatsResponse:
    now = datetime.now(timezone.utc)
    first_of_month = _month_start(now)
    first_of_week = _week_start(now)

    is_admin = current_user.role == UserRole.admin

    # ── Total clientes ─────────────────────────────────────────
    if is_admin:
        # Admin: todos los clientes activos
        total_clients_subq = (
            select(func.count(Client.id))
            .where(Client.deleted_at.is_(None))
            .scalar_subquery()
        )
    else:
        # Sanador: clientes únicos en sus sesiones que no estén eliminados
        total_clients_subq = (
            select(func.count(Session.client_id.distinct()))
            .join(Client, Session.client_id == Client.id)
            .where(Session.therapist_id == current_user.id)
            .where(Session.client_id.isnot(None))
            .where(Client.deleted_at.is_(None))
            .scalar_subquery()
        )

    # ── Sesiones base (según rol) ──────────────────────────────
    sess_filter = [] if is_admin else [Session.therapist_id == current_user.id]

    # ── Energía promedio (initial_value de lecturas energéticas) ──
    avg_energy_subq = (
        select(func.avg(SessionEnergyReading.initial_value))
        .join(Session, SessionEnergyReading.session_id == Session.id)
        .where(*sess_filter)
        .scalar_subquery()
    )

    # ── Query principal: estadísticas de sesiones + subqueries ──
    stats_stmt = select(
        total_clients_subq.label("total_clients"),
        func.count(Session.id).label("total_sessions"),
        func.count(Session.id).filter(Session.measured_at >= first_of_month).label("sessions_this_month"),
        func.count(Session.id).filter(Session.measured_at >= first_of_week).label("sessions_this_week"),
        avg_energy_subq.label("average_energy"),
    ).select_from(Session).where(*sess_filter)

    row = (await db.execute(stats_stmt)).mappings().one()

    avg_raw: Decimal | None = row["average_energy"]
    average_energy = round(float(avg_raw), 1) if avg_raw is not None else None

    return DashboardStatsResponse(
        data=DashboardStats(
            total_clients=row["total_clients"] or 0,
            total_sessions=row["total_sessions"] or 0,
            sessions_this_month=row["sessions_this_month"] or 0,
            sessions_this_week=row["sessions_this_week"] or 0,
            average_energy=average_energy,
        )
    )
