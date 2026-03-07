import { create } from "zustand";

export interface WizardFlags {
  has_energy_initial: boolean;
  has_chakra_initial: boolean;
  has_topics: boolean;
  has_energy_final: boolean;
  has_chakra_final: boolean;
  has_lnt: boolean;
  has_cleaning_events: boolean;
  has_affectations: boolean;
  is_closed: boolean;
}

/** Respuesta del API al avanzar un paso del wizard */
export interface WizardStepResponse {
  session_id: string;
  flags: WizardFlags;
}

interface WizardState {
  currentStep: number;
  sessionId: string | null;
  completedSteps: number[];
  flags: WizardFlags;
  // Actions
  setStep: (step: number) => void;
  markStepComplete: (step: number) => void;
  setSessionId: (id: string) => void;
  updateFromResponse: (response: WizardStepResponse) => void;
  reset: () => void;
}

const initialFlags: WizardFlags = {
  has_energy_initial: false,
  has_chakra_initial: false,
  has_topics: false,
  has_energy_final: false,
  has_chakra_final: false,
  has_lnt: false,
  has_cleaning_events: false,
  has_affectations: false,
  is_closed: false,
};

/** Mapeo de flags a número de paso del wizard (1-8) */
function deriveCompletedSteps(flags: WizardFlags): number[] {
  const steps: number[] = [];
  if (flags.has_energy_initial) steps.push(2);
  if (flags.has_chakra_initial) steps.push(3);
  if (flags.has_topics) steps.push(4);
  if (flags.has_energy_final) steps.push(5);
  if (flags.has_chakra_final) steps.push(6);
  if (flags.has_lnt) steps.push(7);
  if (flags.has_cleaning_events || flags.has_affectations) steps.push(8);
  return steps;
}

export const useWizardStore = create<WizardState>((set) => ({
  currentStep: 1,
  sessionId: null,
  completedSteps: [],
  flags: { ...initialFlags },

  setStep: (step) => set({ currentStep: step }),

  markStepComplete: (step) =>
    set((state) => ({
      completedSteps: state.completedSteps.includes(step)
        ? state.completedSteps
        : [...state.completedSteps, step],
    })),

  setSessionId: (id) => set({ sessionId: id }),

  updateFromResponse: (response) =>
    set({
      sessionId: response.session_id,
      flags: response.flags,
      completedSteps: deriveCompletedSteps(response.flags),
    }),

  reset: () =>
    set({
      currentStep: 1,
      sessionId: null,
      completedSteps: [],
      flags: { ...initialFlags },
    }),
}));
