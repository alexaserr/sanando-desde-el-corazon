"""
Router de sesiones clínicas — wizard de 7 pasos con autosave.

Pasos del wizard:
  1. PATCH /general             — datos generales de la sesión
  2. PUT   /energy/initial      — lecturas energéticas iniciales (0-100)
  3. PUT   /chakras/initial     — lecturas de chakras iniciales (0-14)
  4. PUT   /topics              — temas trabajados
  5. PUT   /energy/final        — lecturas energéticas finales
  6. PUT   /chakras/final       — lecturas de chakras finales
  7. POST  /close               — cierre y pago

Sub-endpoints (sin número de paso fijo):
  PUT /affectations, /lnt, /cleaning-events, /organs

Cada paso hace autosave y retorna WizardStepResponse con el progreso.
"""
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import func, insert, select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.models import (
    AuditAction,
    Session,
    SessionAffectation,
    SessionChakraReading,
    SessionCleaningEvent,
    SessionEnergyReading,
    SessionLnt,
    SessionOrgan,
    SessionTopic,
    User,
    UserRole,
)
from app.config import get_settings
from app.db.session import get_db
from app.dependencies import require_role
from app.schemas.sessions import (
    AffectationResponse,
    AffectationsUpdate,
    ChakraReadingItem,
    ChakraReadingResponse,
    ChakraReadingsUpdate,
    CleaningEventResponse,
    CleaningEventsUpdate,
    EnergyReadingItem,
    EnergyReadingResponse,
    EnergyReadingsUpdate,
    LNTResponse,
    LNTUpdate,
    OrganResponse,
    OrgansUpdate,
    SessionCloseRequest,
    SessionCreate,
    SessionGeneralUpdate,
    SessionResponse,
    TopicResponse,
    TopicsUpdate,
    WizardStepResponse,
)
from app.utils.audit import write_audit_log

router = APIRouter(prefix="/api/v1/clinical/sessions", tags=["sessions"])

_settings = get_settings()


# ── Helpers ───────────────────────────────────────────────────

async def _get_session_or_404(session_id: UUID, db: AsyncSession) -> Session:
    session = (
        await db.execute(
            select(Session).where(Session.id == session_id, Session.deleted_at.is_(None))
        )
    ).scalar_one_or_none()
    if session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sesión no encontrada")
    return session


async def _get_wizard_state(session_id: UUID, db: AsyncSession) -> WizardStepResponse:
    """Calcula el estado del wizard consultando los sub-registros activos."""

    energy_initial = (
        await db.scalar(
            select(func.count())
            .select_from(SessionEnergyReading)
            .where(
                SessionEnergyReading.session_id == session_id,
                SessionEnergyReading.initial_value.is_not(None),
            )
        )
    ) or 0

    chakra_initial = (
        await db.scalar(
            select(func.count())
            .select_from(SessionChakraReading)
            .where(
                SessionChakraReading.session_id == session_id,
                SessionChakraReading.initial_value.is_not(None),
            )
        )
    ) or 0

    topics_count = (
        await db.scalar(
            select(func.count())
            .select_from(SessionTopic)
            .where(
                SessionTopic.session_id == session_id,
                SessionTopic.deleted_at.is_(None),
            )
        )
    ) or 0

    energy_final = (
        await db.scalar(
            select(func.count())
            .select_from(SessionEnergyReading)
            .where(
                SessionEnergyReading.session_id == session_id,
                SessionEnergyReading.final_value.is_not(None),
            )
        )
    ) or 0

    chakra_final = (
        await db.scalar(
            select(func.count())
            .select_from(SessionChakraReading)
            .where(
                SessionChakraReading.session_id == session_id,
                SessionChakraReading.final_value.is_not(None),
            )
        )
    ) or 0

    lnt_count = (
        await db.scalar(
            select(func.count())
            .select_from(SessionLnt)
            .where(
                SessionLnt.session_id == session_id,
                SessionLnt.deleted_at.is_(None),
            )
        )
    ) or 0

    cleaning_count = (
        await db.scalar(
            select(func.count())
            .select_from(SessionCleaningEvent)
            .where(
                SessionCleaningEvent.session_id == session_id,
                SessionCleaningEvent.deleted_at.is_(None),
            )
        )
    ) or 0

    affectation_count = (
        await db.scalar(
            select(func.count())
            .select_from(SessionAffectation)
            .where(
                SessionAffectation.session_id == session_id,
                SessionAffectation.deleted_at.is_(None),
            )
        )
    ) or 0

    has_energy_initial = energy_initial > 0
    has_chakra_initial = chakra_initial > 0
    has_topics = topics_count > 0
    has_energy_final = energy_final > 0
    has_chakra_final = chakra_final > 0
    has_lnt = lnt_count > 0
    has_cleaning_events = cleaning_count > 0
    has_affectations = affectation_count > 0

    is_closed = all([has_energy_initial, has_chakra_initial, has_topics, has_energy_final, has_chakra_final])

    # Mapa ordenado paso → completado
    _step_flags: list[tuple[int, bool]] = [
        (1, True),                    # sesión creada — siempre True si llegamos aquí
        (2, has_energy_initial),
        (3, has_chakra_initial),
        (4, has_topics),
        (5, has_energy_final),
        (6, has_chakra_final),
        (7, is_closed),
    ]

    completed = [step for step, done in _step_flags if done]

    # Primer paso incompleto = paso actual del wizard
    current_step = next((step for step, done in _step_flags if not done), 7)

    return WizardStepResponse(
        session_id=session_id,
        current_step=current_step,
        completed_steps=completed,
        has_energy_initial=has_energy_initial,
        has_chakra_initial=has_chakra_initial,
        has_topics=has_topics,
        has_energy_final=has_energy_final,
        has_chakra_final=has_chakra_final,
        has_lnt=has_lnt,
        has_cleaning_events=has_cleaning_events,
        has_affectations=has_affectations,
        is_closed=is_closed,
    )


