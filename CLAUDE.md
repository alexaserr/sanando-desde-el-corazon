# Proyecto: Sanando desde el Corazón

## Stack
- Backend: Python 3.12+ / FastAPI 0.110+ / SQLAlchemy 2.0 async / Alembic / psycopg3
- Frontend: Next.js 14 / TypeScript 5+ / Tailwind CSS / shadcn/ui
- BD: PostgreSQL 15 (5 instancias independientes)
- Infra: Docker Compose / Nginx / Redis / MinIO

## Reglas obligatorias
- JWT RS256 siempre — nunca HS256
- Refresh token en cookie HttpOnly+Secure+SameSite=Strict
- PII cifrado con pgcrypto: full_name, email, phone en clinical_db
- Audit log INSERT-only — nunca UPDATE ni DELETE en audit_log
- Soft delete en tablas clínicas: deleted_at, nunca DELETE físico
- TypeScript: cero uso de `any`
- Secrets solo en variables de entorno, nunca en código ni en Git
- Alembic para TODOS los cambios de esquema — cero SQL manual
- FastAPI async en todos los endpoints: async def siempre
- Swagger UI deshabilitado en producción (/docs → 404)

## Cumplimiento normativo
- NOM-004-SSA3-2012: expedientes clínicos, retención mínima 5 años
- LFPDPPP: aviso de privacidad, derechos ARCO, consentimiento informado

## Estructura del proyecto
- clinical-api/ → Plataforma clínica (puerto 8001)
- portal-api/   → Portal de cursos (puerto 8002)
- podcast-api/  → Podcast (puerto 8003)
- frontend/     → Next.js (puerto 3002)
- nginx/        → Reverse proxy
- migration/    → Scripts de migración de Notion

## Convenciones de código
- Nombres de variables y funciones: snake_case (Python), camelCase (TypeScript)
- Nombres de archivos: snake_case (Python), kebab-case (TypeScript/Next.js)
- Comentarios en español para lógica de negocio, inglés para comentarios técnicos
- UUIDs como primary keys en todas las tablas (gen_random_uuid())
- Siempre incluir created_at, updated_at, deleted_at en tablas principales

## Lo que NO hacer
- No sugerir Kubernetes ni servicios de pago mensual
- No cambiar decisiones de arquitectura sin debatirlo primero
- No usar DELETE físico en tablas clínicas
- No hardcodear secrets ni API keys
