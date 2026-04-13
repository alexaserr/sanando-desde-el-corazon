// lib/data/wizard-config.ts
// Configuración config-driven del wizard de sesiones
// ACTUALIZADO: Abril 2026 — 7 terapias activas

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type WizardStepComponent =
  | 'StepGeneral'
  | 'StepEnergyInitial'
  | 'StepChakrasInitial'
  | 'StepTopics'
  | 'StepEnergyFinal'
  | 'StepChakrasFinal'
  | 'StepClose'
  | 'StepLNT'
  | 'StepCleaning';

export interface WizardStepConfig {
  key: string;
  label: string;
  shortLabel: string;
  component: WizardStepComponent;
  required: boolean;
}

export interface TherapyWizardConfig {
  therapyName: string;
  steps: WizardStepConfig[];
  defaultCost: number;
}

// ─── Definiciones de pasos compartidos ────────────────────────────────────────

const S_GENERAL: WizardStepConfig = {
  key: 'general', label: 'Datos de sesión', shortLabel: 'Datos',
  component: 'StepGeneral', required: true,
};
const S_ENERGY_INITIAL: WizardStepConfig = {
  key: 'energy-initial', label: 'Energía inicial', shortLabel: 'E. inicial',
  component: 'StepEnergyInitial', required: true,
};
const S_CHAKRAS_INITIAL: WizardStepConfig = {
  key: 'chakras-initial', label: 'Chakras iniciales', shortLabel: 'Chakras ini.',
  component: 'StepChakrasInitial', required: true,
};
const S_TOPICS: WizardStepConfig = {
  key: 'topics', label: 'Temas', shortLabel: 'Temas',
  component: 'StepTopics', required: false,
};
const S_LNT: WizardStepConfig = {
  key: 'lnt', label: 'LNT', shortLabel: 'LNT',
  component: 'StepLNT', required: false,
};
const S_CLEANING: WizardStepConfig = {
  key: 'cleaning', label: 'Limpieza', shortLabel: 'Limpieza',
  component: 'StepCleaning', required: false,
};
const S_ENERGY_FINAL: WizardStepConfig = {
  key: 'energy-final', label: 'Energía final', shortLabel: 'E. final',
  component: 'StepEnergyFinal', required: true,
};
const S_CHAKRAS_FINAL: WizardStepConfig = {
  key: 'chakras-final', label: 'Chakras finales', shortLabel: 'Chakras fin.',
  component: 'StepChakrasFinal', required: true,
};
const S_CLOSE: WizardStepConfig = {
  key: 'close', label: 'Cierre', shortLabel: 'Cierre',
  component: 'StepClose', required: true,
};

const HEAD = [S_GENERAL, S_CHAKRAS_INITIAL, S_ENERGY_INITIAL];
const TAIL = [S_CHAKRAS_FINAL, S_ENERGY_FINAL, S_CLOSE];

// ─── Configuraciones por tipo de terapia ──────────────────────────────────────

/**
 * WIZARD_CONFIGS — fuente de verdad del wizard
 *
 * Las keys son los NOMBRES de las terapias tal como aparecen en therapy_types.name
 *
 * Regla para terapias "básicas" (Extracción, Armonización, Lectura):
 * - Flujo normal: General → Chakras Init → Energy Init → Chakras Final → Energy Final → Close
 * - Si hay entidades/capas/implantes: se auto-inyecta StepCleaning y se REMUEVEN
 *   Chakras Final y Energy Final (el wizard ya maneja esto en WizardShell/nueva/page.tsx)
 */
export const WIZARD_CONFIGS: Record<string, TherapyWizardConfig> = {
  // ── Sanación Energética ──
  // Paso 4: StepTopics (temas + bloqueos + emociones + edades)
  'Sanación Energética': {
    therapyName: 'Sanación Energética',
    steps: [...HEAD, S_TOPICS, ...TAIL],
    defaultCost: 1300,
  },

  // ── Medicina Cuántica ──
  // Paso 4: StepTopics + StepLNT
  'Medicina Cuántica': {
    therapyName: 'Medicina Cuántica',
    steps: [...HEAD, S_TOPICS, S_LNT, ...TAIL],
    defaultCost: 1600,
  },

  // ── Terapia LNT ──
  // Paso 4: StepLNT (escala 0-14)
  'Terapia LNT': {
    therapyName: 'Terapia LNT',
    steps: [...HEAD, S_LNT, ...TAIL],
    defaultCost: 1300,
  },

  // ── Extracción ──
  // Básico: sin paso 4 variable
  // Si hay entidades/capas/implantes → auto-inject StepCleaning, remove finales
  'Extracción': {
    therapyName: 'Extracción',
    steps: [...HEAD, ...TAIL],
    defaultCost: 2200,
  },

  // ── Armonización Energética ──
  // Básico: sin paso 4 variable
  'Armonización Energética': {
    therapyName: 'Armonización Energética',
    steps: [...HEAD, ...TAIL],
    defaultCost: 2300,
  },

  // ── Lectura Energética ──
  // Básico: sin paso 4 variable
  'Lectura Energética': {
    therapyName: 'Lectura Energética',
    steps: [...HEAD, ...TAIL],
    defaultCost: 1300,
  },

  // ── Limpieza Energética ──
  // Paso 4: StepCleaning (grupos, cleaning events)
  // Flujo especial: General → Chakras Init → Energy Init → Cleaning → Close
  // (SIN chakras/energía finales)
  'Limpieza Energética': {
    therapyName: 'Limpieza Energética',
    steps: [...HEAD, S_CLEANING, S_CLOSE],
    defaultCost: 1300,
  },
};

export function getWizardConfig(therapyTypeName: string): TherapyWizardConfig {
  return WIZARD_CONFIGS[therapyTypeName] ?? WIZARD_CONFIGS['Sanación Energética'];
}

/**
 * Inyecta StepCleaning en el arreglo de pasos si no está presente.
 * Al inyectar limpieza se eliminan StepTopics, StepLNT, StepEnergyFinal
 * y StepChakrasFinal — la sesión de limpieza salta directamente al cierre.
 */
export function injectCleaningStep(baseSteps: WizardStepConfig[]): WizardStepConfig[] {
  // Remove ALL step-4 variants + final energy/chakra steps
  let steps = baseSteps.filter(
    (s) =>
      s.component !== 'StepEnergyFinal' &&
      s.component !== 'StepChakrasFinal' &&
      s.component !== 'StepTopics' &&
      s.component !== 'StepLNT',
  );
  if (!steps.some((s) => s.component === 'StepCleaning')) {
    const closeIdx = steps.findIndex((s) => s.component === 'StepClose');
    if (closeIdx === -1) steps.push(S_CLEANING);
    else steps = [...steps.slice(0, closeIdx), S_CLEANING, ...steps.slice(closeIdx)];
  }
  return steps;
}

/**
 * Lista de nombres de terapia activos (para el Select en StepGeneral)
 * Orden: display_order de la BD, pero este array sirve como fallback visual
 */
export const ACTIVE_THERAPY_NAMES = [
  'Sanación Energética',
  'Medicina Cuántica',
  'Terapia LNT',
  'Extracción',
  'Armonización Energética',
  'Lectura Energética',
  'Limpieza Energética',
] as const;
