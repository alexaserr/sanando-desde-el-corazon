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

const BASE = [S_GENERAL, S_CHAKRAS_INITIAL, S_ENERGY_INITIAL];
const TAIL = [S_ENERGY_FINAL, S_CHAKRAS_FINAL, S_CLOSE];

// ─── Configuraciones por tipo de terapia ──────────────────────────────────────

export const WIZARD_CONFIGS: Record<string, TherapyWizardConfig> = {
  'Sanación Energética': {
    therapyName: 'Sanación Energética',
    steps: [...BASE, S_TOPICS, ...TAIL],
    defaultCost: 1300,
  },
  'Sanación Energética a Distancia': {
    therapyName: 'Sanación Energética a Distancia',
    steps: [...BASE, S_TOPICS, ...TAIL],
    defaultCost: 1300,
  },
  'Medicina Cuántica': {
    therapyName: 'Medicina Cuántica',
    steps: [...BASE, S_TOPICS, ...TAIL],
    defaultCost: 1600,
  },
  'Terapia LNT': {
    therapyName: 'Terapia LNT',
    steps: [...BASE, S_LNT, ...TAIL],
    defaultCost: 1300,
  },
  'Extracción de Energías Densas': {
    therapyName: 'Extracción de Energías Densas',
    steps: [...BASE, ...TAIL],
    defaultCost: 2200,
  },
  'Armonización Energética y Mandala': {
    therapyName: 'Armonización Energética y Mandala',
    steps: [...BASE, ...TAIL],
    defaultCost: 2300,
  },
  'Recuperación del Alma': {
    therapyName: 'Recuperación del Alma',
    steps: [...BASE, S_TOPICS, ...TAIL],
    defaultCost: 1700,
  },
  'Despacho': {
    therapyName: 'Despacho',
    steps: [...BASE, ...TAIL],
    defaultCost: 2500,
  },
  'Limpieza Energética': {
    therapyName: 'Limpieza Energética',
    steps: [...BASE, S_CLEANING, S_CLOSE],
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
