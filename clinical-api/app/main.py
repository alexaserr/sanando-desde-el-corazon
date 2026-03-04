"""
clinical-api — Punto de entrada de la aplicación FastAPI.

Plataforma clínica de Sanando desde el Corazón.
Cumple NOM-004-SSA3-2012 y LFPDPPP.
"""
import logging
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import get_settings

settings = get_settings()

# ── Logging estructurado ──────────────────────────────────────
# getattr tipado explícitamente como int para evitar errores de tipo
_log_level: int = getattr(logging, settings.LOG_LEVEL, logging.INFO)

logging.basicConfig(level=_log_level)

structlog.configure(
    wrapper_class=structlog.make_filtering_bound_logger(_log_level),
)

logger = structlog.get_logger(__name__)


# ── Lifespan (startup / shutdown) ────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """
    Inicializa conexiones al arrancar y las cierra al detener.
    Agregar aquí: pool de BD, cliente Redis, cliente MinIO.
    """
    logger.info(
        "clinical_api.startup",
        environment=settings.ENVIRONMENT,
        port=settings.CLINICAL_API_PORT,
    )

    # TODO: inicializar AsyncEngine de SQLAlchemy
    # TODO: inicializar pool de Redis
    # TODO: inicializar cliente MinIO

    yield

    logger.info("clinical_api.shutdown")

    # TODO: cerrar pools de conexión


# ── Factory de la aplicación ─────────────────────────────────
def create_app() -> FastAPI:
    app = FastAPI(
        title="Clinical API — Sanando desde el Corazón",
        description=(
            "API clínica privada. "
            "Cumple NOM-004-SSA3-2012 (expedientes clínicos) y LFPDPPP."
        ),
        version="1.0.0",
        docs_url=settings.docs_url,
        redoc_url=settings.redoc_url,
        openapi_url=settings.openapi_url,
        lifespan=lifespan,
    )

    # ── CORS ──────────────────────────────────────────────────
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
        expose_headers=["X-Request-ID"],
    )

    # ── Routers ───────────────────────────────────────────────
    # TODO: registrar routers cuando se implementen
    # from app.routers import pacientes, sesiones, citas, auth
    # app.include_router(auth.router,      prefix="/auth",      tags=["auth"])
    # app.include_router(pacientes.router, prefix="/pacientes", tags=["pacientes"])
    # app.include_router(sesiones.router,  prefix="/sesiones",  tags=["sesiones"])
    # app.include_router(citas.router,     prefix="/citas",     tags=["citas"])

    return app


app = create_app()


# ── Endpoints base ────────────────────────────────────────────

@app.get(
    "/health",
    summary="Health check",
    tags=["infra"],
    response_description="Estado del servicio",
)
async def health_check() -> dict[str, str]:
    """
    Verifica que el servicio está activo.
    Usado por Docker Compose y el load balancer.
    """
    return {
        "status": "ok",
        "service": "clinical-api",
        "environment": settings.ENVIRONMENT,
    }


# ── Manejadores de error globales ─────────────────────────────

@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """
    Captura excepciones no manejadas y evita filtrar detalles internos.
    En producción no se expone el traceback.
    """
    logger.error(
        "clinical_api.unhandled_exception",
        method=request.method,
        url=str(request.url),
        error=str(exc),
    )

    body: dict[str, str] = {"detail": "Error interno del servidor"}

    if not settings.is_production:
        body["debug"] = str(exc)

    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content=body,
    )
