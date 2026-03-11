"""
Router de temas clínicos persistentes y entradas de sesión por tema.

Endpoints:
  GET/POST/PATCH/DELETE /api/v1/clinical/clients/{client_id}/topics
  PUT/GET               /api/v1/clinical/sessions/{session_id}/theme-entries
  GET                   /api/v1/catalogs/chakra-organs
  GET                   /api/v1/clinical/clients/{client_id}/topics/{topic_id}/stats

Soft delete en client_topics — nunca DELETE físico (NOM-004).
"""
from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import delete, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import (
    ChakraOrgan,
    ChakraPosition,
    Client,
    ClientTopic,
    Session,
    SessionThemeEntry,
    User,
    UserRole,
)
from app.db.session import get_db
from app.dependencies import require_role
from app.schemas.topics import (
    ChakraOrganResponse,
    ClientTopicCreate,
    ClientTopicResponse,
    ClientTopicUpdate,
    OrganWorkedItem,
    ChakraInvolvedItem,
    ThemeEntriesPut,
    ThemeEntriesPutResponse,
    ThemeEntryResponse,
    TopicStatsResponse,
)

router_clinical = APIRouter(prefix="/api/v1/clinical", tags=["topics"])
router_catalogs = APIRouter(prefix="/api/v1/catalogs", tags=["catalogs"])

# Cache del catálogo de órganos (datos estáticos, no cambian en runtime)
_chakra_organs_cache: list[ChakraOrganResponse] | None = None


# ── Helpers ────────────────────────────────────────────────────────────────────

async def _get_active_client(client_id: UUID, db: AsyncSession) -> None:
    """Verifica que el cliente existe y no está soft-deleted."""
    exists = await db.scalar(
        select(func.count(Client.id))
        .where(Client.id == client_id)
        .where(Client.deleted_at.is_(None))
    )
    if not exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Cliente no encontrado")


async def _get_active_topic(topic_id: UUID, client_id: UUID, db: AsyncSession) -> ClientTopic:
    """Carga el tema verificando que pertenece al cliente y no está borrado."""
    topic = (
        await db.execute(
            select(ClientTopic)
            .where(ClientTopic.id == topic_id)
            .where(ClientTopic.client_id == client_id)
            .where(ClientTopic.deleted_at.is_(None))
        )
    ).scalar_one_or_none()
    if topic is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Tema no encontrado")
    return topic


async def _get_active_session(session_id: UUID, db: AsyncSession) -> None:
    """Verifica que la sesión existe y no está soft-deleted."""
    exists = await db.scalar(
        select(func.count(Session.id))
        .where(Session.id == session_id)
        .where(Session.deleted_at.is_(None))
    )
    if not exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sesión no encontrada")


# ══════════════════════════════════════════════════════════════
# CLIENT TOPICS CRUD
# ══════════════════════════════════════════════════════════════

@router_clinical.get(
    "/clients/{client_id}/topics",
    response_model=list[ClientTopicResponse],
    summary="Listar temas de un paciente",
)
async def list_client_topics(
    client_id: UUID,
    include_completed: bool = Query(False, description="Incluir temas completados"),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.therapist, UserRole.admin)),
) -> list[ClientTopicResponse]:
    await _get_active_client(client_id, db)

    stmt = (
        select(ClientTopic)
        .where(ClientTopic.client_id == client_id)
        .where(ClientTopic.deleted_at.is_(None))
        .order_by(ClientTopic.created_at.asc())
    )
    if not include_completed:
        stmt = stmt.where(ClientTopic.is_completed.is_(False))

    rows = (await db.execute(stmt)).scalars().all()
    return [ClientTopicResponse.model_validate(r) for r in rows]


@router_clinical.post(
    "/clients/{client_id}/topics",
    response_model=ClientTopicResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Crear tema persistente para un paciente",
)
async def create_client_topic(
    client_id: UUID,
    data: ClientTopicCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.therapist, UserRole.admin)),
) -> ClientTopicResponse:
    await _get_active_client(client_id, db)

    topic = ClientTopic(client_id=client_id, name=data.name)
    db.add(topic)
    await db.flush()
    await db.refresh(topic)
    await db.commit()
    return ClientTopicResponse.model_validate(topic)


