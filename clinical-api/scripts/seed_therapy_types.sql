-- Tipos de terapia faltantes en la BD clínica
-- Ejecutar: docker compose exec clinical-postgres psql -U clinical_user -d clinical_db -f /dev/stdin < clinical-api/scripts/seed_therapy_types.sql

INSERT INTO therapy_types (id, name, description) VALUES
  (gen_random_uuid(), 'Medicina Cuántica',                  'Terapia de campos de información cuántica del cuerpo'),
  (gen_random_uuid(), 'Extracción de Energías Densas',      'Limpieza profunda de cargas energéticas negativas'),
  (gen_random_uuid(), 'Armonización Energética y Mandala',  'Reconexión interior con mandala de cuarzos'),
  (gen_random_uuid(), 'Recuperación del Alma',              'Recuperación de fragmentos del alma tras trauma'),
  (gen_random_uuid(), 'Despacho',                           'Ceremonia andina de agradecimiento y manifestación')
ON CONFLICT (name) DO NOTHING;
