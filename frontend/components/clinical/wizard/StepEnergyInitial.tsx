'use client';

import { useMemo } from 'react';
import { EnergySlider } from '../EnergySlider';
import type { EnergyDimension, EnergyReading } from './types';

export interface StepEnergyInitialProps {
  /** Dimensiones del catálogo (GET /catalogs/energy-dimensions). */
  catalogDimensions: EnergyDimension[];
  /** Lecturas actuales indexadas por dimension_id. */
  readings: EnergyReading[];
  onChange: (dimension_id: string, value: number) => void;
  disabled?: boolean;
}

export function StepEnergyInitial({
  catalogDimensions,
  readings,
  onChange,
  disabled = false,
}: StepEnergyInitialProps) {
  // Índice por dimension_id para O(1) lookup al renderizar
  const readingMap = useMemo(
    () => new Map(readings.map((r) => [r.dimension_id, r.value])),
    [readings],
  );

  return (
    <section aria-labelledby="step-energy-initial-heading" className="space-y-5">
      <div>
        <h2
          id="step-energy-initial-heading"
          className="text-base font-semibold text-[#4A1810]"
        >
          Energía inicial
        </h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Registra el nivel de cada dimensión energética al inicio de la sesión.
          Escala 0 – 100.
        </p>
      </div>

      {catalogDimensions.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-8">
          No hay dimensiones energéticas en el catálogo.
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {catalogDimensions.map((dim) => (
            <div
              key={dim.id}
              className="bg-white rounded-lg border border-gray-100 shadow-sm p-4"
            >
              <EnergySlider
                label={dim.name}
                value={readingMap.get(dim.id) ?? 0}
                onChange={(v) => onChange(dim.id, v)}
                phase="initial"
                max={100}
                disabled={disabled}
              />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default StepEnergyInitial;
