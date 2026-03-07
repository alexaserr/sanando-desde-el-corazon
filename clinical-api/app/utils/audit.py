"""
Utilidad de audit log INSERT-only.
Nunca hacer UPDATE ni DELETE sobre audit_log (NOM-004 / LFPDPPP).
"""
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import AuditAction, AuditLog


async def write_audit_log(
    db: AsyncSession,
    table_name: str,
    record_id: UUID,
    action: AuditAction,
    changed_by: UUID | None,
    old_data: dict | None = None,
    new_data: dict | None = None,
    ip_address: str | None = None,
    user_agent: str | None = None,
) -> None:
    """
    Inserta una entrada en audit_log.
    Se ejecuta dentro de la misma transacción del request.
    """
    db.add(
        AuditLog(
            table_name=table_name,
            record_id=record_id,
            action=action,
            changed_by=changed_by,
            old_data=old_data,
            new_data=new_data,
            ip_address=ip_address,
            user_agent=user_agent,
        )
    )