async def _save_energy_readings(
    session_id: UUID,
    readings: list[EnergyReadingItem],
    phase: str,
    db: AsyncSession,
) -> None:
    """
    Upsert de lecturas energéticas para initial o final.
    Usa ON CONFLICT DO UPDATE para preservar el valor de la otra fase.
    """
    for item in readings:
        if phase == "initial":
            stmt = (
                pg_insert(SessionEnergyReading)
                .values(session_id=session_id, dimension_id=item.dimension_id, initial_value=item.value)
                .on_conflict_do_update(
                    constraint="uq_energy_reading_session_dimension",
                    set_={"initial_value": item.value},
                )
            )
        else:
            stmt = (
                pg_insert(SessionEnergyReading)
                .values(session_id=session_id, dimension_id=item.dimension_id, final_value=item.value)
                .on_conflict_do_update(
                    constraint="uq_energy_reading_session_dimension",
                    set_={"final_value": item.value},
                )
            )
        await db.execute(stmt)


async def _save_chakra_readings(
    session_id: UUID,
    readings: list[ChakraReadingItem],
    phase: str,
    db: AsyncSession,
) -> None:
    """
    Upsert de lecturas de chakras (escala 0-14) para initial o final.
    """
    for item in readings:
        if phase == "initial":
            stmt = (
                pg_insert(SessionChakraReading)
                .values(session_id=session_id, chakra_position_id=item.chakra_position_id, initial_value=item.value)
                .on_conflict_do_update(
                    constraint="uq_chakra_reading_session_chakra",
                    set_={"initial_value": item.value},
                )
            )
        else:
            stmt = (
                pg_insert(SessionChakraReading)
                .values(session_id=session_id, chakra_position_id=item.chakra_position_id, final_value=item.value)
                .on_conflict_do_update(
                    constraint="uq_chakra_reading_session_chakra",
                    set_={"final_value": item.value},
                )
            )
        await db.execute(stmt)


async def _replace_soft_delete(
    model: type[Any],
    session_id: UUID,
    new_rows: list[dict[str, Any]],
    db: AsyncSession,
) -> None:
    """
    Soft-delete todos los registros activos de la sub-tabla,
    luego inserta los nuevos. Los registros previos quedan auditables.
    """
    now = datetime.now(timezone.utc)
    await db.execute(
        update(model)
        .where(model.session_id == session_id, model.deleted_at.is_(None))
        .values(deleted_at=now)
    )
    for row_data in new_rows:
        db.add(model(session_id=session_id, **row_data))


