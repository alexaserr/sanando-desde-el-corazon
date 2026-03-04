"""
Fase 3-D: Descarga adjuntos de clientes desde Notion → MinIO.

Las 14 imágenes PNG están adjuntas a páginas de clientes en Notion.
Se suben al bucket sdc-clients con la ruta:
    clients/{client_notion_page_id}/attachments/{filename}

Prerrequisito: migrate_clients.py completado (clients en BD con notion_page_id).

Uso:
  python download_attachments.py [--dry-run]
"""
import argparse
import asyncio
import io
import logging
from pathlib import Path
from typing import Any

import httpx
import psycopg
import structlog
from minio import Minio
from minio.error import S3Error
from notion_client import AsyncClient as NotionClient
from psycopg.rows import dict_row

from config import settings

structlog.configure(
    wrapper_class=structlog.make_filtering_bound_logger(
        getattr(logging, settings.LOG_LEVEL, logging.INFO)
    ),
)
log = structlog.get_logger(__name__)

# Extensiones permitidas (imágenes de mesa de luz)
ALLOWED_EXTENSIONS: set[str] = {".png", ".jpg", ".jpeg", ".webp", ".gif"}


def get_minio_client() -> Minio:
    return Minio(
        settings.MINIO_ENDPOINT,
        access_key=settings.MINIO_ACCESS_KEY,
        secret_key=settings.MINIO_SECRET_KEY,
        secure=settings.MINIO_SECURE,
    )


async def ensure_bucket(minio: Minio, bucket: str) -> None:
    """Crea el bucket si no existe."""
    if not minio.bucket_exists(bucket):
        minio.make_bucket(bucket)
        log.info("bucket_creado", bucket=bucket)


async def fetch_client_attachments(
    notion: NotionClient,
    notion_page_id: str,
) -> list[dict[str, Any]]:
    """
    Obtiene los bloques de tipo 'image' de una página de Notion.
    Retorna lista de dicts con 'url' y 'filename'.
    """
    attachments: list[dict[str, Any]] = []
    try:
        blocks = await notion.blocks.children.list(block_id=notion_page_id)
    except Exception as exc:
        log.warning("error_fetching_blocks", notion_page_id=notion_page_id, error=str(exc))
        return attachments

    for block in blocks.get("results", []):
        block_type = block.get("type")
        if block_type == "image":
            img_data = block.get("image", {})
            img_type = img_data.get("type")  # "external" | "file"
            if img_type == "file":
                url = img_data.get("file", {}).get("url", "")
            elif img_type == "external":
                url = img_data.get("external", {}).get("url", "")
            else:
                continue
            if url:
                filename = url.split("/")[-1].split("?")[0]
                ext = Path(filename).suffix.lower()
                if ext not in ALLOWED_EXTENSIONS:
                    filename = f"{block['id']}.png"
                attachments.append({"url": url, "filename": filename, "block_id": block["id"]})

    return attachments


async def download_and_upload(
    http: httpx.AsyncClient,
    minio: Minio,
    bucket: str,
    object_key: str,
    url: str,
) -> bool:
    """Descarga URL y sube directamente a MinIO sin tocar disco."""
    try:
        response = await http.get(url, timeout=30.0, follow_redirects=True)
        response.raise_for_status()
    except Exception as exc:
        log.error("error_descargando", url=url[:80], error=str(exc))
        return False

    content = response.content
    content_type = response.headers.get("content-type", "image/png").split(";")[0]
    try:
        minio.put_object(
            bucket,
            object_key,
            io.BytesIO(content),
            length=len(content),
            content_type=content_type,
        )
        return True
    except S3Error as exc:
        log.error("error_subiendo_minio", object_key=object_key, error=str(exc))
        return False


async def process_clients(dry_run: bool) -> None:
    db_url = settings.CLINICAL_DATABASE_URL
    bucket = settings.MINIO_BUCKET_CLIENTS
    notion = NotionClient(auth=settings.NOTION_API_TOKEN)
    minio = get_minio_client()

    if not dry_run:
        await ensure_bucket(minio, bucket)

    async with await psycopg.AsyncConnection.connect(db_url) as conn:
        async with conn.cursor(row_factory=dict_row) as cur:
            await cur.execute(
                "SELECT id, notion_page_id FROM clients WHERE notion_page_id IS NOT NULL"
            )
            clients = await cur.fetchall()

    log.info("procesando_clientes", total=len(clients))
    total_uploaded = 0
    total_errors = 0

    async with httpx.AsyncClient() as http:
        for client in clients:
            client_id = str(client["id"])
            notion_page_id = client["notion_page_id"]

            attachments = await fetch_client_attachments(notion, notion_page_id)
            if not attachments:
                continue

            log.info(
                "adjuntos_encontrados",
                notion_page_id=notion_page_id,
                count=len(attachments),
            )

            for att in attachments:
                object_key = f"clients/{notion_page_id}/attachments/{att['filename']}"
                if dry_run:
                    log.info("[dry-run] subiria", object_key=object_key)
                    total_uploaded += 1
                    continue

                success = await download_and_upload(
                    http, minio, bucket, object_key, att["url"]
                )
                if success:
                    log.info("adjunto_subido", object_key=object_key)
                    total_uploaded += 1
                else:
                    total_errors += 1

    await notion.aclose()
    log.info(
        "descarga_completada",
        total_uploaded=total_uploaded,
        total_errors=total_errors,
        dry_run=dry_run,
    )


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Descarga adjuntos de clientes → MinIO")
    p.add_argument("--dry-run", action="store_true", help="No descarga ni sube archivos")
    return p.parse_args()


if __name__ == "__main__":
    args = parse_args()
    asyncio.run(process_clients(args.dry_run))
