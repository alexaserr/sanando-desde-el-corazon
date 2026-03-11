# Especificación: Rediseño Paso 4 — Temas del Wizard
# SDC — 11 de marzo 2026
# Para uso como referencia en terminales Claude Code

---

## 1. CONTEXTO Y HALLAZGOS

### Data legacy (NO tocar)
- `session_affectations` (2,930 registros): planos, sin agrupación por tema. affectation_type = "BLOQUEO", "ÓRGANO", "IMPLANTE" (texto libre de Notion). Casi todo NULL excepto chakra.
- `session_topics` (266 registros): más ricos — source_type organ/spine, zone (órgano/vértebra), narrativas de edades, energías ini/fin.
- `session_organs` (432 registros): órganos/columna vertebral por sesión.

### Endpoints existentes
- `PUT /sessions/{id}/topics` → acepta `{topics: [...]}` (min 1 item)
- `PUT /sessions/{id}/affectations` → acepta `{affectations: [...]}` (min 1 item)
- Ambos funcionan pero OpenAPI no muestra rutas (probablemente Swagger deshabilitado)

### Concepto clave de Tanya
Los **temas son persistentes a nivel del paciente**, no efímeros por sesión:
- Un tema ("Relación con madre") se trabaja a lo largo de múltiples sesiones
- Cada sesión puede trabajar temas existentes o crear uno nuevo
- El progreso (0-100%) se actualiza sesión a sesión
- La sanadora marca "Completado" cuando el tema se resuelve
- Vista "Temas Trabajados" muestra estadísticas: sesiones, órganos, energías finales

---

## 2. MODELO DE DATOS — TABLAS NUEVAS (Alembic 0005)

### 2.1 client_topics — Temas persistentes por paciente

```sql
CREATE TABLE client_topics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    progress_pct SMALLINT NOT NULL DEFAULT 0 CHECK (progress_pct BETWEEN 0 AND 100),
    is_completed BOOLEAN NOT NULL DEFAULT FALSE,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);
CREATE INDEX ix_client_topics_client_id ON client_topics(client_id);
```

### 2.2 session_theme_entries — Trabajo por tema por sesión

Cada fila = un bloqueo, resultante, o tema secundario dentro de un tema en una sesión.

```sql
CREATE TABLE session_theme_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    client_topic_id UUID NOT NULL REFERENCES client_topics(id) ON DELETE CASCADE,
    
    -- Tipo de entrada
    entry_type VARCHAR(20) NOT NULL CHECK (entry_type IN (
        'bloqueo_1', 'bloqueo_2', 'bloqueo_3', 'resultante', 'secundario'
    )),
    
    -- Bloqueo/Resultante: chakra → órgano → energía
    chakra_position_id UUID REFERENCES chakra_positions(id) ON DELETE SET NULL,
    organ_name VARCHAR(200),
    initial_energy NUMERIC(5,2),
    final_energy NUMERIC(5,2),
    
    -- Edades (se llenan solo en UNA fila por tema, típicamente bloqueo_1)
    childhood_place TEXT,
    childhood_people TEXT,
    childhood_situation TEXT,
    childhood_description TEXT,
    childhood_emotions TEXT,
    adulthood_place TEXT,
    adulthood_people TEXT,
    adulthood_situation TEXT,
    adulthood_description TEXT,
    adulthood_emotions TEXT,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ
);
CREATE INDEX ix_session_theme_entries_session_id ON session_theme_entries(session_id);
CREATE INDEX ix_session_theme_entries_topic_id ON session_theme_entries(client_topic_id);
```

### 2.3 Catálogo estático — chakra_organs (seed)

```sql
CREATE TABLE chakra_organs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chakra_position_id UUID NOT NULL REFERENCES chakra_positions(id) ON DELETE CASCADE,
    organ_name VARCHAR(200) NOT NULL,
    system_name VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ix_chakra_organs_chakra_id ON chakra_organs(chakra_position_id);
```

