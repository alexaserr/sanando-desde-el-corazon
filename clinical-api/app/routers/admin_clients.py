"""
Router de administración de clientes — merge y detección de duplicados.

Solo accesible por rol admin.
PII (full_name, email) cifrado con pgcrypto; se descifra para agrupar
clientes con el mismo nombre normalizado.
"""
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import LargeBinary, cast, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db.models import (
    AuditAction,
    Client,
    ClientCondition,
    ClientMedication,
    ClientTopic,
    Session,
    User,
    UserRole,
)
from app.db.session import get_db
from app.dependencies import require_role
from app.schemas.clients import (
    ClientMergeRequest,
    ClientMergeResponse,
    DuplicateCandidate,
    DuplicateGroup,
    DuplicateGroupsResponse,
)
from app.utils.audit import write_audit_log

router = APIRouter(prefix="/api/v1/admin/clients", tags=["Admin - Clientes"])


def _dec(column, key: str):
    return func.pgp_sym_decrypt(cast(column, LargeBinary), key)


@router.get(
    "/duplicates",
    response_model=DuplicateGroupsResponse,
    summary="Detecta grupos de clientes con el mismo nombre normalizado",
)
async def find_duplicate_clients(
    _admin: User = Depends(require_role(UserRole.admin)),
    db: AsyncSession = Depends(get_db),
) -> DuplicateGroupsResponse:
    key = settings.CLINICAL_DB_PGCRYPTO_KEY

    # Conteo de sesiones vivas por cliente
    sessions_subq = (
        select(
            Session.client_id.label("client_id"),
            func.count(Session.id).label("cnt"),
        )
        .where(Session.deleted_at.is_(None))
        .group_by(Session.client_id)
        .subquery()
    )

    rows = (
        await db.execute(
            select(
                Client.id,
                _dec(Client.full_name, key).label("full_name"),
                _dec(Client.email, key).label("email"),
                Client.created_at,
                func.coalesce(sessions_subq.c.cnt, 0).label("sessions_count"),
            )
            .outerjoin(sessions_subq, sessions_subq.c.client_id == Client.id)
            .where(Client.deleted_at.is_(None))
        )
    ).mappings().all()

    # Agrupar por nombre normalizado (lower + trim + colapso de espacios)
    groups: dict[str, list[DuplicateCandidate]] = {}
    display: dict[str, str] = {}
    for r in rows:
        raw_name = r["full_name"] or ""
        normalized = " ".join(raw_name.strip().lower().split())
        if not normalized:
            continue
        groups.setdefault(normalized, []).append(
            DuplicateCandidate(
                id=r["id"],
                full_name=raw_name,
                email=r["email"],
                sessions_count=int(r["sessions_count"] or 0),
                created_at=r["created_at"],
            )
        )
        display.setdefault(normalized, raw_name.strip())

    result = [
        DuplicateGroup(name=display[key_], clients=clients)
        for key_, clients in groups.items()
        if len(clients) >= 2
    ]
    result.sort(key=lambda g: g.name.lower())

    return DuplicateGroupsResponse(groups=result)


@router.post(
    "/merge",
    response_model=ClientMergeResponse,
    summary="Une dos clientes duplicados — mueve sesiones y soft-delete del duplicado",
)
async def merge_clients(
    body: ClientMergeRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.admin)),
) -> ClientMergeResponse:
    if body.primary_id == body.duplicate_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="primary_id y duplicate_id no pueden ser el mismo",
        )

    # Ambos deben existir y estar vivos
    existing = (
        await db.execute(
            select(Client.id).where(
                Client.id.in_([body.primary_id, body.duplicate_id]),
                Client.deleted_at.is_(None),
            )
        )
    ).scalars().all()
    existing_set = set(existing)
    if body.primary_id not in existing_set or body.duplicate_id not in existing_set:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cliente principal o duplicado no encontrado",
        )

    ip = request.client.host if request.client else None
    ua = request.headers.get("user-agent")

    # 1. Mover sesiones
    result = await db.execute(
        update(Session)
        .where(Session.client_id == body.duplicate_id)
        .values(client_id=body.primary_id)
    )
    sessions_moved = result.rowcount or 0

    # 2. Mover sub-tablas (sin unique constraints sobre client_id → reparent directo)
    await db.execute(
        update(ClientTopic)
        .where(ClientTopic.client_id == body.duplicate_id)
        .values(client_id=body.primary_id)
    )
    await db.execute(
        update(ClientCondition)
        .where(ClientCondition.client_id == body.duplicate_id)
        .values(client_id=body.primary_id)
    )
    await db.execute(
        update(ClientMedication)
        .where(ClientMedication.client_id == body.duplicate_id)
        .values(client_id=body.primary_id)
    )

    # 3. Soft-delete del duplicado
    await db.execute(
        update(Client)
        .where(Client.id == body.duplicate_id)
        .values(deleted_at=func.now())
    )

    # 4. Audit log — insert-only
    await write_audit_log(
        db,
        table_name="clients",
        record_id=body.duplicate_id,
        action=AuditAction.UPDATE,
        changed_by=current_user.id,
        new_data={
            "merged_into": str(body.primary_id),
            "sessions_moved": sessions_moved,
        },
        ip_address=ip,
        user_agent=ua,
    )

    await db.commit()

    return ClientMergeResponse(
        merged=True,
        sessions_moved=sessions_moved,
        primary_id=body.primary_id,
    )
