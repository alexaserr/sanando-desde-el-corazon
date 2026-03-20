"""
Utilidad de audit log INSERT-only.
Nunca hacer UPDATE ni DELETE sobre audit_log (NOM-004 / LFPDPPP).
"""
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import AuditAction, AuditLog

PII_FIELDS: frozenset[str] = frozenset(
    {"full_name", "email", "phone", "notes", "totp_secret"}
)


def scrub_pii(data: dict[str, object] | None) -> dict[str, object] | None:
    """Replace PII field values with '<cifrado>' in audit data."""
    if not data:
        return data
    return {k: "<cifrado>" if k in PII_FIELDS else v for k, v in data.items()}


async def write_audit_log(
    db: AsyncSession,
    table_name: str,
    record_id: UUID,
    action: AuditAction,
    changed_by: UUID | None,
    old_data: dict[str, object] | None = None,
    new_data: dict[str, object] | None = None,
    ip_address: str | None = None,
    user_agent: str | None = None,
) -> None:
    """
    Inserta una entrada en audit_log.
    Se ejecuta dentro de la misma transacción del request.
    PII se reemplaza automáticamente con '<cifrado>'.
    """
    db.add(
        AuditLog(
            table_name=table_name,
            record_id=record_id,
            action=action,
            changed_by=changed_by,
            old_data=scrub_pii(old_data),
            new_data=scrub_pii(new_data),
            ip_address=ip_address,
            user_agent=user_agent,
        )
    )
