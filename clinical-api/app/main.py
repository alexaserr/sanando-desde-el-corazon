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
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.config import get_settings
from app.rate_limit import limiter

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
    """
    from app.db.session import engine
    from app.redis_client import close_redis, get_redis

    logger.info(
        "clinical_api.startup",
        environment=settings.ENVIRONMENT,
        port=settings.CLINICAL_API_PORT,
    )

    # Inicializar pool de Redis (lazy — get_redis() crea el pool)
    get_redis()

    # TODO: inicializar cliente MinIO

    yield

    await engine.dispose()
    await close_redis()
    logger.info("clinical_api.shutdown")


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

    # ── Rate limiting ─────────────────────────────────────────
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

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
    from app.routers.auth import router as auth_router
    from app.routers.clients import router as clients_router
    from app.routers.sessions import router as sessions_router
    from app.routers.catalogs import router as catalogs_router
    from app.routers.dashboard import router as dashboard_router
    from app.routers.topics import router_clinical as topics_clinical_router
    from app.routers.topics import router_catalogs as topics_catalogs_router
    from app.routers.pdf import router as pdf_router
    from app.routers.admin_users import router as admin_users_router
    from app.routers.public import router as public_router

    app.include_router(auth_router)
    app.include_router(admin_users_router)
    app.include_router(clients_router)
    app.include_router(sessions_router)
    app.include_router(catalogs_router)
    app.include_router(dashboard_router)
    app.include_router(topics_clinical_router)
    app.include_router(topics_catalogs_router)
    app.include_router(pdf_router)
    app.include_router(public_router)

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
