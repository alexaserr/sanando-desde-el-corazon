'use client';

import { ChakraGrid } from '../ChakraGrid';
import type { WizardChakraReading } from './types';

export interface StepChakrasFinalProps {
  /** Lecturas de chakras finales (escala 0-14 nativa). */
  readings: WizardChakraReading[];
  /** Lecturas iniciales del paso 3 para la vista comparativa. */
  compareReadings: WizardChakraReading[];
  onChange: (chakra_position_id: string, value: number) => void;
  disabled?: boolean;
  showAnimal?: boolean;
}

export function StepChakrasFinal({
  readings,
  compareReadings,
  onChange,
  disabled = false,
  showAnimal = false,
}: StepChakrasFinalProps) {
  return (
    <section aria-labelledby="step-chakras-final-heading" className="space-y-5">
      <div>
        <h2
          id="step-chakras-final-heading"
          className="text-base font-semibold text-[#1E5631]"
        >
          Chakras finales
        </h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Estado de cada chakra al cierre de la sesión. Escala 0 – 14.
          El badge "Inicial" muestra el valor registrado al inicio.
        </p>
      </div>

      <ChakraGrid
        readings={readings}
        onChange={onChange}
        phase="final"
        compareReadings={compareReadings}
        disabled={disabled}
        showAnimal={showAnimal}
      />
    </section>
  );
}

export default StepChakrasFinal;
