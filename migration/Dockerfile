# ============================================================
# migration — Dockerfile  (one-off runner: Notion → PostgreSQL)
# Ejecutar con: docker compose run --rm migration
# Build context: repositorio raíz (docker-compose)
# ============================================================

FROM python:3.12-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
        gcc \
        libpq-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY migration/requirements-migration.txt .
RUN pip install --no-cache-dir -r requirements-migration.txt

COPY migration/ .

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app

CMD ["python", "-m", "runner"]