async def _build_session_response(session_id: UUID, db: AsyncSession) -> SessionResponse:
    """Carga la sesión con todos sus sub-datos expandidos."""
    session = (
        await db.execute(
            select(Session)
            .options(
                selectinload(Session.energy_readings).selectinload(SessionEnergyReading.dimension),
                selectinload(Session.chakra_readings).selectinload(SessionChakraReading.chakra),
                selectinload(Session.topics),
                selectinload(Session.lnt_entries),
                selectinload(Session.cleaning_events),
                selectinload(Session.affectations),
                selectinload(Session.organs),
            )
            .where(Session.id == session_id)
        )
    ).scalar_one_or_none()

    if session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sesión no encontrada")

    # Descifrar notes (PII — columna bytea cifrada con pgp_sym_encrypt)
    notes_decrypted: str | None = None
    if session.notes is not None:
        notes_decrypted = await db.scalar(
            select(func.pgp_sym_decrypt(Session.notes, _settings.CLINICAL_DB_PGCRYPTO_KEY))
            .where(Session.id == session_id)
        )

    energy_readings = [
        EnergyReadingResponse(
            id=r.id,
            dimension_id=r.dimension_id,
            dimension_name=r.dimension.name,
            initial_value=r.initial_value,
            final_value=r.final_value,
        )
        for r in session.energy_readings
    ]

    chakra_readings = [
        ChakraReadingResponse(
            id=r.id,
            chakra_position_id=r.chakra_position_id,
            chakra_name=r.chakra.name,
            chakra_position=r.chakra.position,
            initial_value=r.initial_value,
            final_value=r.final_value,
        )
        for r in session.chakra_readings
    ]

    return SessionResponse(
        id=session.id,
        client_id=session.client_id,
        therapist_id=session.therapist_id,
        therapy_type_id=session.therapy_type_id,
        session_number=session.session_number,
        measured_at=session.measured_at,
        general_energy_level=session.general_energy_level,
        cost=session.cost,
        entities_count=session.entities_count,
        implants_count=session.implants_count,
        total_cleanings=session.total_cleanings,
        bud=session.bud,
        bud_chakra=session.bud_chakra,
        payment_notes=session.payment_notes,
        notes=notes_decrypted,
        created_at=session.created_at,
        updated_at=session.updated_at,
        deleted_at=session.deleted_at,
        energy_readings=energy_readings,
        chakra_readings=chakra_readings,
        topics=[TopicResponse.model_validate(t) for t in session.topics if t.deleted_at is None],
        lnt_entries=[LNTResponse.model_validate(l) for l in session.lnt_entries if l.deleted_at is None],
        cleaning_events=[CleaningEventResponse.model_validate(e) for e in session.cleaning_events if e.deleted_at is None],
        affectations=[AffectationResponse.model_validate(a) for a in session.affectations if a.deleted_at is None],
        organs=[OrganResponse.model_validate(o) for o in session.organs if o.deleted_at is None],
    )


# ── Endpoints ─────────────────────────────────────────────────

@router.post(
    "",
    status_code=status.HTTP_201_CREATED,
    response_model=SessionResponse,
    summary="Crear sesión (inicia wizard)",
)
async def create_session(
    data: SessionCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.therapist, UserRole.admin)),
) -> SessionResponse:
    ip = request.client.host if request.client else None
    ua = request.headers.get("user-agent")

    stmt = (
        insert(Session)
        .values(
            client_id=data.client_id,
            therapist_id=current_user.id,
            therapy_type_id=data.therapy_type_id,
            measured_at=data.measured_at,
            session_number=data.session_number,
        )
        .returning(Session.id)
    )
    session_id: UUID = (await db.execute(stmt)).scalar_one()

    await write_audit_log(
        db,
        table_name="sessions",
        record_id=session_id,
        action=AuditAction.INSERT,
        changed_by=current_user.id,
        new_data={"id": str(session_id), "client_id": str(data.client_id) if data.client_id else None},
        ip_address=ip,
        user_agent=ua,
    )

    await db.commit()
    return await _build_session_response(session_id, db)


@router.get(
    "/{session_id}",
    response_model=SessionResponse,
    summary="Obtener sesión completa con todos los sub-datos",
)
async def get_session(
    session_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.therapist, UserRole.admin)),
) -> SessionResponse:
    return await _build_session_response(session_id, db)


