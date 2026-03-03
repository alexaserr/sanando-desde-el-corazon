-- Inicialización de clinical_db
-- Habilita pgcrypto para cifrado de PII (NOM-004 / LFPDPPP)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
