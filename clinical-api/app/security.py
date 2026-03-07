"""
Utilidades de seguridad: JWT RS256, bcrypt, TOTP.
Las claves PEM se leen desde config.settings (cacheadas en disco una sola vez).
"""
from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import UUID

import bcrypt
import pyotp
from jose import JWTError, jwt

from app.config import settings


def create_access_token(user_id: UUID, role: str) -> str:
    """JWT RS256 de acceso, expira en JWT_ACCESS_TOKEN_EXPIRE_MINUTES."""
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES
    )
    payload = {
        "sub": str(user_id),
        "role": role,
        "type": "access",
        "exp": expire,
    }
    return jwt.encode(payload, settings.jwt_private_key, algorithm=settings.JWT_ALGORITHM)


def create_pending_2fa_token(user_id: UUID) -> str:
    """Token de corta duración (5 min) usado durante el flujo de verificación 2FA."""
    expire = datetime.now(timezone.utc) + timedelta(minutes=5)
    payload = {
        "sub": str(user_id),
        "type": "2fa_pending",
        "exp": expire,
    }
    return jwt.encode(payload, settings.jwt_private_key, algorithm=settings.JWT_ALGORITHM)


def create_refresh_token(user_id: UUID) -> str:
    """JWT RS256 de refresh, expira en JWT_REFRESH_TOKEN_EXPIRE_DAYS."""
    expire = datetime.now(timezone.utc) + timedelta(
        days=settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS
    )
    payload = {
        "sub": str(user_id),
        "type": "refresh",
        "exp": expire,
    }
    return jwt.encode(payload, settings.jwt_private_key, algorithm=settings.JWT_ALGORITHM)


def decode_token(token: str) -> dict[str, Any]:
    """Decodifica y valida la firma RS256. Lanza ValueError si el token es inválido."""
    try:
        return jwt.decode(
            token,
            settings.jwt_public_key,
            algorithms=[settings.JWT_ALGORITHM],
        )
    except JWTError as exc:
        raise ValueError("Token inválido o expirado") from exc


def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt(rounds=12)).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def generate_totp_secret() -> str:
    return pyotp.random_base32()


def verify_totp(secret: str, code: str) -> bool:
    """Verifica un código TOTP con ventana de ±1 intervalo (30 s)."""
    return pyotp.TOTP(secret).verify(code, valid_window=1)
