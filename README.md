# Sanando desde el Corazón — Ecosistema Digital Integral

> Plataforma clínica y portal educativo para un centro de sanación energética en México.
> Cumple con **NOM-004-SSA3-2012** y **LFPDPPP**.

---

## Índice

1. [Descripción general](#descripción-general)
2. [Estado del proyecto](#estado-del-proyecto)
3. [Arquitectura](#arquitectura)
4. [Stack tecnológico](#stack-tecnológico)
5. [Componentes del ecosistema](#componentes-del-ecosistema)
6. [Instalación y desarrollo](#instalación-y-desarrollo)
7. [Variables de entorno](#variables-de-entorno)
8. [Base de datos](#base-de-datos)
9. [Seguridad](#seguridad)
10. [Design System v3.0](#design-system-v30)
11. [API](#api)
12. [Workflows del wizard de sesión](#workflows-del-wizard-de-sesión)
13. [Deployment](#deployment)
14. [Contribución](#contribución)

---

## Descripción general

**Sanando desde el Corazón (SDC)** es un ecosistema digital compuesto por cinco módulos:

| # | Módulo | Estado |
|---|--------|--------|
| 1 | 🏥 Plataforma Clínica | ✅ Fase 1 completa |
| 2 | 🌐 Portal de Cursos y Membresías | 🔜 Fase 2 |
| 3 | 🎙️ Podcast — Charlando desde el Corazón | 📋 Planeado |
| 4 | 👥 Comunidad (Discourse) | 📋 Planeado |
| 5 | 📅 Agenda del Centro (Cal.com) | 📋 Planeado |

La plataforma se hospeda completamente en infraestructura propia (**on-premise**), con costo fijo mensual post-deploy de **$0 MXN**.

---

## Estado del proyecto

### Fase 1 — Plataforma Clínica ✅ COMPLETA

- 367+ pacientes migrados desde Notion
- 785+ sesiones con datos históricos completos
- Wizard de sesión para 9 tipos de terapia (config-driven)
- Vista de detalle de sesión con 9 secciones colapsables
- Export PDF (WeasyPrint)
- Dashboard con KPIs
- Formulario público de registro `/registro`
- 2FA TOTP (backend + UI, falta flujo e2e)
- Seguridad: JWT RS256, cifrado pgcrypto, token reuse detection, rate limiting Redis

### Pendiente pre-producción

```
❌ CSP nonces (eliminar unsafe-inline/unsafe-eval)
❌ 2FA flujo end-to-end completo
❌ Docker hardening
❌ Security alert emails
❌ Trivy scanning
❌ Account lockout
❌ Proceso ARCO
❌ CI/CD pipeline
❌ Tests 70%+ cobertura
```

---

## Arquitectura

### Modelo: Híbrido On-Premise + Self-Hosted + CDN selectivo

```
Internet → Cloudflare (DNS + CDN + DDoS) → Nginx (reverse proxy)
                                                   │
                              ┌────────────────────┼────────────────────┐
                              │                    │                    │
                    clinical-api :8001     portal-api :8002      ...más servicios
                              │
                    clinical-postgres (DB principal)
                    auth-postgres      (sesiones auth)
                    audit-postgres     (audit log INSERT-only)
                    Redis              (tokens, caché, rate limiting)
```

**Servidor dedicado (Beelink SER7):**
- CPU: Ryzen 9 7940HS | RAM: 64 GB DDR5
- SSD sistema: 1 TB NVMe | SSD datos: 2 TB NVMe
- UPS: APC Smart-UPS 1500VA con shutdown automático
- VLAN 20 dedicada para toda la infraestructura SDC
- Docker Compose como orquestador (6 servicios activos)

**NAS Synology DS423+:**
- MinIO (almacenamiento S3-compatible)
- PeerTube (video self-hosted)
- Uptime Kuma (monitoreo)
- Backups locales (estrategia 3-2-1)
- El backend de Docker lee archivos directamente del NAS

**Red y acceso:**
- SSH **únicamente** vía Tailscale VPN — puerto 22 nunca expuesto
- TLS 1.3 mínimo + Let's Encrypt + HSTS
- UFW: solo puertos 80 y 443 abiertos
- Cloudflare Free: DNS + DDNS + CDN

---

## Stack tecnológico

### Backend

```
Python 3.12+
FastAPI 0.110+
SQLAlchemy 2.0+ (async)
Alembic 1.13+
psycopg3 (async)
bcrypt cost 12 (sin passlib)
python-jose RS256 (JWT)
pyotp (2FA TOTP)
slowapi + Redis backend (rate limiting)
redis.asyncio
boto3 (MinIO/S3)
WeasyPrint 60.2 + pydyf 0.9.0 (PDF export)
pydantic-settings 2.0+
structlog
```

> ⚠️ **Versiones críticas de WeasyPrint:** usar exactamente `60.2` y `pydyf 0.9.0`.
> Las versiones 62.3 y 61.2 tienen bugs conocidos.

### Frontend

```
Next.js 14 (App Router)
TypeScript 5+ (strict, sin 'any')
Tailwind CSS 3.4+
shadcn/ui
React Hook Form 7+
Zod 3+
Zustand 4+ (sin persist middleware)
Lucide React 0.263+ (strokeWidth 1.5)
Lato + Playfair Display via next/font/google
```

### Infraestructura

```
Docker Compose
PostgreSQL 15 (5 bases independientes)
Redis / Valkey
MinIO (S3-compatible)
Nginx
Cloudflare Free
Tailscale VPN
```

---

## Componentes del ecosistema

### 3.1 Plataforma Clínica (`clinical_db`, puerto 8001)

Expedientes clínicos digitales para sanadores y administradores.

**Rutas del frontend:**
```
/login                                → Auth con returnUrl
/clinica                              → Dashboard (KPIs + recientes)
/clinica/pacientes                    → Lista con búsqueda pgcrypto
/clinica/pacientes/[id]               → Ficha + historial + temas + consent alert
/clinica/pacientes/nuevo              → Crear paciente
/clinica/sesiones                     → Lista de sesiones
/clinica/sesiones/[id]                → Detalle (9 secciones + PDF)
/clinica/sesiones/nueva               → Wizard de sesión
/clinica/seguridad                    → 2FA setup (admin only)
/registro                             → Formulario público sin login
```

**Terapias disponibles:**

| Terapia | Precio | Paso 4 wizard |
|---------|--------|---------------|
| Sanación Energética | $1,300 | Topics |
| Sanación a Distancia | $1,300 | Topics |
| Medicina Cuántica | $1,600 | Topics + peticiones LNT |
| Terapia LNT | $1,300 | StepLNT (escala 0–14) |
| Limpieza Energética | $1,300 | StepCleaning |
| Extracción de Energías Densas | $2,200 | (skip) |
| Armonización y Mandala | $2,300 | (skip) |
| Recuperación del Alma | $1,700 | Topics |
| Despacho | $2,500 | (skip) |

### 3.2 Portal de Cursos y Membresías (`portal_db`, puerto 8002) — Fase 2

- Backend: Directus CMS headless (reemplaza portal-api custom)
- Pagos: Stripe
- Video: PeerTube self-hosted
- Certificados automáticos

### 3.3–3.5 Podcast, Comunidad, Agenda — Planeados

---

## Instalación y desarrollo

### Prerrequisitos

- Docker + Docker Compose
- Node 20 LTS (`nvm`)
- Python 3.12+ (`Poetry`)
- `pnpm`

### 1. Clonar el repositorio

```bash
git clone git@github.com:alexaserr/sanando-desde-el-corazon.git
cd sanando-desde-el-corazon
git checkout develop
```

### 2. Backend (en el NAS / servidor)

```bash
cd backend
cp .env.example .env
# Editar .env con tus valores

docker compose up -d
```

Aplicar migraciones:
```bash
docker compose exec clinical-api alembic upgrade head
```

> ⚠️ **Regla crítica:** El frontend corre localmente; el backend corre en el NAS vía Docker.
> Docker lee los archivos del NAS directamente. **Siempre** hacer `git pull` en el NAS
> después de cada push desde local. No hacerlo causa estado divergido y pushes rechazados.

### 3. Frontend (en disco local)

```bash
# El frontend NO puede correr desde el NAS (CIFS no soporta npm install)
cd ~/sdc-frontend-dev
cp .env.local.example .env.local
# Editar .env.local

pnpm install
pnpm dev
# → http://localhost:3002
```

### 4. Git workflow diario

```bash
# Antes de trabajar (desde local)
git pull --rebase origin develop

# Después de push desde local, en el NAS (OBLIGATORIO):
git pull origin develop
docker compose restart clinical-api
```

---

## Variables de entorno

### Backend (`.env`)

```env
# Base de datos clínica
CLINICAL_DATABASE_URL=postgresql+psycopg://user:pass@localhost:5432/clinical_db
AUTH_DATABASE_URL=postgresql+psycopg://user:pass@localhost:5433/auth_db
AUDIT_DATABASE_URL=postgresql+psycopg://user:pass@localhost:5434/audit_db

# Cifrado
PGCRYPTO_KEY=<clave AES-256, mínimo 32 chars>

# JWT RS256
JWT_PRIVATE_KEY_PATH=/secrets/jwt_private.pem
JWT_PUBLIC_KEY_PATH=/secrets/jwt_public.pem

# Redis
REDIS_URL=redis://localhost:6379/0

# MinIO
MINIO_ENDPOINT=http://nas-local:9000
MINIO_ACCESS_KEY=...
MINIO_SECRET_KEY=...
MINIO_BUCKET=sdc-documents

# Entorno
ENVIRONMENT=development  # development | production
```

> TTL del `.env`: 7 días (rotar regularmente).
> Script de rotación: `scripts/rotate_pgcrypto_key.py`

### Frontend (`.env.local`)

```env
NEXT_PUBLIC_API_URL=http://localhost:8001/api/v1
```

---

## Base de datos

### Migraciones Alembic (0001 → 0011)

```bash
# Crear nueva migración
docker compose exec clinical-api alembic revision --autogenerate -m "descripcion"

# Aplicar
docker compose exec clinical-api alembic upgrade head

# Rollback
docker compose exec clinical-api alembic downgrade -1
```

### Tablas principales

```
users                         → Autenticación y roles (admin, sanador)
clients                       → Pacientes (PII cifrado, has_consent, archived_at)
sessions                      → Sesiones clínicas
session_energy_readings       → Lecturas de energía inicial/final (escala 0–14)
session_chakra_readings       → Lecturas de chakras inicial/final (escala 0–14)
session_theme_entries         → Temas trabajados
session_lnt                   → Peticiones LNT
session_cleaning_events       → Eventos de limpieza energética
session_ancestors             → Trabajo con ancestros
session_ancestor_conciliation
session_affectations          → Afectaciones del paciente
session_topics                → Temas por sesión
session_organs                → Órganos tratados
client_topics                 → Temas persistentes del paciente (progress 0–100%)
client_conditions             → Padecimientos
client_medications            → Medicamentos
audit_log                     → INSERT-only, PII scrubbed automáticamente
therapy_types                 → 10 tipos activos con precios
chakra_positions              → 7 chakras + bud
energy_dimensions             → 13 dimensiones energéticas
chakra_organs                 → 118 registros seeded
```

### Conteos actuales

```
clients:                  367+
sessions:                 785+
session_energy_readings:  3,690+
session_chakra_readings:  5,337+
session_cleaning_events:  2,231+
session_affectations:     2,930
session_lnt:              376
session_organs:           432
session_topics:           265+
client_conditions:        1,165
client_medications:       517
```

### Notas de datos históricos

- **Escala de chakras y órganos:** 0–14 nativo. El porcentaje se muestra simultáneamente: `val / 14 * 100`.
- **Quirk de migración Notion:** Valores de chakra ingresados post-nov 2025 sin decimales (ej. "500" = 5.000) → requieren ÷1000, no ÷100.
- **client_topics** son entidades persistentes del paciente, no efímeras por sesión.

---

## Seguridad

### Implementado ✅

```
JWT RS256 — access 15min, refresh 7 días (cookie HttpOnly+Secure+SameSite=Strict)
Refresh tokens opacos (secrets.token_urlsafe(64)), hash SHA-256 en Redis
Token reuse detection — invalida TODAS las sesiones si refresh ya fue usado
refreshPromise compartido en apiClient (previene race conditions)
Next.js middleware protege /clinica/*
Tokens NUNCA en localStorage/sessionStorage — Zustand sin persist middleware
Rate limiting: slowapi + Redis DB 2 (5 intentos/15min/IP → 429)
RBAC: admin, sanador. Sanador solo ve sus propias sesiones.
PII cifrado: full_name, email, phone → pgcrypto AES-256
sessions.notes cifrado con pgcrypto
Audit log: INSERT-only, PII scrubbed con scrub_pii() centralizado
Soft delete en todas las tablas clínicas
Cabeceras HTTP: HSTS, CSP, X-Frame-Options, X-Content-Type-Options
Swagger UI deshabilitado en producción (ENVIRONMENT=production)
Script de rotación PGCRYPTO_KEY (scripts/rotate_pgcrypto_key.py)
structlog verificado: no loguea request bodies clínicos
has_consent flag + endpoint stub de consentimiento (NOM-004)
archived_at en clients (NOM-004 Art. 24 — retención mínima 5 años)
```

### Pendiente ❌

```
P0 — Inmediato:
  CSP nonces (eliminar unsafe-inline/unsafe-eval)
  Account lockout tras N intentos fallidos
  git-secrets pre-commit hooks
  Dependabot habilitado

P1 — Esta semana:
  2FA TOTP flujo end-to-end (backend ✅, UI ✅, integración pendiente)
  Docker hardening
  Security alert emails

P2 — Pre-producción:
  Trivy scanning
  Proceso ARCO (LFPDPPP)
  Anonymization script
  Cache-Control + Permissions-Policy headers
```

---

## Design System v3.0

Aprobado por Savia Studio — **100% aplicado**.

### Paleta

| Token | Hex | Uso |
|-------|-----|-----|
| Marfil | `#FAF7F5` | Fondo principal (**reemplaza #FFFFFF**) |
| Lino | `#F2E8E4` | Cards, inputs, secciones alternadas |
| Arcilla | `#D4A592` | Bordes inferiores de inputs, separadores |
| Terracota | `#C4704A` | CTAs, botones, acentos (con moderación) |
| Chocolate | `#4A3628` | Labels, footer |
| Charcoal | `#2C2220` | Texto principal, headings |
| Sage | `#B7BFB3` | Badges, estados secundarios |

> 🚫 **PROHIBIDO:** `#000000` como foreground de página, `#FFFFFF` como fondo de página.

### Tipografía

| Uso | Fuente | Notas |
|-----|--------|-------|
| Display / H1–H2 | Playfair Display 600 | via next/font/google |
| Body / UI / H3+ | Lato | via next/font/google |
| Labels | Lato ALL CAPS | letter-spacing 0.1em, color `#4A3628` |
| Código / Admin | JetBrains Mono | — |

### Reglas de componentes

```css
/* Inputs */
bg: #FAF7F5; border: none; border-bottom: 1px solid #D4A592;
border-radius: 0; focus: border-bottom 2px solid #C4704A;

/* Botones — NUNCA pill, max border-radius 6px */
/* Primary:   bg #C4704A, text white, uppercase, tracking-wide, 13px */
/* Secondary: outlined #C4704A */
/* Ghost:     text #2C2220 */

/* Cards */
border: none; box-shadow: 0 2px 8px rgba(44,34,32,0.06); border-radius: 8px;

/* Icons: Lucide strokeWidth 1.5 */
/* Line-height body: 1.7 */
```

### Colores de chakras (inmutables)

```
root: #C0392B   sacral: #E67E22   plexo: #F1C40F   heart: #27AE60
throat: #2980B9   third_eye: #6C3483   crown: #8E44AD   bud: #DAA520
```

---

## API

**Base URL:** `http://localhost:8001/api/v1`

### Auth

```
POST   /auth/login
POST   /auth/refresh          ← token reuse detection activo
POST   /auth/logout
POST   /auth/logout-all
GET    /auth/me
POST   /auth/2fa/setup
POST   /auth/2fa/verify
```

### Clientes

```
GET    /clinical/clients
POST   /clinical/clients
GET    /clinical/clients/{id}
PATCH  /clinical/clients/{id}
DELETE /clinical/clients/{id}
GET    /clinical/clients/{id}/sessions
GET    /clinical/clients/{id}/topics
POST   /clinical/clients/{id}/topics
DELETE /clinical/clients/{id}/topics/{tid}
POST   /clinical/clients/{id}/documents     ← consent stub
```

### Sesiones

```
GET    /clinical/sessions
GET    /clinical/sessions/{id}
POST   /clinical/sessions
PATCH  /clinical/sessions/{id}/general
PUT    /sessions/{id}/energy/initial
PUT    /sessions/{id}/energy/final
PUT    /sessions/{id}/chakras/initial
PUT    /sessions/{id}/chakras/final
PUT    /sessions/{id}/theme-entries
PUT    /sessions/{id}/lnt
PUT    /sessions/{id}/cleanings
PUT    /sessions/{id}/ancestors
PUT    /sessions/{id}/organs
POST   /sessions/{id}/close
GET    /sessions/{id}/pdf
```

### Catálogos

```
GET    /catalogs/therapy-types
GET    /catalogs/chakras
GET    /catalogs/energy-dimensions
GET    /catalogs/chakra-organs
POST   /catalogs/energy-dimensions   ← admin only
```

### Formas de respuesta (inconsistencia documentada)

```
Catálogos:           array plano       → [...]
Sesión (detalle):    objeto directo    → {...}
Listado clientes:    wrapper items     → { items: [...] }
```

Verificar la forma de respuesta en cada punto de integración antes de asumir.

---

## Workflows del wizard de sesión

El wizard es **config-driven** (`wizard-config.ts`). Los pasos se determinan dinámicamente por tipo de terapia.

### Pasos universales

| # | Step | Aplica |
|---|------|--------|
| 1 | StepGeneral | Todos |
| 2 | StepEnergyInitial | Todos |
| 3 | StepChakrasInitial | Todos |
| 5 | StepEnergyFinal | Todos excepto Limpieza |
| 6 | StepChakrasFinal | Todos excepto Limpieza |
| 7 | StepClose | Todos |

### Paso 4 según terapia

| Terapia | Paso 4 |
|---------|--------|
| SE / Distancia / RecAlma | StepTopics |
| Medicina Cuántica | StepTopics + peticiones LNT |
| Terapia LNT | StepLNT |
| Limpieza Energética | StepCleaning |
| Extracción / Armonización / Despacho | (skip) |
| Ancestros | Modal desde paso 2, no es paso del stepper |

### Reglas de negocio críticas

```
Si se detectan entidades/capas/implantes:
  → Auto-inject StepCleaning
  → REMOVE StepTopics, StepLNT, StepEnergyFinal, StepChakrasFinal

Flujo de limpieza:
  General → Energy Init → Chakras Init → Cleaning → Close (SIN finales)

Costo = aditivo:
  precio_terapia + (n_limpiezas × $1,300) × % pago × IVA (opcional)

Temas secundarios → persisten como client_topic (progress 0–100%, "Completado")
Trabajo realizado → multi-select chips, pipe-delimited en BD
```

---

## Deployment

### Pre-deploy checklist

```
☐ Pendientes de seguridad P0 y P1 completados
☐ Tests con cobertura ≥ 70%
☐ Variables de entorno de producción revisadas
☐ PGCRYPTO_KEY rotada y respaldada fuera del servidor
☐ Claves RS256 generadas para producción (no reusar las de dev)
☐ Swagger UI confirmado deshabilitado (ENVIRONMENT=production)
☐ Brevo transactional email templates configurados
☐ Cloudflare tunnel configurado y activo
☐ Let's Encrypt + HSTS activos
☐ Uptime Kuma con alertas configuradas
☐ Backup 3-2-1 verificado (local NAS + offsite + cloud)
☐ Logo SVG exportado antes de que caiga Squarespace
```

### Flujo de deploy

```bash
# Desde local
git push origin develop

# En el NAS (OBLIGATORIO, inmediatamente después)
git pull origin develop
docker compose pull
docker compose up -d --build
docker compose exec clinical-api alembic upgrade head
```

---

## Contribución

Proyecto privado de desarrollo a medida. Reglas para colaboradores:

1. **Nunca commitear** `.env`, claves privadas, ni PII de pacientes
2. Usar `git-secrets` pre-commit hook (instalación pendiente)
3. Respetar el **Design System v3.0** — sin colores, fuentes o componentes no aprobados
4. Migraciones **solo con Alembic** — nunca DDL manual en producción
5. PII siempre cifrado con pgcrypto — nunca en texto plano en logs ni respuestas
6. Audit log es **INSERT-only** — nunca UPDATE ni DELETE sobre `audit_log`
7. Branch activo: `develop`. Merge a `main` solo en releases etiquetados.
8. TypeScript strict: prohibido usar `any`

---

## Cumplimiento normativo

| Normativa | Aplica a | Estado |
|-----------|----------|--------|
| **NOM-004-SSA3-2012** | Expedientes clínicos electrónicos | ✅ Implementado |
| **LFPDPPP** | Datos personales de pacientes | ✅ Base implementada — proceso ARCO pendiente |

Artículos clave:
- NOM-004 Art. 24: `archived_at` en `clients` (retención mínima 5 años)
- LFPDPPP: cifrado AES-256 para PII, `has_consent` flag, endpoint de consentimiento

---

*Sanando desde el Corazón — Desarrollado por Alexa*
*FastAPI + Next.js 14 + PostgreSQL 15 + Docker — $0 MXN/mes*