@router_clinical.patch(
    "/clients/{client_id}/topics/{topic_id}",
    response_model=ClientTopicResponse,
    summary="Actualizar tema (progreso, nombre, completado)",
)
async def update_client_topic(
    client_id: UUID,
    topic_id: UUID,
    data: ClientTopicUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.therapist, UserRole.admin)),
) -> ClientTopicResponse:
    await _get_active_client(client_id, db)
    topic = await _get_active_topic(topic_id, client_id, db)

    update_data = data.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Sin campos para actualizar",
        )

    for field, value in update_data.items():
        setattr(topic, field, value)

    # Si se marca como completado, registrar la fecha
    if update_data.get("is_completed") is True and topic.completed_at is None:
        topic.completed_at = datetime.now(timezone.utc)

    topic.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(topic)
    return ClientTopicResponse.model_validate(topic)


@router_clinical.delete(
    "/clients/{client_id}/topics/{topic_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Eliminar tema (soft delete)",
)
async def delete_client_topic(
    client_id: UUID,
    topic_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.therapist, UserRole.admin)),
) -> None:
    await _get_active_client(client_id, db)
    topic = await _get_active_topic(topic_id, client_id, db)

    now = datetime.now(timezone.utc)
    topic.deleted_at = now
    topic.updated_at = now
    await db.commit()


# ══════════════════════════════════════════════════════════════
# SESSION THEME ENTRIES
# ══════════════════════════════════════════════════════════════

@router_clinical.put(
    "/sessions/{session_id}/theme-entries",
    response_model=ThemeEntriesPutResponse,
    summary="Reemplazar entradas de temas en una sesión y actualizar progreso",
)
async def put_session_theme_entries(
    session_id: UUID,
    data: ThemeEntriesPut,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.therapist, UserRole.admin)),
) -> ThemeEntriesPutResponse:
    await _get_active_session(session_id, db)

    # Validar que todos los client_topic_id referenciados existen y no están borrados
    topic_ids = {e.client_topic_id for e in data.entries}
    existing_count = await db.scalar(
        select(func.count(ClientTopic.id))
        .where(ClientTopic.id.in_(topic_ids))
        .where(ClientTopic.deleted_at.is_(None))
    )
    if existing_count != len(topic_ids):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Uno o más client_topic_id no existen o están eliminados",
        )

    # Soft delete de las entradas previas de esta sesión
    now = datetime.now(timezone.utc)
    await db.execute(
        update(SessionThemeEntry)
        .where(SessionThemeEntry.session_id == session_id)
        .where(SessionThemeEntry.deleted_at.is_(None))
        .values(deleted_at=now, updated_at=now)
    )

    # Insertar nuevas entradas
    new_entries: list[SessionThemeEntry] = []
    for item in data.entries:
        entry = SessionThemeEntry(
            session_id=session_id,
            client_topic_id=item.client_topic_id,
            entry_type=item.entry_type,
            chakra_position_id=item.chakra_position_id,
            organ_name=item.organ_name,
            initial_energy=item.initial_energy,
            final_energy=item.final_energy,
            childhood_place=item.childhood_place,
            childhood_people=item.childhood_people,
            childhood_situation=item.childhood_situation,
            childhood_description=item.childhood_description,
            childhood_emotions=item.childhood_emotions,
            adulthood_place=item.adulthood_place,
            adulthood_people=item.adulthood_people,
            adulthood_situation=item.adulthood_situation,
            adulthood_description=item.adulthood_description,
            adulthood_emotions=item.adulthood_emotions,
        )
        db.add(entry)
        new_entries.append(entry)

    # Actualizar progreso de los temas indicados
    updated_topics: list[ClientTopic] = []
    for tp in data.topic_progress:
        result = await db.execute(
            update(ClientTopic)
            .where(ClientTopic.id == tp.client_topic_id)
            .where(ClientTopic.deleted_at.is_(None))
            .values(progress_pct=tp.progress_pct, updated_at=now)
            .returning(ClientTopic)
        )
        topic_obj = result.scalar_one_or_none()
        if topic_obj is not None:
            updated_topics.append(topic_obj)

    await db.flush()
    for entry in new_entries:
        await db.refresh(entry)
    await db.commit()

    return ThemeEntriesPutResponse(
        entries=[ThemeEntryResponse.model_validate(e) for e in new_entries],
        topics_updated=[ClientTopicResponse.model_validate(t) for t in updated_topics],
    )


