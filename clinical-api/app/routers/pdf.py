"""
Router de exportación PDF para reportes de sesión clínica.

Genera un PDF con weasyprint a partir de los datos completos de una sesión,
incluyendo dimensiones energéticas, chakras, temas, LNT, limpiezas y ancestros.
"""
from datetime import datetime, timezone
from decimal import Decimal
from io import BytesIO
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy import LargeBinary, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from weasyprint import HTML

from app.config import get_settings
from app.db.models import (
    ChakraPosition,
    Client,
    Session,
    SessionAffectation,
    SessionChakraReading,
    SessionEnergyReading,
    SessionThemeEntry,
    User,
    UserRole,
)
from app.db.session import get_db
from app.dependencies import require_role

router = APIRouter(prefix="/api/v1/clinical/sessions", tags=["pdf"])

_settings = get_settings()


# ── Helpers ───────────────────────────────────────────────────

def _fmt_date(dt: datetime) -> str:
    return dt.strftime("%d/%m/%Y %H:%M")


def _fmt_decimal(v: Decimal | None) -> str:
    if v is None:
        return "—"
    # Remove trailing zeros: 7.50 → 7.5, 11.00 → 11
    return f"{v:g}" if float(v) == int(v) else f"{v:.1f}"


def _delta(initial: Decimal | None, final: Decimal | None) -> str:
    if initial is None or final is None:
        return "—"
    d = final - initial
    sign = "+" if d > 0 else ""
    return f"{sign}{_fmt_decimal(d)}"


def _check(val: bool | None) -> str:
    return "&#10003;" if val else ""


