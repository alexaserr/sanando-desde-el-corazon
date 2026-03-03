"""
podcast-api — Punto de entrada de la aplicación FastAPI.
Podcast de Sanando desde el Corazón.
"""
import logging
from contextlib import asynccontextmanager
from typing import AsyncGenerator

import structlog
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import get_settings

settings = get_settings()

logging.basicConfig(level=getattr(logging, settings.LOG_LEVEL, logging.INFO))
structlog.configure(
    wrapper_class=structlog.make_filtering_bound_logger(
        getattr(logging, settings.LOG_LEVEL, logging.INFO)
    ),
)

logger = structlog.get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    logger.info(
        "podcast_api.startup",
        environment=settings.ENVIRONMENT,
        port=settings.PODCAST_API_PORT,
    )

    # TODO: inicializar AsyncEngine de SQLAlchemy
    # TODO: inicializar pool de Redis
    # TODO: inicializar cliente MinIO (bucket de episodios)

    yield

    logger.info("podcast_api.shutdown")


def create_app() -> FastAPI:
    app = FastAPI(
        title="Podcast API — Sanando desde el Corazón",
        description="API para gestión y distribución del podcast.",
        version="1.0.0",
        docs_url=settings.docs_url,
        redoc_url=settings.redoc_url,
        openapi_url=settings.openapi_url,
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
        expose_headers=["X-Request-ID"],
    )

    # TODO: registrar routers cuando se implementen
    # from app.routers import episodios, temporadas, rss, auth
    # app.include_router(auth.router,        prefix="/auth",       tags=["auth"])
    # app.include_router(temporadas.router,  prefix="/temporadas", tags=["temporadas"])
    # app.include_router(episodios.router,   prefix="/episodes",   tags=["episodios"])
    # app.include_router(rss.router,         prefix="/rss",        tags=["rss"])

    return app


app = create_app()


@app.get("/health", summary="Health check", tags=["infra"])
async def health_check() -> dict[str, str]:
    return {
        "status": "ok",
        "service": "podcast-api",
        "environment": settings.ENVIRONMENT,
    }


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.error(
        "podcast_api.unhandled_exception",
        method=request.method,
        url=str(request.url),
        error=str(exc),
        exc_info=not settings.is_production,
    )

    body: dict[str, str] = {"detail": "Error interno del servidor"}
    if not settings.is_production:
        body["debug"] = str(exc)

    return JSONResponse(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, content=body)
