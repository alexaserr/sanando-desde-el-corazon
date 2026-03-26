"""
Router público — registro de pacientes SIN autenticación.

Rate limit: 3 registros por IP cada 15 minutos.
Idempotente por email: retorna 409 si el email ya existe.
PII cifrado con pgcrypto (mismo patrón que POST /clients).
"""
from uuid import UUID

from fastapi import APIRouter, HTTPException, Request, status
from sqlalchemy import LargeBinary, cast, func, insert, text
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import Depends

from app.config import settings
from app.db.models import (
    AuditAction,
    Client,
    ClientCondition,
    ClientMedication,
    ClientSleep,
    ConditionType,
    FamilyMember,
    FamilyType,
    MaritalStatus,
    SleepQuality,
)
from app.db.session import get_db
from app.rate_limit import limiter
from app.schemas.public_register import PublicRegisterRequest, PublicRegisterResponse
from app.utils.audit import write_audit_log

router = APIRouter(prefix="/api/v1/public", tags=["Público"])


# ── Helpers PII (mismos que en clients.py) ────────────────────

def _enc(value: str | None, key: str):
    """Cifra un valor con pgp_sym_encrypt, o retorna None si el valor es None."""
    if value is None:
        return None
    return func.pgp_sym_encrypt(value, key)


# ── Endpoint ─────────────────────────────────────────────────

@router.post(
    "/register",
    status_code=status.HTTP_201_CREATED,
    response_model=PublicRegisterResponse,
    summary="Registro público de pacientes (sin auth)",
)
@limiter.limit("3/15minutes")
async def public_register(
    data: PublicRegisterRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> PublicRegisterResponse:
    key = settings.CLINICAL_DB_PGCRYPTO_KEY
    ip = request.client.host if request.client else None
    ua = request.headers.get("user-agent")

    # ── 1. Verificar email duplicado (descifra con pgcrypto) ──
    existing = (
        await db.execute(
            text("""
                SELECT id FROM clients
                WHERE pgp_sym_decrypt(email::bytea, :key) = :email
                  AND deleted_at IS NULL
                LIMIT 1
            """),
            {"key": key, "email": data.email},
        )
    ).fetchone()

    if existing is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "CONFLICT",
                "message": "Este correo ya está registrado",
            },
        )

    # ── 2. Mapear marital_status y sleep_quality a enums BD ───
    marital = MaritalStatus(data.marital_status_db) if data.marital_status_db else None
    sleep_q = SleepQuality(data.sleep_quality_db) if data.sleep_quality_db else None

    # ── 3. INSERT en clients (PII cifrado) ────────────────────
    stmt = (
        insert(Client)
        .values(
            full_name=func.pgp_sym_encrypt(data.full_name, key),
            email=_enc(data.email, key),
            phone=_enc(data.phone, key),
            birth_date=data.birth_date,
            birth_place=data.birth_place,
            residence_place=data.residence_place,
            marital_status=marital,
            profession=data.profession,
            num_children=data.num_children,
            num_children_detail=data.num_children_detail,
            num_siblings=data.num_siblings,
            birth_order=data.birth_order,
            predominant_emotions=data.predominant_emotions or None,
            family_abortions=data.family_abortions,
            family_abortions_detail=data.family_abortions_detail,
            deaths_before_41=data.deaths_before_41,
            important_notes=data.important_notes,
            motivation_visit=data.motivation_visit or None,
            motivation_general=data.motivation_general,
        )
        .returning(Client.id, Client.created_at)
    )
    row = (await db.execute(stmt)).one()
    client_id: UUID = row.id
    created_at = row.created_at

    # ── 4. client_conditions (medical) ────────────────────────
    for desc in (data.medical_conditions or []):
        if desc.strip():
            db.add(ClientCondition(
                client_id=client_id,
                condition_type=ConditionType.medical,
                description=desc.strip(),
            ))

    # ── 5. client_conditions (recurring_disease) ──────────────
    for desc in (data.recurring_diseases or []):
        if desc.strip():
            db.add(ClientCondition(
                client_id=client_id,
                condition_type=ConditionType.recurring_disease,
                description=desc.strip(),
            ))

    # ── 6. client_conditions (pain / body_pains) ──────────────
    for desc in (data.body_pains or []):
        if desc.strip():
            db.add(ClientCondition(
                client_id=client_id,
                condition_type=ConditionType.pain,
                description=desc.strip(),
            ))

    # ── 7. client_medications ─────────────────────────────────
    for med_name in (data.medications or []):
        if med_name.strip():
            db.add(ClientMedication(
                client_id=client_id,
                name=med_name.strip(),
            ))

    # ── 8. client_sleep ───────────────────────────────────────
    if data.sleep_hours is not None or sleep_q is not None:
        db.add(ClientSleep(
            client_id=client_id,
            avg_hours=data.sleep_hours,
            quality=sleep_q,
        ))

    # ── 9. family_members (nuclear) ───────────────────────────
    if data.family_nuclear:
        db.add(FamilyMember(
            client_id=client_id,
            family_type=FamilyType.nuclear,
            description=data.family_nuclear,
            dynamics=data.family_nuclear_dynamics,
        ))

    # ── 10. family_members (current) ──────────────────────────
    if data.family_current:
        db.add(FamilyMember(
            client_id=client_id,
            family_type=FamilyType.current,
            description=data.family_current,
            dynamics=data.family_current_dynamics,
        ))

    # ── 11. Audit log (sin PII) ──────────────────────────────
    await write_audit_log(
        db,
        table_name="clients",
        record_id=client_id,
        action=AuditAction.INSERT,
        changed_by=None,  # público — sin usuario autenticado
        new_data={"id": str(client_id), "source": "public_register"},
        ip_address=ip,
        user_agent=ua,
    )

    # ── 12. Commit transacción completa ──────────────────────
    await db.commit()

    # ── 13. Email de confirmación (no bloquea el registro) ──
    try:
        from app.services.email import send_registration_email

        await send_registration_email(data.email, data.full_name)
    except Exception:
        pass  # No fallar el registro si el email falla

    return PublicRegisterResponse(
        data={
            "id": str(client_id),
            "full_name": data.full_name,
            "created_at": created_at.isoformat(),
        },
    )
