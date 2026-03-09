"""
Cliente Redis asíncrono para clinical-api.

Usos:
- Refresh tokens opacos (DB 0, REDIS_DB_SESSIONS)
- Caché (DB 1, REDIS_DB_CACHE)
- Rate limiting (DB 2, REDIS_DB_RATE_LIMIT)
"""
import redis.asyncio as aioredis

from app.config import settings

# Pool compartido — se inicializa una sola vez al primer uso
_pool: aioredis.Redis | None = None


def get_redis() -> aioredis.Redis:
    """Retorna el cliente Redis compartido (pool lazy)."""
    global _pool
    if _pool is None:
        _pool = aioredis.from_url(
            settings.REDIS_URL,
            db=settings.REDIS_DB_SESSIONS,
            encoding="utf-8",
            decode_responses=True,
            max_connections=20,
        )
    return _pool


async def close_redis() -> None:
    """Cierra el pool. Llamar en el shutdown de la app."""
    global _pool
    if _pool is not None:
        await _pool.aclose()
        _pool = None