Seed data (del PDF "Órganos por Chakra"):

| Chakra | Sistema | Órganos |
|--------|---------|---------|
| Raíz | Inmunitario, Estructura celular | Sangre, Huesos, Base de la columna, Próstata, Vagina, Clítoris, Labios vaginales, Vejiga, Intestino grueso, Ano, Recto, Perineo, Piernas, Pies, Sacro, Coxis, Soporte físico del cuerpo |
| Sacro | — | Intestino grueso, Vértebras inferiores, Caderas, Pelvis, Pubis, Apéndice, Vejiga urinaria, Vesícula seminal, Uretra, Testículos, Pene, Escroto, Plexo venoso vaginal, Ovarios, Útero, Trompas de falopio, Riñones, Cresta ilíaca, Dorso lumbar |
| Plexo Solar | — | Abdomen, Estómago, Intestino delgado, Riñones, Hígado, Vesícula biliar, Bazo, Duodeno, Columna central, Caderas, Articulaciones, Vena porta, Píloro, Yeyuno, Colon ascendente, Ciego, Apéndice, Ombligo |
| Corazón | Circulatorio | Brazos, Radio, Cúbito, Deltoides, Codos, Manos, Muñeca, Pecho, Timo, Costillas, Pectoral, Esternón, Esófago, Corazón, Venas coronarias, Pericardio, Aorta, Cardias, Pulmones, Senos mamarios |
| Garganta | Respiratorio | Diafragma, Hombros, Pleura, Laringe, Tráquea, Parótida, Angina, Carótida, Esternocleidomastoideo, Yugular, Cuello |
| Tercer Ojo | Nervioso, Endócrino | Cerebro, Ojos, Nariz, Paranasales, Senos nasales, Mentón, Dentadura, Lengua, Hipotálamo, Oídos, Oreja, Nervio facial, Nuca, Tallo parietal, Hipocampo, Amígdala cerebral, Base del cráneo |
| Corona | Muscular, Nervioso autónomo, Esquelético | Cerebro, Piel, Hipófisis, Coronilla |

Columna vertebral (no es por chakra, es independiente):
- Lumbares: L1, L2, L3, L4, L5, L6
- Dorsales: D1-D12
- Cervicales: C1-C7

Glándulas por chakra:
- Raíz: Órganos sexuales
- Sacro: Suprarrenal y Órganos sexuales
- Plexo Solar: Páncreas
- Corazón: Timo
- Garganta: Tiroides, Timo, Salivares
- Tercer Ojo: Pineal y Pituitaria
- Corona: Pineal y Pituitaria

---

## 3. ENDPOINTS NUEVOS (Backend FastAPI)

### 3.1 Client Topics CRUD

```
GET    /api/v1/clinical/clients/{client_id}/topics
       → [{id, name, progress_pct, is_completed, completed_at, created_at}]
       → Solo activos (deleted_at IS NULL, is_completed = false) por defecto
       → Query param ?include_completed=true para ver todos

POST   /api/v1/clinical/clients/{client_id}/topics
       Body: {name: string}
       → Crea tema, retorna objeto directo (sin wrapper)

PATCH  /api/v1/clinical/clients/{client_id}/topics/{topic_id}
       Body: {name?, progress_pct?, is_completed?}
       → Si is_completed = true, setear completed_at = now()
       → Retorna objeto actualizado

DELETE /api/v1/clinical/clients/{client_id}/topics/{topic_id}
       → Soft delete (deleted_at = now())
       → 204 No Content
```

### 3.2 Session Theme Entries

