"""
Instancia compartida de slowapi para rate limiting por IP.
Se adjunta a app.state en main.py.
Usa Redis DB 2 como backend (no in-memory).
"""
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.config import get_settings

_settings = get_settings()

# REDIS_URL puede incluir /0 al final — reemplazar con el DB correcto
_base = _settings.REDIS_URL.rsplit("/", 1)[0]
_redis_storage = f"{_base}/{_settings.REDIS_DB_RATE_LIMIT}"

limiter = Limiter(
    key_func=get_remote_address,
    storage_uri=_redis_storage,
)
