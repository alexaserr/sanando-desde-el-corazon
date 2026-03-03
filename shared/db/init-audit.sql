-- Inicialización de audit_db
-- Tabla de audit log: INSERT-only — nunca UPDATE ni DELETE (NOM-004)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Revocar UPDATE y DELETE al usuario de aplicación para garantizar inmutabilidad
-- NOTA: ejecutar después de crear el usuario de aplicación
-- REVOKE UPDATE, DELETE ON ALL TABLES IN SCHEMA public FROM audit_user;
