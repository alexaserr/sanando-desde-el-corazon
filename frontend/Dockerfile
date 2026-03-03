# ============================================================
# frontend — Dockerfile  (multi-stage, Node.js 20 LTS)
# Build context: repositorio raíz (docker-compose)
# IMPORTANTE: next.config.js debe tener output: 'standalone'
# ============================================================

# --- Etapa 1: dependencias ---
FROM node:20-alpine AS deps

RUN apk add --no-cache libc6-compat

WORKDIR /app

COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci --omit=dev

# --- Etapa 2: build ---
FROM node:20-alpine AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY frontend/ .

# Variables NEXT_PUBLIC_* deben estar presentes en build time
ARG NEXT_PUBLIC_CLINICAL_API_URL
ARG NEXT_PUBLIC_PORTAL_API_URL
ARG NEXT_PUBLIC_PODCAST_API_URL
ARG NEXT_PUBLIC_ENVIRONMENT
ARG NEXT_PUBLIC_SITE_URL

ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# --- Etapa 3: runtime ---
FROM node:20-alpine AS runtime

RUN apk add --no-cache wget

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3002 \
    HOSTNAME=0.0.0.0

RUN addgroup --system nodejs && adduser --system --ingroup nodejs nextjs

WORKDIR /app

# standalone output de Next.js incluye server.js con las deps mínimas
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3002

CMD ["node", "server.js"]
