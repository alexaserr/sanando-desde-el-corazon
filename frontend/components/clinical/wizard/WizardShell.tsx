'use client';

import { useWizardStore } from '@/lib/stores/wizardStore';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface WizardStep {
  key: string;
  label: string;
  shortLabel: string;
}

// ─── Stepper indicator ────────────────────────────────────────────────────────

interface StepDotProps {
  position: number;
  label: string;
  shortLabel: string;
  isCurrent: boolean;
  isCompleted: boolean;
  onClick: () => void;
}

function StepDot({ position, label, isCurrent, isCompleted, onClick }: StepDotProps) {
  const base =
    'flex items-center justify-center w-8 h-8 rounded-full text-xs font-semibold border-2 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1';

  let circleClass: string;
  if (isCurrent) {
    circleClass = `${base} bg-terra-700 border-terra-700 text-white ring-2 ring-terra-300 ring-offset-1`;
  } else if (isCompleted) {
    circleClass = `${base} bg-terra-700 border-terra-700 text-white cursor-pointer hover:opacity-80`;
  } else {
    circleClass = `${base} bg-white border-terra-200 text-terra-300 cursor-default`;
  }

  return (
    <button
      type="button"
      onClick={isCompleted && !isCurrent ? onClick : undefined}
      disabled={!isCompleted || isCurrent}
      aria-current={isCurrent ? 'step' : undefined}
      aria-label={`Paso ${position}: ${label}${isCompleted ? ' (completado)' : ''}`}
      className={circleClass}
    >
      {isCompleted && !isCurrent ? (
        <svg aria-hidden="true" className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
            clipRule="evenodd"
          />
        </svg>
      ) : (
        position
      )}
    </button>
  );
}

// ─── Stepper barra ────────────────────────────────────────────────────────────

interface StepperProps {
  steps: WizardStep[];
  currentStep: number;
  completedSteps: number[];
  onStepClick: (step: number) => void;
}

