// Tipos compartidos entre los pasos del wizard de sesión clínica.
// No importar desde app/ — solo para components/clinical/wizard/

/** Opción de cliente para el selector del paso 1. */
export interface ClientOption {
  id: string;
  full_name: string;
}

/** Opción de tipo de terapia para el selector del paso 1. */
export interface TherapyTypeOption {
  id: string;
  name: string;
}

/** Dimensión energética del catálogo (GET /catalogs/energy-dimensions). */
export interface EnergyDimension {
  id: string;
  name: string;
}

/** Lectura de una dimensión energética. Escala 0-100. */
export interface EnergyReading {
  dimension_id: string;
  value: number;
}

/**
 * Lectura de chakra para el wizard.
 * Escala NATIVA 0-14 — nunca convertir a 0-100.
 */
export interface WizardChakraReading {
  chakra_position_id: string;
  name: string;
  value: number;
}

export type SourceType = 'spine' | 'organ';

/**
 * Tema trabajado durante la sesión.
 * _localId: identificador local React (no va al API).
 * adult_age / child_age como string para manejar input vacío sin forzar 0.
 */
export interface Topic {
  _localId: string;
  source_type: SourceType;
  zone: string;
  adult_theme: string;
  child_theme: string;
  adult_age: string;
  child_age: string;
  emotions: string;
  initial_energy: number; // 0-100
  final_energy: number;   // 0-100
}

/** Datos del paso 1 — Datos generales de la sesión. */
export interface GeneralData {
  client_id: string;
  therapy_type_id: string;
  measured_at: string;    // valor de input[type=datetime-local]  → ISO 8601
  general_energy: number; // 0-100
  notes: string;
  // Limpieza y Entidades (registrados en el paso 1)
  has_entities: boolean | null;
  entities_count: number;
  has_capas: boolean | null;
  capas_count: number;
  has_implants: boolean | null;
  implants_count: number;
  requires_cleanings: boolean | null;
  total_cleanings: number;
}

// ─── Nuevos tipos para el rediseño del paso 4 ────────────────────────────────

/** Datos de una sección etaria (infancia o adultez). */
export interface AgeData {
  place: string;
  people: string;
  situation: string;
  description: string;
  emotions: string;
}

/** Un bloqueo individual (chakra + órgano + energía). */
export interface BlockageData {
  chakra_position_id: string;
  organ_name: string;
  energy: number; // 0-100
  final_energy?: number;
  significado?: string;
}

/** Tema trabajado con el nuevo modelo (rediseño paso 4). */
export interface ThemeEntry {
  _localId: string;
  /** ID del ClientTopic existente, o null si aún no se persistió. */
  topic_id: string | null;
  /** true si el topic fue creado en esta sesión mediante POST y debe
   *  eliminarse del backend al borrar el tema del listado. */
  _isCreatedLocally?: boolean;
  name: string;
  is_secondary: boolean;
  /** Solo relevante si is_secondary = true. */
  secondary_name?: string;
  /** Siempre 3 bloqueos. */
  blockages: [BlockageData, BlockageData, BlockageData];
  resultant: BlockageData;
  /** Solo relevante si is_secondary = true. */
  secondary_energy_initial: number;
  secondary_energy_final: number;
  /** Interpretación general del tema (un solo textarea por tema). */
  interpretacion_tema?: string;
  /** Emociones predominantes del tema (array de strings). */
  emotions?: string[];
  /** Edad infancia — opcional, máximo 9. */
  childhood_age?: number | null;
  /** Edad adultez — opcional, sin límite superior. */
  adulthood_age?: number | null;
  childhood: AgeData;
  adulthood: AgeData;
  progress_pct: number;
}

/** Check de capas pre-tabla (sección 1 del reporte de limpieza). */
export interface CleaningCheck {
  label: string;
  checked: boolean;
  quantity: number;
}

/** Una fila del reporte de limpieza energética. */
export interface CleaningRow {
  _localId: string;
  manifestation: string;
  work_done: string[];
  work_done_other?: string;
  materials: string[];
  origin: string;
}

/** Campos de resumen del paso de limpieza. */
export interface CleaningSummary {
  capas: number;
  limpiezas_requeridas: number;
  mesa_utilizada: string;
  beneficios: string;
}

// ─── Modelo por grupos de limpieza ──────────────────────────────────────────

/** Entrada de capa de limpieza (chip toggle + cantidad). */
export interface LayerEntry {
  type: 'sin_capas' | 'capas' | 'capas_ocultas' | 'capas_invisibles' | 'candados' | 'candados_ocultos' | 'programaciones' | 'reprogramaciones_ocultas_invisibles';
  quantity: number;
}

/** Manifestación/evento de limpieza con detalles expandibles. */
export interface ManifestationEntry {
  id: string;
  name: string;
  value: number;
  unit: 'numero' | 'porcentaje';
  work_done: string;
  work_done_custom?: string;
  materials: string[];
  origins: string[];
  is_auto_injected?: boolean;
  expanded: boolean;
}

/** Grupo de limpieza — cada grupo representa una persona/casa diferente. */
export interface CleaningGroup {
  id: string;
  target_type: 'paciente' | 'familiar' | 'casa' | 'otro';
  target_name: string;
  family_member_id?: string;
  layers: LayerEntry[];
  events: ManifestationEntry[];
  cleanings_required: number;
  mesa_utilizada: string[];
  beneficios: string;
  is_charged: boolean;
  cost_per_cleaning: number;
}

// ─── Tipos para el Reporte de Ancestros ──────────────────────────────────────

export interface AncestorEntry {
  _localId: string;
  member: string;
  lineage: 'materno' | 'paterno' | 'ambos' | '';
  bond_energy: string[];
  ancestor_roles: string[];
  consultant_roles: string[];
  energy_expressions: { number: number; expression: string }[];
  family_traumas: { number: number; trauma: string }[];
}

export interface AncestorConciliation {
  healing_phrases: string;
  conciliation_acts: string;
  life_aspects_affected: string;
  session_relationship: string;
}

/** Entrada de tema LNT para el paso StepLNT. */
export interface LntEntry {
  _localId: string;
  theme_organ: string;
  initial_energy: number;   // 0-100
  final_energy: number;     // 0-100
  healing_energy_body: boolean;
  healing_spiritual_body: boolean;
  healing_physical_body: boolean;
}

/** Entrada de protección por persona. */
export interface ProtectionEntry {
  _localId: string;
  person_name: string;
  quantity: number;
  selected: boolean;
}

/** Datos del paso 7 — Cierre de la sesión. */
export interface CloseData {
  cost: string;           // string para manejar campo vacío en input
  payment_notes: string;
}

/** Resumen visible en el panel de cierre (StepClose). */
export interface SessionSummary {
  clientName: string;
  therapyTypeName: string;
  measuredAt: string;
  generalEnergy: number;
  energyInitialAvg: number | null;
  energyFinalAvg: number | null;
  topicsCount: number;
  chakraInitialCount: number;
  chakraFinalCount: number;
}