```
PUT    /api/v1/clinical/sessions/{session_id}/theme-entries
       Body: {
         entries: [
           {
             client_topic_id: UUID,
             entry_type: "bloqueo_1" | "bloqueo_2" | "bloqueo_3" | "resultante" | "secundario",
             chakra_position_id?: UUID,
             organ_name?: string,
             initial_energy?: number (0-100),
             final_energy?: number (0-100),
             // Edades (solo en una fila por tema)
             childhood_place?: string,
             childhood_people?: string,
             childhood_situation?: string,
             childhood_description?: string,
             childhood_emotions?: string,
             adulthood_place?: string,
             adulthood_people?: string,
             adulthood_situation?: string,
             adulthood_description?: string,
             adulthood_emotions?: string,
           }
         ],
         // Progreso actualizado por tema
         topic_progress: [
           {client_topic_id: UUID, progress_pct: number}
         ]
       }
       → Reemplaza todas las entries de esta sesión (DELETE + INSERT)
       → Actualiza progress_pct en client_topics
       → Retorna {entries: [...], topics_updated: [...]}

GET    /api/v1/clinical/sessions/{session_id}/theme-entries
       → [{id, client_topic_id, entry_type, chakra_position_id, organ_name, 
           initial_energy, final_energy, childhood_*, adulthood_*}]
```

### 3.3 Catálogo de órganos por chakra

```
GET    /api/v1/catalogs/chakra-organs
       → [{id, chakra_position_id, organ_name, system_name}]
       → Cache 24h
```

### 3.4 Vista "Temas Trabajados" (estadísticas)

```
GET    /api/v1/clinical/clients/{client_id}/topics/{topic_id}/stats
       → {
           topic: {id, name, progress_pct, is_completed, created_at},
           sessions_count: number,
           organs_worked: [{organ_name, initial_energy, final_energy, session_date}],
           chakras_involved: [{chakra_name, count}]
         }
```

---

## 4. FRONTEND — PASO 4 DEL WIZARD

### 4.1 Flujo del usuario

```
PASO 4: "Temas a trabajar"
│
├── Pregunta inicial: "¿Trabajar tema existente o nuevo?"
│   ├── Existente → Select de temas activos del paciente (GET /clients/{id}/topics)
│   └── Nuevo → Input de texto para nombre → POST /clients/{id}/topics → auto-seleccionar
│
├── "¿Cuántos temas en esta sesión?" → Counter (1-5)
│
├── TEMA CARD (×N) — colapsable/expandible
│   ├── Header: nombre del tema + badge de progreso
│   │
│   ├── Sección "Bloqueos" (3 filas + 1 resultante)
│   │   ├── Bloqueo 1:
│   │   │   ├── Chakra (select 7 opciones)
│   │   │   ├── Órgano (select filtrado por chakra — del catálogo)
│   │   │   └── Energía del órgano (EnergySlider 0-100)
│   │   ├── Bloqueo 2: (mismo)
│   │   ├── Bloqueo 3: (mismo)
│   │   └── Resultante: (mismo, badge visual distinto "Resultante")
│   │
│   ├── Tema Secundario (toggle opcional)
│   │   └── Solo: Energía inicial + Energía final (2 sliders)
│   │
│   ├── Sección "Edades" 
│   │   ├── Infancia:
│   │   │   ├── Lugar / Espacio (text)
│   │   │   ├── Personas involucradas (text)
│   │   │   ├── Situación ocurrida (textarea)
│   │   │   ├── Descripción (textarea)
│   │   │   └── Emociones generadas (text)
│   │   └── Adultez: (mismos 5 campos)
│   │
│   └── Progreso del tema: slider 0-100% con valor actual
│
└── Botón "Guardar temas" → PUT /sessions/{id}/theme-entries
```

### 4.2 Componentes nuevos

```
components/clinical/wizard/
├── StepTopics.tsx              → Rewrite completo (orquestador)
├── TopicSelector.tsx           → "¿Existente o nuevo?" + selector
├── ThemeCard.tsx               → Card colapsable por tema
├── BlockageRow.tsx             → Fila: chakra → órgano → energía
├── SecondaryThemeToggle.tsx    → Toggle + 2 sliders
├── AgesSection.tsx             → Infancia + Adultez (5 campos × 2)
└── TopicProgressSlider.tsx     → Slider de progreso 0-100%

lib/data/
└── chakra-organs.ts            → JSON estático del catálogo (para uso inmediato, 
                                   luego migrar a GET /catalogs/chakra-organs)
```

