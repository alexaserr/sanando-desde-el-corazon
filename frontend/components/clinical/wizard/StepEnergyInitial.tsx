'use client';

import { useMemo, useCallback } from 'react';
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

  // Detectar dimensiones masculina y femenina por nombre (insensible a mayúsculas)
  const masculinaDim = useMemo(
    () => catalogDimensions.find((d) => d.name.toLowerCase().includes('masculin')),
    [catalogDimensions],
  );
  const femeninaDim = useMemo(
    () => catalogDimensions.find((d) => d.name.toLowerCase().includes('femenin')),
    [catalogDimensions],
  );

  // Sincronización bidireccional: masculina ↔ femenina siempre suman 100
  const handleChange = useCallback(
    (dimensionId: string, value: number) => {
      onChange(dimensionId, value);
      if (masculinaDim && femeninaDim) {
        if (dimensionId === masculinaDim.id) {
          onChange(femeninaDim.id, Math.max(0, Math.min(100, 100 - value)));
        } else if (dimensionId === femeninaDim.id) {
          onChange(masculinaDim.id, Math.max(0, Math.min(100, 100 - value)));
        }
      }
    },
    [onChange, masculinaDim, femeninaDim],
  );

  // Valores actuales de M y F para el indicador de balance
  const masculinaValue =
    masculinaDim !== undefined ? (readingMap.get(masculinaDim.id) ?? 0) : null;
  const femeninaValue =
    femeninaDim !== undefined ? (readingMap.get(femeninaDim.id) ?? 0) : null;
  const sumMF =
    masculinaValue !== null && femeninaValue !== null
      ? masculinaValue + femeninaValue
      : null;
  const mfBalanced = sumMF === 100;

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
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {catalogDimensions.map((dim) => (
              <div
                key={dim.id}
                className="bg-white rounded-lg border border-gray-100 shadow-sm p-4"
              >
                <EnergySlider
                  label={dim.name}
                  value={readingMap.get(dim.id) ?? 0}
                  onChange={(v) => handleChange(dim.id, v)}
                  phase="initial"
                  max={100}
                  disabled={disabled}
                />
              </div>
            ))}
          </div>

          {/* Indicador de balance Masculina + Femenina */}
          {sumMF !== null && (
            <p
              className={`text-xs ${mfBalanced ? 'text-gray-400' : 'text-amber-600'}`}
              role={mfBalanced ? undefined : 'alert'}
            >
              {mfBalanced
                ? `Masculina (${masculinaValue}) + Femenina (${femeninaValue}) = 100 ✓`
                : `⚠ Masculina (${masculinaValue}) + Femenina (${femeninaValue}) = ${sumMF} — debe sumar 100`}
            </p>
          )}
        </>
      )}
    </section>
  );
}

export default StepEnergyInitial;
