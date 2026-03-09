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
}

/** Datos del paso 7 — Cierre de la sesión. */
export interface CloseData {
  cost: string;           // string para manejar campo vacío en input
  payment_notes: string;
  entities: string;       // string para manejar campo vacío
  implants: string;       // string para manejar campo vacío
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