### 4.3 Catálogo estático (frontend, usar hasta que exista el endpoint)

```typescript
// lib/data/chakra-organs.ts

export interface ChakraOrganEntry {
  chakraKey: string;       // "root" | "sacral" | "solar_plexus" | "heart" | "throat" | "third_eye" | "crown"
  organs: string[];
  systems: string[];
  glands: string[];
}

export const CHAKRA_ORGANS: Record<string, ChakraOrganEntry> = {
  root: {
    organs: [
      "Sangre", "Huesos", "Base de la columna", "Próstata", "Vagina",
      "Clítoris", "Labios vaginales", "Vejiga", "Intestino grueso",
      "Ano", "Recto", "Perineo", "Piernas", "Pies", "Sacro", "Coxis",
      "Soporte físico del cuerpo"
    ],
    systems: ["Inmunitario", "Estructura celular"],
    glands: ["Órganos sexuales"],
  },
  sacral: {
    organs: [
      "Intestino grueso", "Vértebras inferiores", "Caderas", "Pelvis",
      "Pubis", "Apéndice", "Vejiga urinaria", "Vesícula seminal",
      "Uretra", "Testículos", "Pene", "Escroto", "Plexo venoso vaginal",
      "Ovarios", "Útero", "Trompas de falopio", "Riñones", "Cresta ilíaca",
      "Dorso lumbar"
    ],
    systems: [],
    glands: ["Suprarrenal", "Órganos sexuales"],
  },
  solar_plexus: {
    organs: [
      "Abdomen", "Estómago", "Intestino delgado", "Riñones", "Hígado",
      "Vesícula biliar", "Bazo", "Duodeno", "Columna central", "Caderas",
      "Articulaciones", "Vena porta", "Píloro", "Yeyuno",
      "Colon ascendente", "Ciego", "Apéndice", "Ombligo"
    ],
    systems: [],
    glands: ["Páncreas"],
  },
  heart: {
    organs: [
      "Brazos", "Radio", "Cúbito", "Deltoides", "Codos", "Manos",
      "Muñeca", "Pecho", "Timo", "Costillas", "Pectoral", "Esternón",
      "Esófago", "Corazón", "Venas coronarias", "Pericardio", "Aorta",
      "Cardias", "Pulmones", "Senos mamarios"
    ],
    systems: ["Circulatorio"],
    glands: ["Timo"],
  },
  throat: {
    organs: [
      "Diafragma", "Hombros", "Pleura", "Laringe", "Tráquea",
      "Parótida", "Angina", "Carótida", "Esternocleidomastoideo",
      "Yugular", "Cuello"
    ],
    systems: ["Respiratorio"],
    glands: ["Tiroides", "Timo", "Salivares"],
  },
  third_eye: {
    organs: [
      "Cerebro", "Ojos", "Nariz", "Paranasales", "Senos nasales",
      "Mentón", "Dentadura", "Lengua", "Hipotálamo", "Oídos", "Oreja",
      "Nervio facial", "Nuca", "Tallo parietal", "Hipocampo",
      "Amígdala cerebral", "Base del cráneo"
    ],
    systems: ["Nervioso", "Endócrino"],
    glands: ["Pineal", "Pituitaria"],
  },
  crown: {
    organs: ["Cerebro", "Piel", "Hipófisis", "Coronilla"],
    systems: ["Muscular", "Nervioso autónomo", "Esquelético"],
    glands: ["Pineal", "Pituitaria"],
  },
};

// Mapeo chakraKey → nombre en BD (para buscar el UUID en el catálogo)
export const CHAKRA_KEY_TO_NAME: Record<string, string> = {
  root: "Raíz",
  sacral: "Sacro",
  solar_plexus: "Plexo Solar",
  heart: "Corazón",
  throat: "Garganta",
  third_eye: "Tercer Ojo",
  crown: "Corona",
};
```