def _esc(val: str | None) -> str:
    """Escape HTML entities."""
    if val is None:
        return ""
    return (
        val.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


# ── HTML sections ────────────────────────────────────────────

_CSS = """\
@import url('https://fonts.googleapis.com/css2?family=Lato:wght@300;400;700&family=Playfair+Display:wght@600;700&display=swap');
body { font-family: 'Lato', sans-serif; color: #2C2220; margin: 40px; font-size: 12px; }
h1 { font-family: 'Playfair Display', serif; color: #2C2220; font-size: 24px; border-bottom: 2px solid #C4704A; padding-bottom: 8px; }
h2 { font-family: 'Playfair Display', serif; color: #C4704A; font-size: 16px; margin-top: 24px; }
table { width: 100%; border-collapse: collapse; margin: 12px 0; }
th { background: #FAF7F5; color: #4A3628; text-transform: uppercase; font-size: 10px; letter-spacing: 0.05em; padding: 8px; text-align: left; border-bottom: 1px solid #D4A592; }
td { padding: 6px 8px; border-bottom: 1px solid #F2E8E4; }
.meta { color: #4A3628; font-size: 11px; }
.chip { display: inline-block; background: #FAF7F5; border: 1px solid #D4A592; border-radius: 12px; padding: 2px 8px; font-size: 10px; margin: 2px; }
.footer { margin-top: 40px; border-top: 1px solid #D4A592; padding-top: 12px; font-size: 10px; color: #4A3628; text-align: center; }
"""


def _section_general(
    client_name: str | None,
    therapist_name: str | None,
    therapy_name: str | None,
    measured_at: datetime,
    session_number: int | None,
    general_energy: int | None,
) -> str:
    rows = []
    if client_name:
        rows.append(f"<tr><td><strong>Paciente</strong></td><td>{_esc(client_name)}</td></tr>")
    if therapist_name:
        rows.append(f"<tr><td><strong>Terapeuta</strong></td><td>{_esc(therapist_name)}</td></tr>")
    if therapy_name:
        rows.append(f"<tr><td><strong>Terapia</strong></td><td>{_esc(therapy_name)}</td></tr>")
    rows.append(f"<tr><td><strong>Fecha</strong></td><td>{_fmt_date(measured_at)}</td></tr>")
    if session_number is not None:
        rows.append(f"<tr><td><strong>Sesión #</strong></td><td>{session_number}</td></tr>")
    if general_energy is not None:
        rows.append(f"<tr><td><strong>Energía general</strong></td><td>{general_energy}%</td></tr>")
    return f'<h2>Datos generales</h2><table class="meta">{"".join(rows)}</table>'


def _section_energy(readings: list[dict[str, str]], has_final: bool) -> str:
    if not readings:
        return ""
    header = "<tr><th>Dimensión</th><th>Inicial</th>"
    if has_final:
        header += "<th>Final</th><th>Delta</th>"
    header += "</tr>"
    body = ""
    for r in readings:
        body += f"<tr><td>{r['name']}</td><td>{r['initial']}</td>"
        if has_final:
            body += f"<td>{r['final']}</td><td>{r['delta']}</td>"
        body += "</tr>"
    return f"<h2>Dimensiones energéticas</h2><table>{header}{body}</table>"


def _section_chakras(readings: list[dict[str, str]], has_final: bool) -> str:
    if not readings:
        return ""
    header = "<tr><th>Chakra</th><th>Posición</th><th>Inicial</th>"
    if has_final:
        header += "<th>Final</th><th>Delta</th>"
    header += "</tr>"
    body = ""
    for r in readings:
        body += f"<tr><td>{r['name']}</td><td>{r['position']}</td><td>{r['initial']}</td>"
        if has_final:
            body += f"<td>{r['final']}</td><td>{r['delta']}</td>"
        body += "</tr>"
    return f"<h2>Chakras (escala 0-14)</h2><table>{header}{body}</table>"


def _section_topics(topics: list[dict[str, str]]) -> str:
    if not topics:
        return ""
    rows = ""
    for t in topics:
        rows += "<tr>"
        rows += f"<td>{t['source']}</td><td>{t['zone']}</td>"
        rows += f"<td>{t['adult_theme']}</td><td>{t['child_theme']}</td>"
        rows += f"<td>{t['adult_age']}</td><td>{t['child_age']}</td>"
        rows += f"<td>{t['emotions']}</td>"
        rows += f"<td>{t['initial']}</td><td>{t['final']}</td>"
        rows += "</tr>"
    header = (
        "<tr><th>Tipo</th><th>Zona</th><th>Tema adulto</th><th>Tema infancia</th>"
        "<th>Edad adulto</th><th>Edad infancia</th><th>Emociones</th>"
        "<th>E. Inicial</th><th>E. Final</th></tr>"
    )
    return f"<h2>Temas trabajados</h2><table>{header}{rows}</table>"


def _section_lnt(entries: list[dict[str, str]], peticiones: str | None) -> str:
    if not entries and not peticiones:
        return ""
    parts = ["<h2>LNT</h2>"]
    if peticiones:
        parts.append(f"<p><strong>Peticiones:</strong> {_esc(peticiones)}</p>")
    if entries:
        header = (
            "<tr><th>Tema / Órgano</th><th>Inicial</th><th>Final</th>"
            "<th>C. Energético</th><th>C. Espiritual</th><th>C. Físico</th></tr>"
        )
        rows = ""
        for e in entries:
            rows += "<tr>"
            rows += f"<td>{e['theme']}</td><td>{e['initial']}</td><td>{e['final']}</td>"
            rows += f"<td>{e['energy_body']}</td><td>{e['spiritual_body']}</td><td>{e['physical_body']}</td>"
            rows += "</tr>"
        parts.append(f"<table>{header}{rows}</table>")
    return "".join(parts)


def _section_cleaning(
    capas: int | None,
    limpiezas_req: int | None,
    mesa: str | None,
    beneficios: str | None,
    events: list[dict[str, str]],
) -> str:
    if not any([capas, limpiezas_req, mesa, beneficios, events]):
        return ""
    parts = ["<h2>Limpiezas</h2>"]
    meta = []
    if capas is not None:
        meta.append(f"<strong>Capas:</strong> {capas}")
    if limpiezas_req is not None:
        meta.append(f"<strong>Limpiezas requeridas:</strong> {limpiezas_req}")
    if mesa:
        mesa_display = mesa.replace("|", ", ")
        meta.append(f"<strong>Mesa utilizada:</strong> {_esc(mesa_display)}")
    if beneficios:
        meta.append(f"<strong>Beneficios:</strong> {_esc(beneficios)}")
    if meta:
        parts.append(f'<p class="meta">{" &nbsp;|&nbsp; ".join(meta)}</p>')
    if events:
        header = (
            "<tr><th>#</th><th>Manifestación</th><th>Trabajo realizado</th>"
            "<th>Materiales</th><th>Origen</th></tr>"
        )
        rows = ""
        for idx, ev in enumerate(events, 1):
            rows += "<tr>"
            rows += f"<td>{idx}</td><td>{ev['manifest']}</td><td>{ev['work_done']}</td>"
            rows += f"<td>{ev['materials']}</td><td>{ev['origin']}</td>"
            rows += "</tr>"
        parts.append(f"<table>{header}{rows}</table>")
    return "".join(parts)


def _section_ancestors(ancestors: list[dict[str, str]], conciliation: dict[str, str] | None) -> str:
    if not ancestors and not conciliation:
        return ""
    parts = ["<h2>Ancestros sistémicos</h2>"]
    if ancestors:
        header = "<tr><th>Miembro</th><th>Linaje</th><th>Energía vincular</th><th>Roles ancestro</th><th>Roles consultante</th></tr>"
        rows = ""
        for a in ancestors:
            rows += "<tr>"
            rows += f"<td>{a['member']}</td><td>{a['lineage']}</td>"
            rows += f"<td>{a['bond']}</td><td>{a['ancestor_roles']}</td><td>{a['consultant_roles']}</td>"
            rows += "</tr>"
        parts.append(f"<table>{header}{rows}</table>")
    if conciliation:
        parts.append("<h2>Conciliación</h2>")
        if conciliation.get("healing"):
            parts.append(f"<p><strong>Frases de sanación:</strong> {conciliation['healing']}</p>")
        if conciliation.get("acts"):
            parts.append(f"<p><strong>Actos de conciliación:</strong> {conciliation['acts']}</p>")
        if conciliation.get("life"):
            parts.append(f"<p><strong>Áreas de vida afectadas:</strong> {conciliation['life']}</p>")
        if conciliation.get("relationship"):
            parts.append(f"<p><strong>Relación de sesión:</strong> {conciliation['relationship']}</p>")
    return "".join(parts)


def _section_theme_entries(entries: list[dict[str, str]]) -> str:
    if not entries:
        return ""
    header = (
        "<tr><th>Tema</th><th>Tipo</th><th>Chakra</th><th>Órgano</th>"
        "<th>E. Ini</th><th>E. Fin</th><th>Significado</th><th>Interpretación</th></tr>"
    )
    rows = ""
    for e in entries:
        rows += "<tr>"
        rows += f"<td>{e['topic']}</td><td>{e['entry_type']}</td>"
        rows += f"<td>{e['chakra']}</td><td>{e['organ']}</td>"
        rows += f"<td>{e['initial']}</td><td>{e['final']}</td>"
        rows += f"<td>{e['significado']}</td><td>{e['interpretacion']}</td>"
        rows += "</tr>"
    return f"<h2>Temas y Bloqueos</h2><table>{header}{rows}</table>"


def _section_affectations(items: list[dict[str, str]]) -> str:
    if not items:
        return ""
    header = (
        "<tr><th>Chakra</th><th>Órgano/Glándula</th><th>Tipo</th>"
        "<th>E. Ini</th><th>E. Fin</th>"
        "<th>Tema adulto (edad)</th><th>Tema infancia (edad)</th></tr>"
    )
    rows = ""
    for a in items:
        rows += "<tr>"
        rows += f"<td>{a['chakra']}</td><td>{a['organ']}</td><td>{a['type']}</td>"
        rows += f"<td>{a['initial']}</td><td>{a['final']}</td>"
        rows += f"<td>{a['adult']}</td><td>{a['child']}</td>"
        rows += "</tr>"
    return f"<h2>Afectaciones</h2><table>{header}{rows}</table>"


def _section_organs(items: list[dict[str, str]]) -> str:
    if not items:
        return ""
    header = (
        "<tr><th>Tipo</th><th>Nombre</th><th>E. Ini</th><th>E. Fin</th>"
        "<th>Tema adulto (edad)</th><th>Tema infancia (edad)</th><th>Emociones</th></tr>"
    )
    rows = ""
    for o in items:
        rows += "<tr>"
        rows += f"<td>{o['source']}</td><td>{o['name']}</td>"
        rows += f"<td>{o['initial']}</td><td>{o['final']}</td>"
        rows += f"<td>{o['adult']}</td><td>{o['child']}</td>"
        rows += f"<td>{o['emotions']}</td>"
        rows += "</tr>"
    return f"<h2>Órganos y Columna vertebral</h2><table>{header}{rows}</table>"


def _section_close(
    cost: Decimal | None,
    payment_notes: str | None,
    porcentaje_pago: Decimal | None,
    incluye_iva: bool,
    costo_calculado: Decimal | None,
) -> str:
    if not any([cost, payment_notes, porcentaje_pago, costo_calculado]):
        return ""
    parts = ["<h2>Cierre</h2>"]
    meta = []
    if cost is not None:
        meta.append(f"<strong>Costo:</strong> ${cost:,.2f}")
    if porcentaje_pago is not None:
        meta.append(f"<strong>% Pago:</strong> {_fmt_decimal(porcentaje_pago)}%")
    if incluye_iva:
        meta.append("<strong>IVA:</strong> Incluido")
    if costo_calculado is not None:
        meta.append(f"<strong>Costo calculado:</strong> ${costo_calculado:,.2f}")
    if payment_notes:
        meta.append(f"<strong>Notas de pago:</strong> {_esc(payment_notes)}")
    if meta:
        parts.append(f'<p class="meta">{" &nbsp;|&nbsp; ".join(meta)}</p>')
    return "".join(parts)


# ── Endpoint ─────────────────────────────────────────────────

@router.get(
    "/{session_id}/pdf",
    summary="Exportar reporte de sesión en PDF",
    responses={200: {"content": {"application/pdf": {}}}},
)
async def export_session_pdf(
    session_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.therapist, UserRole.admin)),
) -> StreamingResponse:
    # Load full session with all sub-modules
    session = (
        await db.execute(
            select(Session)
            .options(
                selectinload(Session.therapy_type),
                selectinload(Session.client),
                selectinload(Session.therapist),
                selectinload(Session.energy_readings).selectinload(SessionEnergyReading.dimension),
                selectinload(Session.chakra_readings).selectinload(SessionChakraReading.chakra),
                selectinload(Session.topics),
                selectinload(Session.lnt_entries),
                selectinload(Session.cleaning_events),
                selectinload(Session.affectations).selectinload(SessionAffectation.chakra),
                selectinload(Session.organs),
                selectinload(Session.theme_entries).selectinload(SessionThemeEntry.client_topic),
                selectinload(Session.ancestors),
                selectinload(Session.ancestor_conciliation),
            )
            .where(Session.id == session_id, Session.deleted_at.is_(None))
        )
    ).scalar_one_or_none()

    if session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Sesión no encontrada")

    # Decrypt client name (PII)
    client_name: str | None = None
    if session.client is not None:
        client_name = await db.scalar(
            select(func.pgp_sym_decrypt(
                Client.full_name.cast(LargeBinary),
                _settings.CLINICAL_DB_PGCRYPTO_KEY,
            )).where(Client.id == session.client_id)
        )

    # Decrypt notes
    notes_decrypted: str | None = None
    if session.notes is not None:
        notes_decrypted = await db.scalar(
            select(func.pgp_sym_decrypt(Session.notes, _settings.CLINICAL_DB_PGCRYPTO_KEY))
            .where(Session.id == session_id)
        )

    # Therapist name (PII — also encrypted)
    therapist_name: str | None = None
    if session.therapist is not None:
        therapist_name = await db.scalar(
            select(func.pgp_sym_decrypt(
                User.full_name.cast(LargeBinary),
                _settings.CLINICAL_DB_PGCRYPTO_KEY,
            )).where(User.id == session.therapist_id)
        )

    therapy_name = session.therapy_type.name if session.therapy_type else None

    # ── Build sections ────────────────────────────────────────
    sections: list[str] = []

    # General
    sections.append(_section_general(
        client_name=client_name,
        therapist_name=therapist_name,
        therapy_name=therapy_name,
        measured_at=session.measured_at,
        session_number=session.session_number,
        general_energy=session.general_energy_level,
    ))

    # Energy dimensions
    energy_has_final = any(r.final_value is not None for r in session.energy_readings)
    energy_data = [
        {
            "name": _esc(r.dimension.name),
            "initial": _fmt_decimal(r.initial_value),
            "final": _fmt_decimal(r.final_value),
            "delta": _delta(r.initial_value, r.final_value),
        }
        for r in session.energy_readings
    ]
    sections.append(_section_energy(energy_data, energy_has_final))

    # Chakras
    chakra_has_final = any(r.final_value is not None for r in session.chakra_readings)
    chakra_data = [
        {
            "name": _esc(r.chakra.name),
            "position": str(r.chakra.position),
            "initial": _fmt_decimal(r.initial_value),
            "final": _fmt_decimal(r.final_value),
            "delta": _delta(r.initial_value, r.final_value),
        }
        for r in sorted(session.chakra_readings, key=lambda r: r.chakra.position)
    ]
    sections.append(_section_chakras(chakra_data, chakra_has_final))

    # Topics
    active_topics = [t for t in session.topics if t.deleted_at is None]
    topics_data = [
        {
            "source": _esc(t.source_type.value),
            "zone": _esc(t.zone),
            "adult_theme": _esc(t.adult_theme),
            "child_theme": _esc(t.child_theme),
            "adult_age": str(t.adult_age) if t.adult_age is not None else "—",
            "child_age": str(t.child_age) if t.child_age is not None else "—",
            "emotions": _esc(t.emotions),
            "initial": _fmt_decimal(t.initial_energy),
            "final": _fmt_decimal(t.final_energy),
        }
        for t in active_topics
    ]
    sections.append(_section_topics(topics_data))

    # Theme entries (Temas y Bloqueos — newer wizard sessions)
    # Build chakra lookup for theme entries (no ORM relationship on the model)
    chakra_lookup: dict[UUID, str] = {}
    all_chakras = (await db.execute(select(ChakraPosition))).scalars().all()
    for cp in all_chakras:
        chakra_lookup[cp.id] = cp.name

    _ENTRY_TYPE_LABELS = {
        "bloqueo_1": "Bloqueo 1",
        "bloqueo_2": "Bloqueo 2",
        "bloqueo_3": "Bloqueo 3",
        "resultante": "Resultante",
        "secundario": "Secundario",
    }
    active_theme_entries = [te for te in session.theme_entries if te.deleted_at is None]
    theme_entries_data = [
        {
            "topic": _esc(te.client_topic.name) if te.client_topic else "—",
            "entry_type": _ENTRY_TYPE_LABELS.get(te.entry_type, te.entry_type),
            "chakra": _esc(chakra_lookup.get(te.chakra_position_id, "")) if te.chakra_position_id else "—",
            "organ": _esc(te.organ_name) if te.organ_name else "—",
            "initial": _fmt_decimal(te.initial_energy),
            "final": _fmt_decimal(te.final_energy),
            "significado": _esc(te.significado) if te.significado else "",
            "interpretacion": _esc(te.interpretacion_tema) if te.interpretacion_tema else "",
        }
        for te in active_theme_entries
    ]
    sections.append(_section_theme_entries(theme_entries_data))

    # Affectations (migrated sessions)
    active_affectations = [a for a in session.affectations if a.deleted_at is None]
    affectations_data = [
        {
            "chakra": _esc(a.chakra.name) if a.chakra else "—",
            "organ": _esc(a.organ_gland) if a.organ_gland else "—",
            "type": _esc(a.affectation_type) if a.affectation_type else "—",
            "initial": _fmt_decimal(a.initial_energy),
            "final": _fmt_decimal(a.final_energy),
            "adult": (
                f"{_esc(a.adult_theme)} ({a.adult_age})" if a.adult_theme and a.adult_age is not None
                else _esc(a.adult_theme) if a.adult_theme
                else str(a.adult_age) if a.adult_age is not None
                else "—"
            ),
            "child": (
                f"{_esc(a.child_theme)} ({a.child_age})" if a.child_theme and a.child_age is not None
                else _esc(a.child_theme) if a.child_theme
                else str(a.child_age) if a.child_age is not None
                else "—"
            ),
        }
        for a in active_affectations
    ]
    sections.append(_section_affectations(affectations_data))

    # Organs (migrated sessions)
    active_organs = [o for o in session.organs if o.deleted_at is None]
    organs_data = [
        {
            "source": _esc(o.source_type.value),
            "name": _esc(o.name) if o.name else "—",
            "initial": _fmt_decimal(o.initial_energy),
            "final": _fmt_decimal(o.final_energy),
            "adult": (
                f"{_esc(o.adult_theme)} ({o.adult_age})" if o.adult_theme and o.adult_age is not None
                else _esc(o.adult_theme) if o.adult_theme
                else str(o.adult_age) if o.adult_age is not None
                else "—"
            ),
            "child": (
                f"{_esc(o.child_theme)} ({o.child_age})" if o.child_theme and o.child_age is not None
                else _esc(o.child_theme) if o.child_theme
                else str(o.child_age) if o.child_age is not None
                else "—"
            ),
            "emotions": _esc(o.emotions) if o.emotions else "—",
        }
        for o in active_organs
    ]
    sections.append(_section_organs(organs_data))

    # LNT
    active_lnt = [l for l in session.lnt_entries if l.deleted_at is None]
    lnt_peticiones = active_lnt[0].peticiones if active_lnt else None
    lnt_data = [
        {
            "theme": _esc(e.theme_organ),
            "initial": _fmt_decimal(e.initial_energy),
            "final": _fmt_decimal(e.final_energy),
            "energy_body": _check(e.healing_energy_body),
            "spiritual_body": _check(e.healing_spiritual_body),
            "physical_body": _check(e.healing_physical_body),
        }
        for e in active_lnt
    ]
    sections.append(_section_lnt(lnt_data, lnt_peticiones))

    # Cleaning
    active_events = [e for e in session.cleaning_events if e.deleted_at is None]
    events_data = [
        {
            "manifest": _esc(ev.manifestation),
            "work_done": _esc((ev.work_done or "").replace("|", ", ")),
            "materials": _esc((ev.materials_used or "").replace("|", ", ")),
            "origin": _esc(ev.origin),
        }
        for ev in active_events
    ]
    sections.append(_section_cleaning(
        session.capas, session.limpiezas_requeridas,
        session.mesa_utilizada, session.beneficios, events_data,
    ))

    # Ancestors
    active_ancestors = [a for a in session.ancestors if a.deleted_at is None]
    ancestors_data = [
        {
            "member": _esc(a.member),
            "lineage": _esc(a.lineage),
            "bond": ", ".join(a.bond_energy) if a.bond_energy else "—",
            "ancestor_roles": ", ".join(a.ancestor_roles) if a.ancestor_roles else "—",
            "consultant_roles": ", ".join(a.consultant_roles) if a.consultant_roles else "—",
        }
        for a in active_ancestors
    ]
    conciliation = session.ancestor_conciliation
    conciliation_data: dict[str, str] | None = None
    if conciliation is not None and conciliation.deleted_at is None:
        conciliation_data = {
            "healing": _esc(conciliation.healing_phrases),
            "acts": _esc(conciliation.conciliation_acts),
            "life": _esc(conciliation.life_aspects_affected),
            "relationship": _esc(conciliation.session_relationship),
        }
    sections.append(_section_ancestors(ancestors_data, conciliation_data))

    # Notes (decrypted)
    if notes_decrypted:
        sections.append(f"<h2>Notas clínicas</h2><p>{_esc(notes_decrypted)}</p>")

    # Close
    sections.append(_section_close(
        session.cost, session.payment_notes,
        session.porcentaje_pago, session.incluye_iva,
        session.costo_calculado,
    ))

    # Footer
    now_str = datetime.now(timezone.utc).strftime("%d/%m/%Y %H:%M UTC")
    footer = (
        f'<div class="footer">'
        f"Generado el {now_str} &mdash; Sanando desde el Coraz&oacute;n &mdash; Confidencial"
        f"</div>"
    )

    # ── Assemble HTML ─────────────────────────────────────────
    body_content = "".join(s for s in sections if s)
    html_str = (
        f"<html><head><style>{_CSS}</style></head><body>"
        f"<h1>Reporte de Sesi&oacute;n &mdash; Sanando desde el Coraz&oacute;n</h1>"
        f"{body_content}{footer}</body></html>"
    )

    # ── Generate PDF ──────────────────────────────────────────
    pdf_bytes = HTML(string=html_str).write_pdf()
    buffer = BytesIO(pdf_bytes)

    # Filename: sesion_{date}_{client_initials}.pdf
    date_part = session.measured_at.strftime("%Y%m%d")
    filename = f"sesion_{date_part}_{session_id.hex[:8]}.pdf"

    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
