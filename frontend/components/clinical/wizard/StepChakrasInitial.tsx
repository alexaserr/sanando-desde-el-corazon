'use client';

import { ChakraGrid } from '../ChakraGrid';
import type { WizardChakraReading } from './types';

export interface StepChakrasInitialProps {
  /** Lecturas de chakras iniciales (escala 0-14 nativa). */
  readings: WizardChakraReading[];
  onChange: (chakra_position_id: string, value: number) => void;
  disabled?: boolean;
  showAnimal?: boolean;
}

export function StepChakrasInitial({
  readings,
  onChange,
  disabled = false,
  showAnimal = false,
}: StepChakrasInitialProps) {
  return (
    <section aria-labelledby="step-chakras-initial-heading" className="space-y-5">
      <div>
        <h2
          id="step-chakras-initial-heading"
          className="text-base font-semibold text-[#4A1810]"
        >
          Chakras iniciales
        </h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Registra el estado de cada chakra al inicio de la sesión. Escala 0 – 14.
        </p>
      </div>

      <ChakraGrid
        readings={readings}
        onChange={onChange}
        phase="initial"
        disabled={disabled}
        showAnimal={showAnimal}
      />
    </section>
  );
}

export default StepChakrasInitial;