### 4.4 Vista "Temas Trabajados" — nueva tab en ficha del paciente

```
Tab "Temas" en app/(clinica)/clinica/pacientes/[id]/page.tsx
│
├── Lista de temas activos (is_completed = false)
│   └── Card por tema:
│       ├── Nombre del tema
│       ├── Barra de progreso (0-100%) con color gradiente
│       ├── "Creado el {fecha}" en text-xs text-gray-400
│       ├── Botón "Completado" → PATCH topic con is_completed=true
│       └── Expandir → Estadísticas:
│           ├── Sesiones en que se trabajó: N
│           ├── Órganos trabajados: lista con energía ini→fin
│           └── Chakras involucrados: badges
│
├── Sección "Temas completados" (colapsable)
│   └── Mismo formato pero con badge "Completado" y fecha
│
└── Botón "Nuevo tema" → crear manualmente fuera de sesión
```

---

## 5. ORDEN DE IMPLEMENTACIÓN

### Terminal 1 — Backend: Migración + Endpoints
```
1. Alembic 0005: crear client_topics, session_theme_entries, chakra_organs
2. Seed chakra_organs con data del PDF
3. Modelo SQLAlchemy para las 3 tablas nuevas
4. Schemas Pydantic para request/response
5. Router: /clients/{id}/topics (CRUD)
6. Router: /sessions/{id}/theme-entries (PUT + GET)
7. Router: /catalogs/chakra-organs (GET)
8. Router: /clients/{id}/topics/{id}/stats (GET)
9. docker compose up -d --build clinical-api
10. Probar con curl
```

### Terminal 2 — Frontend: Paso 4 del Wizard
```
1. Crear lib/data/chakra-organs.ts (catálogo estático)
2. Actualizar types/api.ts con ClientTopic, SessionThemeEntry, etc.
3. Actualizar lib/api/clinical.ts con funciones nuevas
4. Crear componentes: TopicSelector, BlockageRow, AgesSection, ThemeCard
5. Rewrite StepTopics.tsx
6. Actualizar sesiones/nueva/page.tsx para el nuevo paso 4
7. npx tsc --noEmit
```

### Terminal 3 — Frontend: Vista "Temas Trabajados"
```
1. Agregar tab "Temas" en pacientes/[id]/page.tsx
2. Componente TopicCard con barra de progreso + botón completado
3. Sección expandible con estadísticas
4. npx tsc --noEmit
```

---

## 6. SHAPES DE RESPUESTA (para evitar bugs de wrapper)

```
GET  /clients/{id}/topics          → array directo [{id, name, progress_pct, ...}]
POST /clients/{id}/topics          → objeto directo {id, name, progress_pct, ...}
PATCH /clients/{id}/topics/{id}    → objeto directo
DELETE /clients/{id}/topics/{id}   → 204 No Content

PUT  /sessions/{id}/theme-entries  → {entries: [...], topics_updated: [...]}
GET  /sessions/{id}/theme-entries  → array directo [...]

GET  /catalogs/chakra-organs       → array directo [...]

GET  /clients/{id}/topics/{id}/stats → objeto directo {topic, sessions_count, organs_worked, chakras_involved}
```

---

## 7. NOTAS IMPORTANTES

- Las tablas legacy (session_affectations, session_topics, session_organs) NO se tocan. Coexisten con las nuevas.
- El endpoint PUT /sessions/{id}/topics existente sigue funcionando para datos legacy. Los nuevos usan PUT /sessions/{id}/theme-entries.
- La migración Alembic 0005 debe tener down_revision = "0004" (verificar cuál es la última migración).
- Escala de energía de órganos: 0-100 (igual que dimensiones energéticas, NO 0-14 como chakras).
- El wizard debe poder manejar 1-5 temas × (3 bloqueos + 1 resultante + 1 secundario) = hasta 25 filas de session_theme_entries por sesión.
- Progreso del tema se actualiza en el PUT de theme-entries, no en un endpoint separado.
