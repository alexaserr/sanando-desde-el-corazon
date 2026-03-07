"""
Router CRUD de clientes (expedientes clínicos).

PII (full_name, email, phone) se cifra con pgcrypto al escribir y
se descifra al leer mediante pgp_sym_encrypt / pgp_sym_decrypt.
Nunca DELETE físico — soft delete con deleted_at (NOM-004-SSA3-2012).
Audit log INSERT en cada operación CRUD.
"""
from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import LargeBinary, cast, func, insert, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import settings
from app.db.models import (
    AuditAction,
    Client,
    ClientCondition,
    ClientMedication,
    ClientSleep,
    ConditionType,
    FamilyMember,
    User,
    UserRole,
)
from app.db.session import get_db
from app.dependencies import require_role
from app.schemas.clients import (
    ClientConditionResponse,
    ClientCreate,
    ClientListItem,
    ClientListResponse,
    ClientMedicationResponse,
    ClientResponse,
    ClientSleepResponse,
    ClientUpdate,
    FamilyMemberResponse,
)
from app.utils.audit import write_audit_log

router = APIRouter(prefix="/api/v1/clinical/clients", tags=["clients"])


# ── Helpers PII ───────────────────────────────────────────────

def _enc(value: str | None, key: str):
    """Cifra un valor con pgp_sym_encrypt, o retorna None si el valor es None."""
    if value is None:
        return None
    return func.pgp_sym_encrypt(value, key)


def _dec(column, key: str):
    """Descifra una columna con pgp_sym_decrypt(col::bytea, key)."""
    return func.pgp_sym_decrypt(cast(column, LargeBinary), key)


def _client_select(key: str):
    """
    SELECT con PII descifrado.
    Retorna un select() que puede recibir .where() adicional.
    """
    return select(
        Client.id,
        _dec(Client.full_name, key).label("full_name"),
        _dec(Client.email, key).label("email"),
        _dec(Client.phone, key).label("phone"),
        Client.birth_date,
        Client.birth_place,
        Client.residence_place,
        Client.marital_status,
        Client.profession,
        Client.num_children,
        Client.num_siblings,
        Client.birth_order,
        Client.predominant_emotions,
        Client.family_abortions,
        Client.deaths_before_41,
        Client.important_notes,
        Client.motivation_visit,
        Client.motivation_general,
        Client.created_at,
        Client.updated_at,
        Client.deleted_at,
    )


async def _load_sub_resources(client_id: UUID, db: AsyncSession) -> Client:
    """Carga relaciones del cliente via ORM (sin PII — los valores están cifrados en este objeto)."""
    orm = (
        await db.execute(
            select(Client)
            .options(
                selectinload(Client.conditions),
                selectinload(Client.medications),
                selectinload(Client.sleep_record),
                selectinload(Client.family_members),
            )
            .where(Client.id == client_id)
        )
    ).scalar_one()
    return orm


async def _build_client_response(
    client_id: UUID,
    db: AsyncSession,
    key: str,
    include_deleted: bool = False,
) -> ClientResponse:
    """
    Construye ClientResponse completo:
    1. Query con PII descifrado
    2. Sub-recursos via ORM
    """
    stmt = _client_select(key).where(Client.id == client_id)
    if not include_deleted:
        stmt = stmt.where(Client.deleted_at.is_(None))

    row = (await db.execute(stmt)).mappings().one_or_none()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cliente no encontrado")

    client_orm = await _load_sub_resources(client_id, db)

    active_conditions = [c for c in client_orm.conditions if c.deleted_at is None]
    active_medications = [m for m in client_orm.medications if m.deleted_at is None]
    active_family = [f for f in client_orm.family_members if f.deleted_at is None]

    return ClientResponse(
        **dict(row),
        conditions=[
            ClientConditionResponse.model_validate(c)
            for c in active_conditions
            if c.condition_type != ConditionType.pain
        ],
        pains=[
            ClientConditionResponse.model_validate(c)
            for c in active_conditions
            if c.condition_type == ConditionType.pain
        ],
        medications=[ClientMedicationResponse.model_validate(m) for m in active_medications],
        sleep=ClientSleepResponse.model_validate(client_orm.sleep_record)
        if client_orm.sleep_record
        else None,
        family_members=[FamilyMemberResponse.model_validate(f) for f in active_family],
    )


# ── Endpoints ─────────────────────────────────────────────────

