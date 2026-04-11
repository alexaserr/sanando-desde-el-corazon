"""
Router de exportación PDF para reportes de sesión clínica.

Genera un PDF con weasyprint a partir de los datos completos de una sesión,
incluyendo dimensiones energéticas, chakras, temas y bloqueos, LNT,
limpiezas (agrupadas), ancestros, protecciones y desglose de costos.
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
    SessionCleaningGroup,
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
    return f"{v:g}" if float(v) == int(v) else f"{v:.1f}"


def _fmt_age(v) -> str | None:
    if v is None:
        return None
    try:
        d = Decimal(str(v))
    except Exception:
        return str(v)
    iv = int(d)
    return str(iv) if Decimal(iv) == d else f"{d:.1f}"


def _delta(initial: Decimal | None, final: Decimal | None) -> str:
    if initial is None or final is None:
        return "—"
    d = final - initial
    sign = "+" if d > 0 else ""
    return f"{sign}{_fmt_decimal(d)}"


def _delta_html(initial: Decimal | None, final: Decimal | None) -> str:
    if initial is None or final is None:
        return '<span class="delta-zero">—</span>'
    d = final - initial
    if d > 0:
        return f'<span class="delta-pos">+{_fmt_decimal(d)}</span>'
    if d < 0:
        return f'<span class="delta-neg">{_fmt_decimal(d)}</span>'
    return '<span class="delta-zero">0</span>'


def _check(val: bool | None) -> str:
    return "&#10003;" if val else ""


def _esc(val: str | None) -> str:
    if val is None:
        return ""
    return (
        val.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


# ── CSS ──────────────────────────────────────────────────────

_CSS = """\
@import url('https://fonts.googleapis.com/css2?family=Lato:wght@300;400;700&family=Playfair+Display:wght@600;700&display=swap');
@page { size: A4; margin: 22mm 18mm 24mm 18mm; background: #FAF7F5;
        @bottom-center { content: "Sanando desde el Corazón — Confidencial — Página " counter(page) " de " counter(pages);
                         font-family: 'Lato', sans-serif; font-size: 9px; color: #4A3628; } }
html, body { background: #FAF7F5; }
body { font-family: 'Lato', sans-serif; color: #2C2220; font-size: 11px; line-height: 1.45; margin: 0; }
h1 { font-family: 'Playfair Display', serif; color: #2C2220; font-size: 26px; margin: 0 0 4px 0; font-weight: 700; }
h1 .sub { display: block; font-family: 'Lato', sans-serif; font-size: 10px; color: #4A3628; text-transform: uppercase; letter-spacing: 0.18em; font-weight: 400; margin-top: 4px; }
h2 { font-family: 'Playfair Display', serif; color: #C4704A; font-size: 17px; margin: 22px 0 10px 0; padding-bottom: 6px; border-bottom: 1px solid #D4A592; font-weight: 600; }
h3 { font-family: 'Playfair Display', serif; color: #4A3628; font-size: 13px; margin: 14px 0 6px 0; font-weight: 600; }
.label { color: #4A3628; text-transform: uppercase; letter-spacing: 0.1em; font-size: 9px; font-weight: 700; }
table { width: 100%; border-collapse: collapse; margin: 8px 0 12px 0; border: 1px solid #D4A592; }
th { background: #F2E8E4; color: #4A3628; text-transform: uppercase; font-size: 9px; letter-spacing: 0.08em;
     padding: 7px 8px; text-align: left; border-bottom: 1px solid #D4A592; font-weight: 700; }
td { padding: 6px 8px; border-bottom: 1px solid #F2E8E4; vertical-align: top; }
tr:last-child td { border-bottom: none; }
table.num td.n, table.num th.n { text-align: right; font-variant-numeric: tabular-nums; }
.meta-table { border: none; }
.meta-table td { border: none; padding: 3px 8px 3px 0; }
.meta-table td.k { color: #4A3628; text-transform: uppercase; font-size: 9px; letter-spacing: 0.1em; font-weight: 700; width: 28%; }
.delta-pos { color: #27AE60; font-weight: 700; }
.delta-neg { color: #C0392B; font-weight: 700; }
.delta-zero { color: #6B7280; }
.chakra-row td:first-child { font-weight: 700; }
.topic-card { border: 1px solid #D4A592; border-radius: 6px; padding: 12px 14px; margin: 12px 0; background: #FFFEFC; page-break-inside: avoid; }
.topic-card h3 { margin-top: 0; color: #C4704A; }
.topic-meta { margin: 6px 0 8px 0; font-size: 10px; color: #4A3628; }
.topic-meta .pill { display: inline-block; background: #F2E8E4; border: 1px solid #D4A592; border-radius: 10px; padding: 2px 8px; margin-right: 6px; }
.topic-interp { font-style: italic; color: #4A3628; margin: 6px 0; padding: 6px 10px; border-left: 3px solid #C4704A; background: #FAF7F5; }
.group-card { border: 1px solid #D4A592; border-radius: 6px; margin: 12px 0; background: #FFFEFC; overflow: hidden; page-break-inside: avoid; }
.group-header { background: #F2E8E4; padding: 8px 12px; font-size: 11px; font-weight: 700; color: #2C2220; border-bottom: 1px solid #D4A592; }
.group-body { padding: 10px 12px; }
.chip { display: inline-block; background: #F2E8E4; border: 1px solid #D4A592; border-radius: 10px; padding: 2px 8px; font-size: 9px; margin: 2px 2px 2px 0; color: #4A3628; }
.toggle-row { margin: 8px 0; font-size: 10px; color: #4A3628; }
.toggle-row span { margin-right: 18px; }
.dot { display: inline-block; width: 7px; height: 7px; border-radius: 50%; margin-right: 4px; vertical-align: middle; }
.dot-on { background: #27AE60; }
.dot-off { background: #D4A592; }
.cost-table { width: 60%; margin-left: auto; border: 1px solid #D4A592; }
.cost-table td { padding: 6px 10px; }
.cost-table td.k { color: #4A3628; text-transform: uppercase; font-size: 10px; letter-spacing: 0.06em; }
.cost-table td.v { text-align: right; font-variant-numeric: tabular-nums; font-weight: 600; }
.cost-table tr.sub td { border-top: 1px solid #D4A592; }
.cost-table tr.total td { border-top: 2px solid #C4704A; font-size: 14px; color: #C4704A; font-weight: 700; padding-top: 10px; }
.notes-block { background: #FAF7F5; border-left: 3px solid #C4704A; padding: 8px 12px; margin: 8px 0; font-size: 11px; }
.empty { color: #9CA3AF; font-style: italic; font-size: 10px; }
"""


# ── Sections ─────────────────────────────────────────────────

def _section_general(
    client_name: str | None,
    therapist_name: str | None,
    therapy_name: str | None,
    measured_at: datetime,
    session_number: int | None,
    general_energy: int | None,
    entities_count: int | None = None,
    bajo_astral: bool = False,
    implants_count: int | None = None,
) -> str:
    rows = []
    if client_name:
        rows.append(f'<tr><td class="k">Paciente</td><td>{_esc(client_name)}</td></tr>')
    if therapist_name:
        rows.append(f'<tr><td class="k">Terapeuta</td><td>{_esc(therapist_name)}</td></tr>')
    if therapy_name:
        rows.append(f'<tr><td class="k">Terapia</td><td>{_esc(therapy_name)}</td></tr>')
    rows.append(f'<tr><td class="k">Fecha</td><td>{_fmt_date(measured_at)}</td></tr>')
    if session_number is not None:
        rows.append(f'<tr><td class="k">Sesión #</td><td>{session_number}</td></tr>')
    if general_energy is not None:
        rows.append(f'<tr><td class="k">Energía general</td><td><strong>{general_energy}%</strong></td></tr>')
    table = f'<table class="meta-table">{"".join(rows)}</table>'

    has_entities = entities_count is not None and entities_count > 0
    has_implants = implants_count is not None and implants_count > 0
    toggles = ""
    if entities_count is not None or bajo_astral or implants_count is not None:
        toggles = '<div class="toggle-row">'
        toggles += (
            f'<span><span class="dot {"dot-on" if has_entities else "dot-off"}"></span>'
            f'Entidades: {f"Sí ({entities_count})" if has_entities else "No"}</span>'
        )
        toggles += (
            f'<span><span class="dot {"dot-on" if bajo_astral else "dot-off"}"></span>'
            f'Trabajos de bajo astral: {"Sí" if bajo_astral else "No"}</span>'
        )
        toggles += (
            f'<span><span class="dot {"dot-on" if has_implants else "dot-off"}"></span>'
            f'Implantes: {f"Sí ({implants_count})" if has_implants else "No"}</span>'
        )
        toggles += "</div>"

    return f"<h2>Datos generales</h2>{table}{toggles}"


def _section_energy(readings: list[dict[str, str]], has_final: bool) -> str:
    if not readings:
        return ""
    header = '<tr><th>Dimensión</th><th class="n">Inicial</th>'
    if has_final:
        header += '<th class="n">Final</th><th class="n">Δ</th>'
    header += "</tr>"
    body = ""
    for r in readings:
        body += f'<tr><td>{r["name"]}</td><td class="n">{r["initial"]}</td>'
        if has_final:
            body += f'<td class="n">{r["final"]}</td><td class="n">{r["delta"]}</td>'
        body += "</tr>"
    return f'<h2>Dimensiones energéticas</h2><table class="num">{header}{body}</table>'


def _section_chakras(readings: list[dict[str, str]], has_final: bool) -> str:
    if not readings:
        return ""
    header = '<tr><th>Chakra</th><th class="n">Posición</th><th class="n">Inicial</th>'
    if has_final:
        header += '<th class="n">Final</th><th class="n">Δ</th>'
    header += "</tr>"
    body = ""
    for r in readings:
        body += f'<tr class="chakra-row"><td>{r["name"]}</td><td class="n">{r["position"]}</td><td class="n">{r["initial"]}</td>'
        if has_final:
            body += f'<td class="n">{r["final"]}</td><td class="n">{r["delta"]}</td>'
        body += "</tr>"
    return f'<h2>Chakras (escala 0-14)</h2><table class="num">{header}{body}</table>'


_ENTRY_TYPE_LABELS = {
    "bloqueo_1": "Bloqueo 1",
    "bloqueo_2": "Bloqueo 2",
    "bloqueo_3": "Bloqueo 3",
    "resultante": "Resultante",
    "secundario": "Secundario",
}
_ENTRY_TYPE_ORDER = {"bloqueo_1": 0, "bloqueo_2": 1, "bloqueo_3": 2, "resultante": 3, "secundario": 4}


def _section_theme_entries_grouped(topics: list[dict]) -> str:
    """Render temas con interpretación + edades como campos, y tabla de bloqueos por tema."""
    if not topics:
        return ""
    parts = ["<h2>Temas y Bloqueos</h2>"]
    for topic in topics:
        parts.append('<div class="topic-card">')
        parts.append(f'<h3>{_esc(topic["name"])}</h3>')

        meta_pills = []
        if topic.get("childhood_age") is not None:
            meta_pills.append(f'<span class="pill">Edad infancia: <strong>{topic["childhood_age"]}</strong></span>')
        if topic.get("adulthood_age") is not None:
            meta_pills.append(f'<span class="pill">Edad adulta: <strong>{topic["adulthood_age"]}</strong></span>')
        if meta_pills:
            parts.append(f'<div class="topic-meta">{"".join(meta_pills)}</div>')

        if topic.get("interpretacion"):
            parts.append(f'<div class="topic-interp">{_esc(topic["interpretacion"])}</div>')

        rows = topic.get("rows", [])
        if rows:
            header = (
                '<tr><th>Tipo</th><th>Chakra</th><th>Órgano</th>'
                '<th>Significado</th><th class="n">E. Ini</th><th class="n">E. Fin</th>'
                '<th class="n">Δ</th></tr>'
            )
            body = ""
            for r in rows:
                sig = _esc(r["significado"]) if r["significado"] else '<span class="empty">—</span>'
                body += "<tr>"
                body += f'<td><strong>{r["entry_type"]}</strong></td>'
                body += f'<td>{_esc(r["chakra"])}</td><td>{_esc(r["organ"])}</td>'
                body += f'<td>{sig}</td>'
                body += f'<td class="n">{r["initial"]}</td><td class="n">{r["final"]}</td>'
                body += f'<td class="n">{r["delta"]}</td>'
                body += "</tr>"
            parts.append(f'<table class="num">{header}{body}</table>')
        parts.append("</div>")
    return "".join(parts)


def _section_lnt(entries: list[dict[str, str]], peticiones: str | None) -> str:
    if not entries and not peticiones:
        return ""
    parts = ["<h2>LNT — Medicina Cuántica</h2>"]
    if peticiones:
        parts.append(
            f'<div class="notes-block"><span class="label">Peticiones</span><br/>{_esc(peticiones)}</div>'
        )
    if entries:
        header = (
            '<tr><th>Tema / Órgano</th><th class="n">Inicial</th><th class="n">Final</th>'
            '<th>C. Energético</th><th>C. Espiritual</th><th>C. Físico</th></tr>'
        )
        rows = ""
        for e in entries:
            rows += "<tr>"
            rows += f'<td>{e["theme"]}</td><td class="n">{e["initial"]}</td><td class="n">{e["final"]}</td>'
            rows += f'<td>{e["energy_body"]}</td><td>{e["spiritual_body"]}</td><td>{e["physical_body"]}</td>'
            rows += "</tr>"
        parts.append(f'<table class="num">{header}{rows}</table>')
    return "".join(parts)


def _section_cleaning_groups(groups: list[dict]) -> str:
    """Render limpiezas agrupadas por destinatario (paciente, familiar, casa, otro)."""
    if not groups:
        return ""
    parts = ["<h2>Limpieza energética</h2>"]
    for idx, g in enumerate(groups, 1):
        parts.append('<div class="group-card">')
        target_label = _esc(g.get("target_label") or "Destinatario")
        header_extras = []
        if g.get("cleanings_required"):
            n = g["cleanings_required"]
            header_extras.append(f'{n} limpieza{"s" if n != 1 else ""}')
        if g.get("is_charged") is False:
            header_extras.append("No cobrada")
        elif g.get("subtotal") is not None:
            header_extras.append(f'${g["subtotal"]:,.2f}')
        extras = f' &mdash; {" • ".join(header_extras)}' if header_extras else ""
        parts.append(f'<div class="group-header">Grupo {idx}: {target_label}{extras}</div>')
        parts.append('<div class="group-body">')

        if g.get("mesa_utilizada"):
            mesa = (g["mesa_utilizada"] or "").replace("|", ", ")
            parts.append(f'<p><span class="label">Mesa utilizada:</span> {_esc(mesa)}</p>')
        if g.get("beneficios"):
            parts.append(f'<p><span class="label">Beneficios:</span> {_esc(g["beneficios"])}</p>')
        if g.get("layers_summary"):
            parts.append(f'<p><span class="label">Capas:</span> {_esc(g["layers_summary"])}</p>')

        events = g.get("events", [])
        if events:
            header = (
                '<tr><th>Manifestación</th><th class="n">Valor</th><th>Unidad</th>'
                '<th>Trabajo</th><th>Materiales</th><th>Origen</th></tr>'
            )
            body = ""
            for ev in events:
                body += "<tr>"
                body += f'<td>{_esc(ev.get("manifestation") or "—")}</td>'
                body += f'<td class="n">{ev.get("value") or "—"}</td>'
                body += f'<td>{_esc(ev.get("unit") or "—")}</td>'
                body += f'<td>{_esc(ev.get("work_done") or "—")}</td>'
                body += f'<td>{_esc(ev.get("materials") or "—")}</td>'
                body += f'<td>{_esc(ev.get("origin") or "—")}</td>'
                body += "</tr>"
            parts.append(f'<table class="num">{header}{body}</table>')
        parts.append("</div></div>")
    return "".join(parts)


def _section_ancestors(ancestors: list[dict[str, str]], conciliation: dict[str, str] | None) -> str:
    if not ancestors and not conciliation:
        return ""
    parts = ["<h2>Ancestros sistémicos</h2>"]
    for a in ancestors:
        parts.append('<div class="topic-card">')
        title = a.get("member") or "—"
        lineage = a.get("lineage") or ""
        parts.append(f'<h3>{_esc(title)}{f" — {_esc(lineage)}" if lineage else ""}</h3>')

        rows = []
        if a.get("bond"):
            rows.append(f'<tr><td class="k">Energía vincular</td><td>{_esc(a["bond"])}</td></tr>')
        if a.get("ancestor_roles"):
            rows.append(f'<tr><td class="k">Roles ancestro</td><td>{_esc(a["ancestor_roles"])}</td></tr>')
        if a.get("consultant_roles"):
            rows.append(f'<tr><td class="k">Roles consultante</td><td>{_esc(a["consultant_roles"])}</td></tr>')
        if a.get("expressions"):
            rows.append(f'<tr><td class="k">Expresiones de la energía</td><td>{_esc(a["expressions"])}</td></tr>')
        if a.get("traumas"):
            rows.append(f'<tr><td class="k">Traumas familiares</td><td>{_esc(a["traumas"])}</td></tr>')
        if rows:
            parts.append(f'<table class="meta-table">{"".join(rows)}</table>')
        parts.append("</div>")

    if conciliation:
        parts.append("<h3>Conciliación</h3>")
        rows = []
        if conciliation.get("healing"):
            rows.append(f'<tr><td class="k">Frases de sanación</td><td>{conciliation["healing"]}</td></tr>')
        if conciliation.get("acts"):
            rows.append(f'<tr><td class="k">Actos de conciliación</td><td>{conciliation["acts"]}</td></tr>')
        if conciliation.get("life"):
            rows.append(f'<tr><td class="k">Áreas de vida afectadas</td><td>{conciliation["life"]}</td></tr>')
        if conciliation.get("relationship"):
            rows.append(f'<tr><td class="k">Relación de sesión</td><td>{conciliation["relationship"]}</td></tr>')
        if rows:
            parts.append(f'<table class="meta-table">{"".join(rows)}</table>')
    return "".join(parts)


def _section_protections(items: list[dict]) -> str:
    if not items:
        return ""
    header = (
        '<tr><th>Persona</th><th class="n">Cantidad</th>'
        '<th class="n">Costo unitario</th><th class="n">Subtotal</th></tr>'
    )
    body = ""
    total = Decimal("0")
    for it in items:
        body += "<tr>"
        body += f'<td>{_esc(it["recipient"])}</td>'
        body += f'<td class="n">{it["quantity"]}</td>'
        body += f'<td class="n">${it["cost_per_unit"]:,.2f}</td>'
        body += f'<td class="n"><strong>${it["subtotal"]:,.2f}</strong></td>'
        body += "</tr>"
        total += it["subtotal"]
    body += (
        f'<tr><td colspan="3" class="n"><strong>Total protecciones</strong></td>'
        f'<td class="n"><strong>${total:,.2f}</strong></td></tr>'
    )
    return f'<h2>Protecciones energéticas</h2><table class="num">{header}{body}</table>'


def _section_close(breakdown: dict, payment_notes: str | None) -> str:
    """Cierre con desglose: base + limpiezas + protecciones × % × IVA = total."""
    if not breakdown.get("has_data") and not payment_notes:
        return ""
    parts = ["<h2>Cierre &mdash; Desglose de costos</h2>"]

    rows: list[str] = []
    if breakdown.get("base") is not None:
        rows.append(
            f'<tr><td class="k">Terapia base</td><td class="v">${breakdown["base"]:,.2f}</td></tr>'
        )
    for line in breakdown.get("cleaning_lines", []):
        rows.append(
            f'<tr><td class="k">Limpieza · {_esc(line["label"])}</td>'
            f'<td class="v">${line["amount"]:,.2f}</td></tr>'
        )
    if breakdown.get("cleaning_total") is not None and breakdown.get("cleaning_lines"):
        rows.append(
            f'<tr class="sub"><td class="k">Subtotal limpiezas</td>'
            f'<td class="v">${breakdown["cleaning_total"]:,.2f}</td></tr>'
        )
    for line in breakdown.get("protection_lines", []):
        rows.append(
            f'<tr><td class="k">Protección · {_esc(line["label"])}</td>'
            f'<td class="v">${line["amount"]:,.2f}</td></tr>'
        )
    if breakdown.get("protection_total") is not None and breakdown.get("protection_lines"):
        rows.append(
            f'<tr class="sub"><td class="k">Subtotal protecciones</td>'
            f'<td class="v">${breakdown["protection_total"]:,.2f}</td></tr>'
        )
    if breakdown.get("subtotal") is not None:
        rows.append(
            f'<tr class="sub"><td class="k">Subtotal</td>'
            f'<td class="v">${breakdown["subtotal"]:,.2f}</td></tr>'
        )
    if breakdown.get("porcentaje_pago") is not None:
        rows.append(
            f'<tr><td class="k">× Porcentaje pago</td>'
            f'<td class="v">{_fmt_decimal(breakdown["porcentaje_pago"])}%</td></tr>'
        )
    if breakdown.get("after_pct") is not None and breakdown.get("porcentaje_pago") is not None:
        rows.append(
            f'<tr class="sub"><td class="k">Subtotal con %</td>'
            f'<td class="v">${breakdown["after_pct"]:,.2f}</td></tr>'
        )
    if breakdown.get("incluye_iva"):
        rows.append(
            f'<tr><td class="k">+ IVA (16%)</td>'
            f'<td class="v">${breakdown["iva_amount"]:,.2f}</td></tr>'
        )
    if breakdown.get("total") is not None:
        rows.append(
            f'<tr class="total"><td class="k">TOTAL</td>'
            f'<td class="v">${breakdown["total"]:,.2f}</td></tr>'
        )

    if rows:
        parts.append(f'<table class="cost-table">{"".join(rows)}</table>')

    if payment_notes:
        parts.append(
            f'<div class="notes-block"><span class="label">Notas de pago</span><br/>{_esc(payment_notes)}</div>'
        )
    return "".join(parts)


# ── Builders ─────────────────────────────────────────────────

_TARGET_TYPE_LABELS = {
    "patient": "Paciente",
    "family": "Familiar",
    "house": "Casa",
    "other": "Otro",
}


def _target_label(target_type: str | None, target_name: str | None) -> str:
    base = _TARGET_TYPE_LABELS.get(target_type or "", target_type or "Destinatario")
    if target_name:
        return f"{base} — {target_name}"
    return base


def _build_cost_breakdown(session: Session) -> dict:
    base = session.cost
    cleaning_lines: list[dict] = []
    cleaning_total = Decimal("0")
    for g in (session.cleaning_groups or []):
        if g.deleted_at is not None:
            continue
        if g.is_charged is False:
            continue
        qty = g.cleanings_required or 0
        cpc = g.cost_per_cleaning or Decimal("0")
        if qty <= 0 or cpc <= 0:
            continue
        amount = Decimal(qty) * cpc
        cleaning_lines.append({
            "label": _target_label(g.target_type, g.target_name),
            "amount": amount,
        })
        cleaning_total += amount

    protection_lines: list[dict] = []
    protection_total = Decimal("0")
    if session.protection_charged:
        for p in (session.protections or []):
            qty = p.quantity or 0
            cpu = p.cost_per_unit or Decimal("0")
            if qty <= 0 or cpu <= 0:
                continue
            amount = Decimal(qty) * cpu
            protection_lines.append({
                "label": _target_label(p.recipient_type, p.recipient_name),
                "amount": amount,
            })
            protection_total += amount

    subtotal: Decimal | None = None
    parts_sum = Decimal("0")
    has_any = False
    if base is not None:
        parts_sum += base
        has_any = True
    if cleaning_total > 0:
        parts_sum += cleaning_total
        has_any = True
    if protection_total > 0:
        parts_sum += protection_total
        has_any = True
    if has_any:
        subtotal = parts_sum

    porcentaje_pago = session.porcentaje_pago
    after_pct: Decimal | None = None
    if subtotal is not None and porcentaje_pago is not None:
        after_pct = (subtotal * porcentaje_pago / Decimal("100")).quantize(Decimal("0.01"))

    iva_amount: Decimal | None = None
    total: Decimal | None = None
    base_for_total = after_pct if after_pct is not None else subtotal
    if base_for_total is not None:
        if session.incluye_iva:
            iva_amount = (base_for_total * Decimal("0.16")).quantize(Decimal("0.01"))
            total = (base_for_total + iva_amount).quantize(Decimal("0.01"))
        else:
            total = base_for_total

    if session.costo_calculado is not None and total is None:
        total = session.costo_calculado

    return {
        "has_data": has_any or session.costo_calculado is not None,
        "base": base,
        "cleaning_lines": cleaning_lines,
        "cleaning_total": cleaning_total if cleaning_lines else None,
        "protection_lines": protection_lines,
        "protection_total": protection_total if protection_lines else None,
        "subtotal": subtotal,
        "porcentaje_pago": porcentaje_pago,
        "after_pct": after_pct,
        "incluye_iva": session.incluye_iva,
        "iva_amount": iva_amount,
        "total": total,
    }


def _build_topics_grouped(
    theme_entries: list[SessionThemeEntry],
    chakra_lookup: dict[UUID, str],
) -> list[dict]:
    """Group SessionThemeEntry by client_topic_id; collapse age fields per topic."""
    by_topic: dict[UUID, dict] = {}
    for te in theme_entries:
        if te.deleted_at is not None:
            continue
        tid = te.client_topic_id
        topic = by_topic.get(tid)
        if topic is None:
            topic = {
                "name": te.client_topic.name if te.client_topic else "—",
                "interpretacion": None,
                "childhood_age": None,
                "adulthood_age": None,
                "rows": [],
            }
            by_topic[tid] = topic

        if topic["interpretacion"] is None and te.interpretacion_tema:
            topic["interpretacion"] = te.interpretacion_tema
        if topic["childhood_age"] is None and te.childhood_age is not None:
            topic["childhood_age"] = _fmt_age(te.childhood_age)
        if topic["adulthood_age"] is None and te.adulthood_age is not None:
            topic["adulthood_age"] = _fmt_age(te.adulthood_age)

        topic["rows"].append({
            "entry_type": _ENTRY_TYPE_LABELS.get(te.entry_type, te.entry_type),
            "_order": _ENTRY_TYPE_ORDER.get(te.entry_type, 99),
            "chakra": chakra_lookup.get(te.chakra_position_id, "") if te.chakra_position_id else "—",
            "organ": te.organ_name or "—",
            "significado": te.significado or "",
            "initial": _fmt_decimal(te.initial_energy),
            "final": _fmt_decimal(te.final_energy),
            "delta": _delta_html(te.initial_energy, te.final_energy),
        })

    out = []
    for topic in by_topic.values():
        topic["rows"].sort(key=lambda r: r["_order"])
        for r in topic["rows"]:
            r.pop("_order", None)
        out.append(topic)
    return out


def _build_cleaning_groups_data(session: Session) -> list[dict]:
    out: list[dict] = []
    groups = sorted(
        [g for g in (session.cleaning_groups or []) if g.deleted_at is None],
        key=lambda g: g.created_at,
    )
    for g in groups:
        events_data = []
        for ev in g.cleaning_events or []:
            if ev.deleted_at is not None:
                continue
            events_data.append({
                "manifestation": ev.manifestation,
                "value": _fmt_decimal(ev.manifestation_value) if ev.manifestation_value is not None else "",
                "unit": ev.manifestation_unit,
                "work_done": (ev.work_done or "").replace("|", ", "),
                "materials": (ev.materials_used or "").replace("|", ", "),
                "origin": ev.origin,
            })

        layers_summary = ""
        if g.layers and isinstance(g.layers, list):
            layers_summary = ", ".join(
                str(l.get("name") or l.get("layer") or "") for l in g.layers if l
            )

        subtotal: Decimal | None = None
        if g.is_charged is not False and g.cleanings_required and g.cost_per_cleaning:
            subtotal = Decimal(g.cleanings_required) * g.cost_per_cleaning

        out.append({
            "target_label": _target_label(g.target_type, g.target_name),
            "cleanings_required": g.cleanings_required,
            "is_charged": g.is_charged,
            "subtotal": subtotal,
            "mesa_utilizada": g.mesa_utilizada,
            "beneficios": g.beneficios,
            "layers_summary": layers_summary,
            "events": events_data,
        })
    return out


def _build_protections_data(session: Session) -> list[dict]:
    out: list[dict] = []
    for p in (session.protections or []):
        qty = p.quantity or 0
        cpu = p.cost_per_unit or Decimal("0")
        out.append({
            "recipient": _target_label(p.recipient_type, p.recipient_name),
            "quantity": qty,
            "cost_per_unit": cpu,
            "subtotal": Decimal(qty) * cpu,
        })
    return out


def _flatten_jsonb(v) -> str:
    if not v:
        return ""
    if isinstance(v, list):
        out = []
        for item in v:
            if isinstance(item, dict):
                text = item.get("expression") or item.get("trauma") or ""
                num = item.get("number")
                out.append(f"{num}. {text}" if num else text)
            else:
                out.append(str(item))
        return " · ".join(s for s in out if s)
    return str(v)


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
    session = (
        await db.execute(
            select(Session)
            .options(
                selectinload(Session.therapy_type),
                selectinload(Session.client),
                selectinload(Session.therapist),
                selectinload(Session.energy_readings).selectinload(SessionEnergyReading.dimension),
                selectinload(Session.chakra_readings).selectinload(SessionChakraReading.chakra),
                selectinload(Session.lnt_entries),
                selectinload(Session.cleaning_events),
                selectinload(Session.cleaning_groups).selectinload(SessionCleaningGroup.cleaning_events),
                selectinload(Session.protections),
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

    # Decrypt PII
    client_name: str | None = None
    if session.client is not None:
        client_name = await db.scalar(
            select(func.pgp_sym_decrypt(
                Client.full_name.cast(LargeBinary),
                _settings.CLINICAL_DB_PGCRYPTO_KEY,
            )).where(Client.id == session.client_id)
        )

    notes_decrypted: str | None = None
    if session.notes is not None:
        notes_decrypted = await db.scalar(
            select(func.pgp_sym_decrypt(Session.notes, _settings.CLINICAL_DB_PGCRYPTO_KEY))
            .where(Session.id == session_id)
        )

    therapist_name: str | None = None
    if session.therapist is not None:
        therapist_name = await db.scalar(
            select(func.pgp_sym_decrypt(
                User.full_name.cast(LargeBinary),
                _settings.CLINICAL_DB_PGCRYPTO_KEY,
            )).where(User.id == session.therapist_id)
        )

    therapy_name = session.therapy_type.name if session.therapy_type else None

    sections: list[str] = []

    bajo_astral = bool(session.capas and session.capas > 0)
    sections.append(_section_general(
        client_name=client_name,
        therapist_name=therapist_name,
        therapy_name=therapy_name,
        measured_at=session.measured_at,
        session_number=session.session_number,
        general_energy=session.general_energy_level,
        entities_count=session.entities_count,
        bajo_astral=bajo_astral,
        implants_count=session.implants_count,
    ))

    energy_has_final = any(r.final_value is not None for r in session.energy_readings)
    energy_data = [
        {
            "name": _esc(r.dimension.name),
            "initial": _fmt_decimal(r.initial_value),
            "final": _fmt_decimal(r.final_value),
            "delta": _delta_html(r.initial_value, r.final_value),
        }
        for r in session.energy_readings
    ]
    sections.append(_section_energy(energy_data, energy_has_final))

    chakra_has_final = any(r.final_value is not None for r in session.chakra_readings)
    chakra_data = [
        {
            "name": _esc(r.chakra.name),
            "position": str(r.chakra.position),
            "initial": _fmt_decimal(r.initial_value),
            "final": _fmt_decimal(r.final_value),
            "delta": _delta_html(r.initial_value, r.final_value),
        }
        for r in sorted(session.chakra_readings, key=lambda r: r.chakra.position)
    ]
    sections.append(_section_chakras(chakra_data, chakra_has_final))

    chakra_lookup: dict[UUID, str] = {}
    all_chakras = (await db.execute(select(ChakraPosition))).scalars().all()
    for cp in all_chakras:
        chakra_lookup[cp.id] = cp.name

    grouped_topics = _build_topics_grouped(session.theme_entries, chakra_lookup)
    sections.append(_section_theme_entries_grouped(grouped_topics))

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

    cleaning_groups_data = _build_cleaning_groups_data(session)
    if not cleaning_groups_data:
        legacy_events = [e for e in session.cleaning_events if e.deleted_at is None]
        if legacy_events:
            cleaning_groups_data = [{
                "target_label": "Sesión",
                "cleanings_required": session.limpiezas_requeridas,
                "is_charged": None,
                "subtotal": None,
                "mesa_utilizada": session.mesa_utilizada,
                "beneficios": session.beneficios,
                "layers_summary": "",
                "events": [
                    {
                        "manifestation": ev.manifestation,
                        "value": _fmt_decimal(ev.manifestation_value) if ev.manifestation_value is not None else "",
                        "unit": ev.manifestation_unit,
                        "work_done": (ev.work_done or "").replace("|", ", "),
                        "materials": (ev.materials_used or "").replace("|", ", "),
                        "origin": ev.origin,
                    }
                    for ev in legacy_events
                ],
            }]
    sections.append(_section_cleaning_groups(cleaning_groups_data))

    active_ancestors = [a for a in session.ancestors if a.deleted_at is None]
    ancestors_data = [
        {
            "member": a.member,
            "lineage": a.lineage,
            "bond": ", ".join(a.bond_energy) if a.bond_energy else "",
            "ancestor_roles": ", ".join(a.ancestor_roles) if a.ancestor_roles else "",
            "consultant_roles": ", ".join(a.consultant_roles) if a.consultant_roles else "",
            "expressions": _flatten_jsonb(a.energy_expressions),
            "traumas": _flatten_jsonb(a.family_traumas),
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

    protections_data = _build_protections_data(session)
    sections.append(_section_protections(protections_data))

    if notes_decrypted:
        sections.append(
            f'<h2>Notas clínicas</h2><div class="notes-block">{_esc(notes_decrypted)}</div>'
        )

    breakdown = _build_cost_breakdown(session)
    sections.append(_section_close(breakdown, session.payment_notes))

    body_content = "".join(s for s in sections if s)
    html_str = (
        f"<html><head><meta charset='utf-8'/><style>{_CSS}</style></head><body>"
        f"<h1>Reporte de Sesi&oacute;n"
        f"<span class='sub'>Sanando desde el Coraz&oacute;n</span></h1>"
        f"{body_content}</body></html>"
    )

    pdf_bytes = HTML(string=html_str).write_pdf()
    buffer = BytesIO(pdf_bytes)

    date_part = session.measured_at.strftime("%Y%m%d")
    filename = f"sesion_{date_part}_{session_id.hex[:8]}.pdf"

    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
