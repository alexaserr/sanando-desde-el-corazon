# ============================================================
# clinical-api — Dockerfile  (multi-stage, Python 3.12)
# Build context: repositorio raíz (docker-compose)
# ============================================================

# --- Etapa 1: builder ---
FROM python:3.12-slim AS builder

WORKDIR /build

# Dependencias del sistema para compilar psycopg y cryptography
RUN apt-get update && apt-get install -y --no-install-recommends \
        gcc \
        libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Instalar dependencias Python en directorio local del usuario
COPY requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

# --- Etapa 2: runtime ---
FROM python:3.12-slim AS runtime

# Librerías de runtime necesarias para psycopg
RUN apt-get update && apt-get install -y --no-install-recommends \
        libpq5 \
        libcairo2 \
        libpango-1.0-0 \
        libpangocairo-1.0-0 \
        libgdk-pixbuf-2.0-0 \
        libglib2.0-0 \
        libgobject-2.0-0 \
        libffi-dev \
        fonts-liberation \
        wget \
    && rm -rf /var/lib/apt/lists/*

# Usuario no-root
RUN addgroup --system app && adduser --system --ingroup app --no-create-home app

WORKDIR /app

# Copiar paquetes instalados desde builder
COPY --from=builder /root/.local /home/app/.local

# Copiar código del servicio
COPY --chown=app:app clinical-api/ .

USER app

ENV PATH="/home/app/.local/bin:${PATH}" \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH="/home/app/.local/lib/python3.12/site-packages:/app"

EXPOSE 8001

CMD ["uvicorn", "app.main:app", \
     "--host", "0.0.0.0", \
     "--port", "8001", \
     "--workers", "4", \
     "--loop", "uvloop", \
     "--http", "httptools"]