@router.get(
    "",
    response_model=ClientListResponse,
    summary="Listar clientes (paginado)",
)
async def list_clients(
    page: int = 1,
    per_page: int = 20,
    sort_by: str = "created_at",
    sort_order: str = "desc",
    include_deleted: bool = False,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.therapist, UserRole.admin)),
) -> ClientListResponse:
    if page < 1:
        page = 1
    if per_page < 1 or per_page > 100:
        per_page = 20

    key = settings.CLINICAL_DB_PGCRYPTO_KEY

    # Columnas permitidas para ordenamiento
    _sort_cols = {
        "created_at": Client.created_at,
        "updated_at": Client.updated_at,
        "birth_date": Client.birth_date,
    }
    sort_col = _sort_cols.get(sort_by, Client.created_at)
    order_expr = sort_col.desc() if sort_order == "desc" else sort_col.asc()

    base_filter = [] if include_deleted else [Client.deleted_at.is_(None)]

    # Total
    total = (
        await db.scalar(
            select(func.count()).select_from(Client).where(*base_filter)
        )
    ) or 0

    # Página
    rows = (
        await db.execute(
            _client_select(key)
            .where(*base_filter)
            .order_by(order_expr)
            .limit(per_page)
            .offset((page - 1) * per_page)
        )
    ).mappings().all()

    items = [
        ClientListItem(
            id=r["id"],
            full_name=r["full_name"],
            email=r["email"],
            phone=r["phone"],
            birth_date=r["birth_date"],
            profession=r["profession"],
            created_at=r["created_at"],
            deleted_at=r["deleted_at"],
        )
        for r in rows
    ]

    pages = max(1, -(-total // per_page))  # ceil division

    return ClientListResponse(items=items, total=total, page=page, per_page=per_page, pages=pages)


@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    response_model=ClientResponse,
    summary="Crear cliente (cifra PII con pgcrypto)",
)
async def create_client(
    data: ClientCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.therapist, UserRole.admin)),
) -> ClientResponse:
    key = settings.CLINICAL_DB_PGCRYPTO_KEY
    ip = request.client.host if request.client else None
    ua = request.headers.get("user-agent")

    # INSERT con PII cifrado
    stmt = (
        insert(Client)
        .values(
            full_name=func.pgp_sym_encrypt(data.full_name, key),
            email=_enc(data.email, key),
            phone=_enc(data.phone, key),
            birth_date=data.birth_date,
            birth_place=data.birth_place,
            residence_place=data.residence_place,
            marital_status=data.marital_status,
            profession=data.profession,
            num_children=data.num_children,
            num_siblings=data.num_siblings,
            birth_order=data.birth_order,
            predominant_emotions=data.predominant_emotions,
            family_abortions=data.family_abortions,
            deaths_before_41=data.deaths_before_41,
            important_notes=data.important_notes,
            motivation_visit=data.motivation_visit,
            motivation_general=data.motivation_general,
        )
        .returning(Client.id)
    )
    client_id: UUID = (await db.execute(stmt)).scalar_one()

    # Sub-recursos
    for cond in data.conditions:
        db.add(ClientCondition(client_id=client_id, **cond.model_dump()))

    for med in data.medications:
        db.add(ClientMedication(client_id=client_id, **med.model_dump()))

    if data.sleep is not None:
        db.add(ClientSleep(client_id=client_id, **data.sleep.model_dump()))

    for fm in data.family_members:
        db.add(FamilyMember(client_id=client_id, **fm.model_dump()))

    # Audit log
    await write_audit_log(
        db,
        table_name="clients",
        record_id=client_id,
        action=AuditAction.INSERT,
        changed_by=current_user.id,
        new_data={"id": str(client_id)},
        ip_address=ip,
        user_agent=ua,
    )

    await db.commit()
    return await _build_client_response(client_id, db, key)


@router.get(
    "/{client_id}",
    response_model=ClientResponse,
    summary="Obtener cliente con PII descifrado",
)
async def get_client(
    client_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.therapist, UserRole.admin)),
) -> ClientResponse:
    key = settings.CLINICAL_DB_PGCRYPTO_KEY
    return await _build_client_response(client_id, db, key)


@router.patch(
    "/{client_id}",
    response_model=ClientResponse,
    summary="Actualizar cliente (PATCH semántico, soft delete con deleted_at)",
)
async def update_client(
    client_id: UUID,
    data: ClientUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.therapist, UserRole.admin)),
) -> ClientResponse:
    key = settings.CLINICAL_DB_PGCRYPTO_KEY
    ip = request.client.host if request.client else None
    ua = request.headers.get("user-agent")

    # Solo actualizar los campos que llegaron en el cuerpo
    update_data = data.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Sin campos para actualizar")

    # Construir valores para UPDATE
    values: dict = {}
    pii_fields = {"full_name", "email", "phone"}

    for field, value in update_data.items():
        if field in pii_fields:
            values[field] = _enc(value, key) if value is not None else None
        else:
            values[field] = value

    values["updated_at"] = func.now()

    result = await db.execute(
        update(Client)
        .where(Client.id == client_id)
        .values(**values)
        .returning(Client.id)
    )
    if result.scalar_one_or_none() is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cliente no encontrado")

    # Determina si es soft delete para el audit log
    action = AuditAction.DELETE if "deleted_at" in update_data and update_data["deleted_at"] else AuditAction.UPDATE

    await write_audit_log(
        db,
        table_name="clients",
        record_id=client_id,
        action=action,
        changed_by=current_user.id,
        new_data={k: str(v) if v is not None else None for k, v in update_data.items() if k not in pii_fields},
        ip_address=ip,
        user_agent=ua,
    )

    await db.commit()
    return await _build_client_response(client_id, db, key, include_deleted=True)
