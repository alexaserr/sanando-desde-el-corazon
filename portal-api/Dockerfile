# ============================================================
# portal-api — Dockerfile  (multi-stage, Python 3.12)
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

RUN apt-get update && apt-get install -y --no-install-recommends \
        libpq5 \
        wget \
    && rm -rf /var/lib/apt/lists/*

RUN addgroup --system app && adduser --system --ingroup app --no-create-home app

WORKDIR /app

COPY --from=builder /root/.local /home/app/.local
COPY --chown=app:app portal-api/ .

USER app

ENV PATH=/home/app/.local/bin:$PATH \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app

EXPOSE 8002

CMD ["uvicorn", "app.main:app", \
     "--host", "0.0.0.0", \
     "--port", "8002", \
     "--workers", "4", \
     "--loop", "uvloop", \
     "--http", "httptools"]
