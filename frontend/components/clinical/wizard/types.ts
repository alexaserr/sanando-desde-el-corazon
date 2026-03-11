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
}

/** Tema trabajado con el nuevo modelo (rediseño paso 4). */
export interface ThemeEntry {
  _localId: string;
  /** ID del ClientTopic existente, o null si es nuevo. */
  topic_id: string | null;
  name: string;
  is_secondary: boolean;
  /** Siempre 3 bloqueos. */
  blockages: [BlockageData, BlockageData, BlockageData];
  resultant: BlockageData;
  /** Solo relevante si is_secondary = true. */
  secondary_energy_initial: number;
  secondary_energy_final: number;
  childhood: AgeData;
  adulthood: AgeData;
  progress_pct: number;
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