@router.patch(
    "/{session_id}/general",
    response_model=WizardStepResponse,
    summary="Paso 1: datos generales de la sesión",
)
async def update_general(
    session_id: UUID,
    data: SessionGeneralUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.therapist, UserRole.admin)),
) -> WizardStepResponse:
    await _get_session_or_404(session_id, db)

    update_data = data.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Sin campos para actualizar")

    # Cifrar notes antes de guardar (PII)
    if "notes" in update_data and update_data["notes"] is not None:
        update_data["notes"] = func.pgp_sym_encrypt(
            update_data["notes"], _settings.CLINICAL_DB_PGCRYPTO_KEY
        )

    update_data["updated_at"] = func.now()
    await db.execute(update(Session).where(Session.id == session_id).values(**update_data))

    # Excluir notes del audit log — es PII cifrado
    audit_fields = {
        k: str(v) if v is not None else None
        for k, v in data.model_dump(exclude_unset=True).items()
        if k != "notes"
    }
    if "notes" in data.model_dump(exclude_unset=True):
        audit_fields["notes"] = "<cifrado>"

    await write_audit_log(
        db,
        table_name="sessions",
        record_id=session_id,
        action=AuditAction.UPDATE,
        changed_by=current_user.id,
        new_data=audit_fields,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )

    await db.commit()
    return await _get_wizard_state(session_id, db)


@router.put(
    "/{session_id}/energy/initial",
    response_model=WizardStepResponse,
    summary="Paso 2: lecturas energéticas iniciales (0-100)",
)
async def save_energy_initial(
    session_id: UUID,
    data: EnergyReadingsUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.therapist, UserRole.admin)),
) -> WizardStepResponse:
    await _get_session_or_404(session_id, db)
    await _save_energy_readings(session_id, data.readings, "initial", db)

    await write_audit_log(
        db, "session_energy_readings", session_id, AuditAction.UPDATE, current_user.id,
        new_data={"phase": "initial", "count": len(data.readings)},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )

    await db.commit()
    return await _get_wizard_state(session_id, db)


@router.put(
    "/{session_id}/chakras/initial",
    response_model=WizardStepResponse,
    summary="Paso 3: lecturas de chakras iniciales (0-14)",
)
async def save_chakras_initial(
    session_id: UUID,
    data: ChakraReadingsUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.therapist, UserRole.admin)),
) -> WizardStepResponse:
    await _get_session_or_404(session_id, db)
    await _save_chakra_readings(session_id, data.readings, "initial", db)

    await write_audit_log(
        db, "session_chakra_readings", session_id, AuditAction.UPDATE, current_user.id,
        new_data={"phase": "initial", "count": len(data.readings)},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )

    await db.commit()
    return await _get_wizard_state(session_id, db)


@router.put(
    "/{session_id}/topics",
    response_model=WizardStepResponse,
    summary="Paso 4: temas trabajados (reemplaza los existentes, soft delete previos)",
)
async def save_topics(
    session_id: UUID,
    data: TopicsUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.therapist, UserRole.admin)),
) -> WizardStepResponse:
    await _get_session_or_404(session_id, db)
    await _replace_soft_delete(SessionTopic, session_id, [t.model_dump() for t in data.topics], db)

    await write_audit_log(
        db, "session_topics", session_id, AuditAction.UPDATE, current_user.id,
        new_data={"count": len(data.topics)},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )

    await db.commit()
    return await _get_wizard_state(session_id, db)


@router.put(
    "/{session_id}/energy/final",
    response_model=WizardStepResponse,
    summary="Paso 5: lecturas energéticas finales (0-100)",
)
async def save_energy_final(
    session_id: UUID,
    data: EnergyReadingsUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.therapist, UserRole.admin)),
) -> WizardStepResponse:
    await _get_session_or_404(session_id, db)
    await _save_energy_readings(session_id, data.readings, "final", db)

    await write_audit_log(
        db, "session_energy_readings", session_id, AuditAction.UPDATE, current_user.id,
        new_data={"phase": "final", "count": len(data.readings)},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )

    await db.commit()
    return await _get_wizard_state(session_id, db)


