"""
Router de catálogos estáticos: terapias, chakras, dimensiones energéticas.

Los catálogos se cachean en memoria (módulo-level) al primer acceso,
ya que son datos de referencia que no cambian en runtime.
"""
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import APIRouter, Depends

from app.db.models import ChakraPosition, EnergyDimension, TherapyType, User, UserRole
from app.db.session import get_db
from app.dependencies import require_role
from app.schemas.catalogs import ChakraResponse, DimensionResponse, TherapyTypeResponse

router = APIRouter(prefix="/api/v1/catalogs", tags=["catalogs"])

# Cache en memoria — se puebla una vez por proceso
_cache: dict[str, list] = {}


@router.get(
    "/therapy-types",
    response_model=list[TherapyTypeResponse],
    summary="Listar tipos de terapia",
)
async def list_therapy_types(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.therapist, UserRole.admin)),
) -> list[TherapyTypeResponse]:
    if "therapy_types" not in _cache:
        rows = (
            await db.execute(
                select(TherapyType)
                .where(TherapyType.deleted_at.is_(None))
                .order_by(TherapyType.name)
            )
        ).scalars().all()
        _cache["therapy_types"] = [TherapyTypeResponse.model_validate(r) for r in rows]
    return _cache["therapy_types"]  # type: ignore[return-value]


@router.get(
    "/chakras",
    response_model=list[ChakraResponse],
    summary="Listar posiciones de chakra (1-7)",
)
async def list_chakras(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.therapist, UserRole.admin)),
) -> list[ChakraResponse]:
    if "chakras" not in _cache:
        rows = (
            await db.execute(
                select(ChakraPosition).order_by(ChakraPosition.position)
            )
        ).scalars().all()
        _cache["chakras"] = [ChakraResponse.model_validate(r) for r in rows]
    return _cache["chakras"]  # type: ignore[return-value]


@router.get(
    "/energy-dimensions",
    response_model=list[DimensionResponse],
    summary="Listar dimensiones energéticas (9 activas, 13 planeadas)",
)
async def list_energy_dimensions(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role(UserRole.therapist, UserRole.admin)),
) -> list[DimensionResponse]:
    if "energy_dimensions" not in _cache:
        rows = (
            await db.execute(
                select(EnergyDimension).order_by(EnergyDimension.display_order)
            )
        ).scalars().all()
        _cache["energy_dimensions"] = [DimensionResponse.model_validate(r) for r in rows]
    return _cache["energy_dimensions"]  # type: ignore[return-value]
