"""
Servicio de email transaccional — SMTP con TLS (Google Workspace).

Usa smtplib estándar vía asyncio.to_thread para no bloquear el event loop.
"""
import asyncio
import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

import structlog

from app.config import settings

logger = structlog.get_logger(__name__)


def _build_registration_html(full_name: str) -> str:
    """HTML del email de confirmación de registro — Design System v3.0."""
    return f"""\
<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background-color:#FAF7F5;font-family:'Lato',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#FAF7F5;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(44,34,32,0.06);">
          <!-- Header -->
          <tr>
            <td style="background-color:#C4704A;padding:28px 40px;text-align:center;">
              <h1 style="margin:0;font-family:'Playfair Display',Georgia,serif;font-size:22px;font-weight:600;color:#ffffff;letter-spacing:0.5px;">
                Sanando desde el Coraz&oacute;n
              </h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:36px 40px 24px;">
              <p style="margin:0 0 20px;font-size:16px;color:#2C2220;line-height:1.6;">
                Hola <strong>{full_name}</strong>,
              </p>
              <p style="margin:0 0 20px;font-size:15px;color:#4A3628;line-height:1.6;">
                Gracias por llenar el formulario de registro.
                Nos vemos pronto en la pr&oacute;xima cita.
              </p>
              <p style="margin:0 0 8px;font-size:15px;color:#4A3628;line-height:1.6;">
                Con cari&ntilde;o,
              </p>
              <p style="margin:0;font-family:'Playfair Display',Georgia,serif;font-size:16px;color:#C4704A;font-weight:600;">
                Sanando desde el Coraz&oacute;n
              </p>
            </td>
          </tr>
          <!-- Divider -->
          <tr>
            <td style="padding:0 40px;">
              <hr style="border:none;border-top:1px solid #F2E8E4;margin:0;" />
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:16px 40px 24px;text-align:center;">
              <p style="margin:0;font-size:11px;color:#A9967E;line-height:1.5;">
                Este es un mensaje autom&aacute;tico, por favor no respondas a este correo.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""


def _send_smtp(to_email: str, subject: str, html_body: str) -> None:
    """Envía email vía SMTP con STARTTLS (bloqueante — llamar desde thread)."""
    if not settings.SMTP_USER or not settings.SMTP_PASSWORD:
        logger.warning("email.smtp_not_configured", to=to_email)
        return

    msg = MIMEMultipart("alternative")
    msg["From"] = f"{settings.SMTP_FROM_NAME} <{settings.SMTP_USER}>"
    msg["To"] = to_email
    msg["Subject"] = subject
    msg.attach(MIMEText(html_body, "html", "utf-8"))

    with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=15) as server:
        if settings.SMTP_TLS:
            server.starttls()
        server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
        server.send_message(msg)

    logger.info("email.sent", to=to_email, subject=subject)


async def send_registration_email(to_email: str, full_name: str) -> None:
    """Envía email de confirmación de registro (async, no bloquea)."""
    subject = "¡Gracias por tu registro! - Sanando desde el Corazón"
    html = _build_registration_html(full_name)
    await asyncio.to_thread(_send_smtp, to_email, subject, html)
