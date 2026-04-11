"""
Router de administración de sesiones clínicas.

Limpieza de sesiones "vacías": sesiones creadas (POST) que nunca se llenaron
con datos. Solo admin.

Una sesión se considera vacía si:
- deleted_at IS NULL (sigue activa)
- general_energy_level IS NULL
- No tiene registros en: energy_readings, chakra_readings, theme_entries,
  cleaning_events, lnt_entries, ancestors
"""
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import LargeBinary, and_, cast, desc, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.db.models import (
    AuditAction,
    Client,
    Session,
    SessionAncestor,
    SessionChakraReading,
    SessionCleaningEvent,
    SessionEnergyReading,
    SessionLnt,
    SessionThemeEntry,
    TherapyType,
    User,
    UserRole,
)
from app.db.session import get_db
from app.dependencies import require_role
from app.utils.audit import write_audit_log

from pydantic import BaseModel, ConfigDict
from datetime import datetime

router = APIRouter(prefix="/api/v1/admin/sessions", tags=["Admin - Sesiones"])

_settings = get_settings()


class EmptySessionItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    client_name: str | None
    therapy_type: str | None
    created_at: datetime


class EmptySessionsListResponse(BaseModel):
    data: list[EmptySessionItem]
    total: int


class DeleteEmptyResponse(BaseModel):
    deleted_count: int


# ── Helpers ───────────────────────────────────────────────────

def _empty_session_conditions():
    """Devuelve la lista de condiciones SQL que definen una sesión vacía."""
    return [
        Session.deleted_at.is_(None),
        Session.general_energy_level.is_(None),
        ~select(SessionEnergyReading.id)
        .where(SessionEnergyReading.session_id == Session.id)
        .exists(),
        ~select(SessionChakraReading.id)
        .where(SessionChakraReading.session_id == Session.id)
        .exists(),
        ~select(SessionThemeEntry.id)
        .where(
            SessionThemeEntry.session_id == Session.id,
            SessionThemeEntry.deleted_at.is_(None),
        )
        .exists(),
        ~select(SessionCleaningEvent.id)
        .where(
            SessionCleaningEvent.session_id == Session.id,
            SessionCleaningEvent.deleted_at.is_(None),
        )
        .exists(),
        ~select(SessionLnt.id)
        .where(
            SessionLnt.session_id == Session.id,
            SessionLnt.deleted_at.is_(None),
        )
        .exists(),
        ~select(SessionAncestor.id)
        .where(
            SessionAncestor.session_id == Session.id,
            SessionAncestor.deleted_at.is_(None),
        )
        .exists(),
    ]


# ── Endpoints ─────────────────────────────────────────────────

@router.get(
    "/empty",
    response_model=EmptySessionsListResponse,
    summary="Listar sesiones vacías (sin datos capturados)",
)
async def list_empty_sessions(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.admin)),
) -> EmptySessionsListResponse:
    key = _settings.CLINICAL_DB_PGCRYPTO_KEY

    conditions = _empty_session_conditions()

    stmt = (
        select(
            Session.id,
            func.pgp_sym_decrypt(cast(Client.full_name, LargeBinary), key).label("client_name"),
            TherapyType.name.label("therapy_type"),
            Session.created_at,
        )
        .outerjoin(Client, Session.client_id == Client.id)
        .outerjoin(TherapyType, Session.therapy_type_id == TherapyType.id)
        .where(and_(*conditions))
        .order_by(desc(Session.created_at))
    )

    rows = (await db.execute(stmt)).mappings().all()

    items = [EmptySessionItem(**row) for row in rows]
    return EmptySessionsListResponse(data=items, total=len(items))


@router.delete(
    "/empty",
    response_model=DeleteEmptyResponse,
    summary="Soft-delete masivo de todas las sesiones vacías",
)
async def delete_empty_sessions(
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.admin)),
) -> DeleteEmptyResponse:
    conditions = _empty_session_conditions()

    ids_to_delete = (
        await db.execute(select(Session.id).where(and_(*conditions)))
    ).scalars().all()

    if not ids_to_delete:
        return DeleteEmptyResponse(deleted_count=0)

    await db.execute(
        update(Session)
        .where(Session.id.in_(ids_to_delete))
        .values(deleted_at=func.now())
    )

    ip = request.client.host if request.client else None
    ua = request.headers.get("user-agent")
    for sid in ids_to_delete:
        await write_audit_log(
            db,
            table_name="sessions",
            record_id=sid,
            action=AuditAction.DELETE,
            changed_by=current_user.id,
            new_data={"deleted_at": "NOW()", "reason": "empty_session_bulk_cleanup"},
            ip_address=ip,
            user_agent=ua,
        )

    await db.commit()
    return DeleteEmptyResponse(deleted_count=len(ids_to_delete))


@router.delete(
    "/{session_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Soft-delete de una sesión vacía específica",
)
async def delete_empty_session_by_id(
    session_id: UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.admin)),
) -> None:
    conditions = _empty_session_conditions()

    found = (
        await db.execute(
            select(Session.id).where(and_(Session.id == session_id, *conditions))
        )
    ).scalar_one_or_none()

    if found is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Sesión no encontrada o no está vacía",
        )

    await db.execute(
        update(Session)
        .where(Session.id == session_id)
        .values(deleted_at=func.now())
    )

    await write_audit_log(
        db,
        table_name="sessions",
        record_id=session_id,
        action=AuditAction.DELETE,
        changed_by=current_user.id,
        new_data={"deleted_at": "NOW()", "reason": "empty_session_cleanup"},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )

    await db.commit()
