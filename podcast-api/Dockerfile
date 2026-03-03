# ============================================================
# podcast-api — Dockerfile  (multi-stage, Python 3.12)
# Build context: repositorio raíz (docker-compose)
# ============================================================

FROM python:3.12-slim AS builder

WORKDIR /build

RUN apt-get update && apt-get install -y --no-install-recommends \
        gcc \
        libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

# --- runtime ---
FROM python:3.12-slim AS runtime

# ffprobe para validación de archivos de audio/video (opcional)
RUN apt-get update && apt-get install -y --no-install-recommends \
        libpq5 \
        wget \
        ffmpeg \
    && rm -rf /var/lib/apt/lists/*

RUN addgroup --system app && adduser --system --ingroup app --no-create-home app

WORKDIR /app

COPY --from=builder /root/.local /home/app/.local
COPY --chown=app:app podcast-api/ .

USER app

ENV PATH=/home/app/.local/bin:$PATH \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app

EXPOSE 8003

# Un solo worker para podcast: uploads grandes son I/O-bound, asyncio lo maneja bien
CMD ["uvicorn", "app.main:app", \
     "--host", "0.0.0.0", \
     "--port", "8003", \
     "--workers", "2", \
     "--loop", "uvloop", \
     "--http", "httptools"]