@router.put(
    "/{session_id}/chakras/final",
    response_model=WizardStepResponse,
    summary="Paso 6: lecturas de chakras finales (0-14)",
)
async def save_chakras_final(
    session_id: UUID,
    data: ChakraReadingsUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.therapist, UserRole.admin)),
) -> WizardStepResponse:
    await _get_session_or_404(session_id, db)
    await _save_chakra_readings(session_id, data.readings, "final", db)

    await write_audit_log(
        db, "session_chakra_readings", session_id, AuditAction.UPDATE, current_user.id,
        new_data={"phase": "final", "count": len(data.readings)},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )

    await db.commit()
    return await _get_wizard_state(session_id, db)


@router.post(
    "/{session_id}/close",
    response_model=SessionResponse,
    summary="Paso 7: cierre de sesión y registro de pago",
)
async def close_session(
    session_id: UUID,
    data: SessionCloseRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.therapist, UserRole.admin)),
) -> SessionResponse:
    await _get_session_or_404(session_id, db)

    values: dict = {"updated_at": func.now()}
    if data.cost is not None:
        values["cost"] = data.cost
    if data.payment_notes is not None:
        values["payment_notes"] = data.payment_notes

    await db.execute(update(Session).where(Session.id == session_id).values(**values))

    await write_audit_log(
        db, "sessions", session_id, AuditAction.UPDATE, current_user.id,
        new_data={"action": "close", "cost": str(data.cost) if data.cost else None},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )

    await db.commit()
    return await _build_session_response(session_id, db)


# ── Sub-endpoints (sin número de paso fijo) ───────────────────

@router.put(
    "/{session_id}/affectations",
    response_model=WizardStepResponse,
    summary="Guardar afectaciones por chakra (reemplaza existentes)",
)
async def save_affectations(
    session_id: UUID,
    data: AffectationsUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.therapist, UserRole.admin)),
) -> WizardStepResponse:
    await _get_session_or_404(session_id, db)
    await _replace_soft_delete(
        SessionAffectation, session_id, [a.model_dump() for a in data.affectations], db
    )

    await write_audit_log(
        db, "session_affectations", session_id, AuditAction.UPDATE, current_user.id,
        new_data={"count": len(data.affectations)},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )

    await db.commit()
    return await _get_wizard_state(session_id, db)


@router.put(
    "/{session_id}/lnt",
    response_model=WizardStepResponse,
    summary="Guardar entradas LNT (reemplaza existentes)",
)
async def save_lnt(
    session_id: UUID,
    data: LNTUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.therapist, UserRole.admin)),
) -> WizardStepResponse:
    await _get_session_or_404(session_id, db)
    await _replace_soft_delete(SessionLnt, session_id, [e.model_dump() for e in data.entries], db)

    await write_audit_log(
        db, "session_lnt", session_id, AuditAction.UPDATE, current_user.id,
        new_data={"count": len(data.entries)},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )

    await db.commit()
    return await _get_wizard_state(session_id, db)


@router.put(
    "/{session_id}/cleaning-events",
    response_model=WizardStepResponse,
    summary="Guardar eventos de limpieza (reemplaza existentes)",
)
async def save_cleaning_events(
    session_id: UUID,
    data: CleaningEventsUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.therapist, UserRole.admin)),
) -> WizardStepResponse:
    await _get_session_or_404(session_id, db)
    await _replace_soft_delete(
        SessionCleaningEvent, session_id, [e.model_dump() for e in data.events], db
    )

    await write_audit_log(
        db, "session_cleaning_events", session_id, AuditAction.UPDATE, current_user.id,
        new_data={"count": len(data.events)},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )

    await db.commit()
    return await _get_wizard_state(session_id, db)


@router.put(
    "/{session_id}/organs",
    response_model=WizardStepResponse,
    summary="Guardar órganos y columna vertebral (reemplaza existentes)",
)
async def save_organs(
    session_id: UUID,
    data: OrgansUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.therapist, UserRole.admin)),
) -> WizardStepResponse:
    await _get_session_or_404(session_id, db)
    await _replace_soft_delete(SessionOrgan, session_id, [o.model_dump() for o in data.organs], db)

    await write_audit_log(
        db, "session_organs", session_id, AuditAction.UPDATE, current_user.id,
        new_data={"count": len(data.organs)},
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
    )

    await db.commit()
    return await _get_wizard_state(session_id, db)