@router_clinical.get(
    "/sessions/{session_id}/theme-entries",
    response_model=list[ThemeEntryResponse],
    summary="Obtener entradas de temas de una sesión",
)
async def get_session_theme_entries(
    session_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.therapist, UserRole.admin)),
) -> list[ThemeEntryResponse]:
    await _get_active_session(session_id, db)

    rows = (
        await db.execute(
            select(SessionThemeEntry)
            .where(SessionThemeEntry.session_id == session_id)
            .where(SessionThemeEntry.deleted_at.is_(None))
            .order_by(SessionThemeEntry.created_at.asc())
        )
    ).scalars().all()

    return [ThemeEntryResponse.model_validate(r) for r in rows]


# ══════════════════════════════════════════════════════════════
# CATÁLOGO CHAKRA ORGANS
# ══════════════════════════════════════════════════════════════

@router_catalogs.get(
    "/chakra-organs",
    response_model=list[ChakraOrganResponse],
    summary="Catálogo de órganos por chakra (cache 24h en memoria)",
)
async def list_chakra_organs(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.therapist, UserRole.admin)),
) -> list[ChakraOrganResponse]:
    global _chakra_organs_cache
    if _chakra_organs_cache is None:
        rows = (
            await db.execute(
                select(ChakraOrgan)
                .order_by(ChakraOrgan.chakra_position_id, ChakraOrgan.organ_name)
            )
        ).scalars().all()
        _chakra_organs_cache = [ChakraOrganResponse.model_validate(r) for r in rows]
    return _chakra_organs_cache


# ══════════════════════════════════════════════════════════════
# ESTADÍSTICAS DE TEMA
# ══════════════════════════════════════════════════════════════

@router_clinical.get(
    "/clients/{client_id}/topics/{topic_id}/stats",
    response_model=TopicStatsResponse,
    summary="Estadísticas de un tema: sesiones, órganos y chakras involucrados",
)
async def get_topic_stats(
    client_id: UUID,
    topic_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.therapist, UserRole.admin)),
) -> TopicStatsResponse:
    await _get_active_client(client_id, db)
    topic = await _get_active_topic(topic_id, client_id, db)

    # Todas las entradas activas del tema (todas las sesiones)
    entries = (
        await db.execute(
            select(
                SessionThemeEntry.organ_name,
                SessionThemeEntry.initial_energy,
                SessionThemeEntry.final_energy,
                SessionThemeEntry.chakra_position_id,
                Session.measured_at,
            )
            .join(Session, SessionThemeEntry.session_id == Session.id)
            .where(SessionThemeEntry.client_topic_id == topic_id)
            .where(SessionThemeEntry.deleted_at.is_(None))
            .where(Session.deleted_at.is_(None))
            .order_by(Session.measured_at.desc())
        )
    ).mappings().all()

    # Sesiones únicas con este tema
    session_ids_result = (
        await db.execute(
            select(SessionThemeEntry.session_id)
            .where(SessionThemeEntry.client_topic_id == topic_id)
            .where(SessionThemeEntry.deleted_at.is_(None))
            .distinct()
        )
    ).scalars().all()
    sessions_count = len(session_ids_result)

    # Órganos trabajados (excluyendo filas sin órgano)
    organs_worked = [
        OrganWorkedItem(
            organ_name=r["organ_name"],
            initial_energy=r["initial_energy"],
            final_energy=r["final_energy"],
            session_date=r["measured_at"],
        )
        for r in entries
        if r["organ_name"]
    ]

    # Chakras involucrados (con conteo)
    chakra_position_ids = [r["chakra_position_id"] for r in entries if r["chakra_position_id"]]
    chakras_involved: list[ChakraInvolvedItem] = []
    if chakra_position_ids:
        chakra_rows = (
            await db.execute(
                select(ChakraPosition.name, func.count().label("count"))
                .join(
                    SessionThemeEntry,
                    SessionThemeEntry.chakra_position_id == ChakraPosition.id,
                )
                .where(SessionThemeEntry.client_topic_id == topic_id)
                .where(SessionThemeEntry.deleted_at.is_(None))
                .group_by(ChakraPosition.name)
                .order_by(func.count().desc())
            )
        ).mappings().all()
        chakras_involved = [
            ChakraInvolvedItem(chakra_name=r["name"], count=r["count"])
            for r in chakra_rows
        ]

    return TopicStatsResponse(
        topic=ClientTopicResponse.model_validate(topic),
        sessions_count=sessions_count,
        organs_worked=organs_worked,
        chakras_involved=chakras_involved,
    )
