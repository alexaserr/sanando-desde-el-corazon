import { create } from "zustand";
import type { WizardStepResponse } from "@/types/api";

// 8 pasos del wizard de sesión clínica
export type WizardStep = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

interface WizardState {
  sessionId: string | null;
  currentStep: WizardStep;
  completedSteps: Set<WizardStep>;
  isDirty: boolean;
  isSubmitting: boolean;
  // Datos por paso (parciales, se rellenan a medida que avanza)
  stepData: Partial<Record<WizardStep, WizardStepResponse>>;

  setSessionId: (id: string) => void;
  setStep: (step: WizardStep) => void;
  markStepComplete: (step: WizardStep) => void;
  updateFromResponse: (step: WizardStep, data: WizardStepResponse) => void;
  setDirty: (dirty: boolean) => void;
  setSubmitting: (submitting: boolean) => void;
  reset: () => void;
}

const initialState = {
  sessionId: null,
  currentStep: 1 as WizardStep,
  completedSteps: new Set<WizardStep>(),
  isDirty: false,
  isSubmitting: false,
  stepData: {},
};

export const useWizardStore = create<WizardState>((set) => ({
  ...initialState,

  setSessionId: (id) => set({ sessionId: id }),

  setStep: (step) => set({ currentStep: step, isDirty: false }),

  markStepComplete: (step) =>
    set((state) => ({
      completedSteps: new Set([...state.completedSteps, step]),
    })),

  updateFromResponse: (step, data) =>
    set((state) => ({
      stepData: { ...state.stepData, [step]: data },
      completedSteps: new Set([...state.completedSteps, step]),
      isDirty: false,
    })),

  setDirty: (dirty) => set({ isDirty: dirty }),

  setSubmitting: (submitting) => set({ isSubmitting: submitting }),

  reset: () =>
    set({
      ...initialState,
      completedSteps: new Set<WizardStep>(),
      stepData: {},
    }),
}));
