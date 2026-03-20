"""
Instancia compartida de slowapi para rate limiting por IP.
Se adjunta a app.state en main.py.
Usa Redis DB 2 como backend (no in-memory).
"""
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.config import get_settings

_settings = get_settings()
_redis_storage = (
    f"{_settings.REDIS_URL}/{_settings.REDIS_DB_RATE_LIMIT}"
)

limiter = Limiter(
    key_func=get_remote_address,
    storage_uri=_redis_storage,
)