function Stepper({ steps, currentStep, completedSteps, onStepClick }: StepperProps) {
  const totalSteps = steps.length;

  return (
    <nav aria-label="Progreso del wizard" className="w-full">
      {/* Barra de progreso */}
      <div className="relative mb-4">
        <div className="h-1.5 bg-terra-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-terra-400 rounded-full transition-all duration-500"
            style={{
              width: `${Math.max(0, ((currentStep - 1) / Math.max(1, totalSteps - 1)) * 100)}%`,
            }}
            role="progressbar"
            aria-valuenow={currentStep}
            aria-valuemin={1}
            aria-valuemax={totalSteps}
            aria-label={`Paso ${currentStep} de ${totalSteps}`}
          />
        </div>
      </div>

      {/* Dots de los pasos */}
      <ol className="flex items-start justify-between gap-1">
        {steps.map((step, i) => {
          const position  = i + 1;
          const isCurrent   = position === currentStep;
          const isCompleted = completedSteps.includes(position);

          return (
            <li
              key={step.key}
              className="flex flex-col items-center gap-1 flex-1 min-w-0"
            >
              <StepDot
                position={position}
                label={step.label}
                shortLabel={step.shortLabel}
                isCurrent={isCurrent}
                isCompleted={isCompleted}
                onClick={() => onStepClick(position)}
              />
              {/* Label — oculto en móvil muy pequeño */}
              <span
                className={`text-[10px] text-center leading-tight select-none hidden sm:block ${
                  isCurrent
                    ? 'text-terra-700 font-semibold'
                    : isCompleted
                    ? 'text-terra-500'
                    : 'text-terra-300'
                }`}
              >
                {step.shortLabel}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

// ─── WizardShell ──────────────────────────────────────────────────────────────

export interface WizardShellProps {
  /** Pasos activos según la terapia seleccionada. */
  steps: WizardStep[];
  /** Contenido del paso actual — la página padre decide qué componente mostrar. */
  children: React.ReactNode;
  /** Avanzar al paso siguiente (puede ser async para enviar datos al API). */
  onNext: () => void | Promise<void>;
  /** Retroceder un paso. */
  onPrev: () => void;
  /** Guardar borrador sin avanzar. */
  onSaveDraft: () => void | Promise<void>;
  /** Cerrar sesión — solo habilitado en el último paso. */
  onCloseSession: () => void | Promise<void>;
  /** Deshabilita el botón "Siguiente" (validación pendiente, etc.). */
  isNextDisabled?: boolean;
  /** Estado de guardado en curso. */
  isSaving?: boolean;
}

/**
 * WizardShell — contenedor del wizard de sesión clínica.
 *
 * - Recibe `steps` del padre (config-driven según terapia).
 * - Lee currentStep y completedSteps del useWizardStore.
 * - Renderiza el stepper y los botones de navegación.
 * - NO hace fetch — los callbacks onNext/onSaveDraft los implementa la página.
 */
export function WizardShell({
  steps,
  children,
  onNext,
  onPrev,
  onSaveDraft,
  onCloseSession,
  isNextDisabled = false,
  isSaving = false,
}: WizardShellProps) {
  const { currentStep, completedSteps, setStep } = useWizardStore();

  const totalSteps  = steps.length;
  const isFirstStep = currentStep === 1;
  const isLastStep  = currentStep === totalSteps;

  const currentStepMeta = steps[currentStep - 1];

  return (
    <div className="flex flex-col min-h-0 gap-6">
      {/* Stepper */}
      <Stepper
        steps={steps}
        currentStep={currentStep}
        completedSteps={completedSteps}
        onStepClick={setStep}
      />

      {/* Chip del paso actual */}
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-terra-100 text-terra-700">
          Paso {currentStep} de {totalSteps}
        </span>
        {currentStepMeta && (
          <h1 className="text-sm font-semibold text-terra-700">
            {currentStepMeta.label}
          </h1>
        )}
      </div>

      {/* Contenido del paso actual */}
      <main className="flex-1 min-h-0">
        {children}
      </main>

      {/* Barra de acciones */}
      <footer className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-terra-100">
        {/* Guardar borrador */}
        <button
          type="button"
          onClick={onSaveDraft}
          disabled={isSaving}
          className="inline-flex items-center gap-1.5 rounded-lg border border-terra-200 bg-white px-3 py-2 text-sm font-medium text-terra-600 hover:bg-terra-50 focus:outline-none focus:ring-2 focus:ring-terra-700 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isSaving ? (
            <>
              <svg
                aria-hidden="true"
                className="w-3.5 h-3.5 animate-spin"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                />
              </svg>
              Guardando…
            </>
          ) : (
            <>
              <svg
                aria-hidden="true"
                className="w-3.5 h-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"
                />
              </svg>
              Guardar borrador
            </>
          )}
        </button>

        {/* Navegación prev / next */}
        <div className="flex items-center gap-2 ml-auto">
          {/* Anterior */}
          {!isFirstStep && (
            <button
              type="button"
              onClick={onPrev}
              disabled={isSaving}
              className="inline-flex items-center gap-1 rounded-lg border border-terra-200 bg-white px-3 py-2 text-sm font-medium text-terra-600 hover:bg-terra-50 focus:outline-none focus:ring-2 focus:ring-terra-700 focus:ring-offset-1 disabled:opacity-50 transition-colors"
            >
              <svg
                aria-hidden="true"
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              Anterior
            </button>
          )}

          {/* Cerrar sesión — solo en el último paso */}
          {isLastStep ? (
            <button
              type="button"
              onClick={onCloseSession}
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 rounded-md bg-[#1E5631] px-4 py-2 text-sm font-semibold text-white hover:bg-[#174926] focus:outline-none focus:ring-2 focus:ring-[#1E5631] focus:ring-offset-1 disabled:opacity-50 transition-colors"
            >
              <svg
                aria-hidden="true"
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              Cerrar sesión
            </button>
          ) : (
            /* Siguiente */
            <button
              type="button"
              onClick={onNext}
              disabled={isNextDisabled || isSaving}
              className="inline-flex items-center gap-1 rounded-lg bg-terra-700 px-4 py-2 text-sm font-semibold text-white hover:bg-terra-600 focus:outline-none focus:ring-2 focus:ring-terra-700 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Siguiente
              <svg
                aria-hidden="true"
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}

export default WizardShell;
