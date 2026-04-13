'use client';

import { useMemo, useCallback } from 'react';
import { EnergySlider } from '../EnergySlider';
import type { EnergyDimension, EnergyReading } from './types';

export interface StepEnergyFinalProps {
  /** Dimensiones del catálogo (las mismas que en StepEnergyInitial). */
  catalogDimensions: EnergyDimension[];
  /** Lecturas finales actuales. */
  readings: EnergyReading[];
  /** Lecturas iniciales (paso 2) para mostrar comparativa y delta. */
  compareReadings: EnergyReading[];
  onChange: (dimension_id: string, value: number) => void;
  disabled?: boolean;
}

export function StepEnergyFinal({
  catalogDimensions,
  readings,
  compareReadings,
  onChange,
  disabled = false,
}: StepEnergyFinalProps) {
  const readingMap = useMemo(
    () => new Map(readings.map((r) => [r.dimension_id, r.value])),
    [readings],
  );

  const compareMap = useMemo(
    () => new Map(compareReadings.map((r) => [r.dimension_id, r.value])),
    [compareReadings],
  );

  // Promedios para el resumen de cabecera
  const finalAvg = useMemo(() => {
    if (readings.length === 0) return null;
    const sum = readings.reduce((acc, r) => acc + r.value, 0);
    return Math.round(sum / readings.length);
  }, [readings]);

  const initialAvg = useMemo(() => {
    if (compareReadings.length === 0) return null;
    const sum = compareReadings.reduce((acc, r) => acc + r.value, 0);
    return Math.round(sum / compareReadings.length);
  }, [compareReadings]);

  const avgDelta =
    finalAvg !== null && initialAvg !== null ? finalAvg - initialAvg : null;

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
    <section aria-labelledby="step-energy-final-heading" className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
        <div>
          <h2
            id="step-energy-final-heading"
            className="text-base font-semibold text-[#1E5631]"
          >
            Energía final
          </h2>
          <p className="text-sm text-terra-500 mt-0.5">
            Registra el nivel de cada dimensión al cierre de la sesión. Escala 0 – 100.
          </p>
        </div>

        {/* Resumen de promedio */}
        {avgDelta !== null && (
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-terra-500">Promedio general:</span>
            <span
              className={`text-sm font-semibold ${
                avgDelta > 0
                  ? 'text-green-700'
                  : avgDelta < 0
                  ? 'text-red-700'
                  : 'text-terra-500'
              }`}
            >
              {initialAvg} → {finalAvg}
              {avgDelta !== 0 && (
                <span className="ml-1 font-normal text-xs">
                  ({avgDelta > 0 ? '+' : ''}{avgDelta})
                </span>
              )}
            </span>
          </div>
        )}
      </div>

      {catalogDimensions.length === 0 ? (
        <p className="text-sm text-terra-400 text-center py-8">
          No hay dimensiones energéticas en el catálogo.
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {catalogDimensions.map((dim) => {
            const finalValue   = readingMap.get(dim.id) ?? 0;
            const initialValue = compareMap.get(dim.id);

            return (
              <div
                key={dim.id}
                className="bg-terra-50 rounded-lg border border-terra-100 shadow-sm p-4"
              >
                {/* Valor inicial de referencia */}
                {initialValue !== undefined && (
                  <p className="text-xs text-terra-400 mb-1 select-none">
                    Inicial: <span className="font-semibold text-[#2C2220]">{initialValue}</span>
                  </p>
                )}
                <EnergySlider
                  label={dim.name}
                  value={finalValue}
                  compareValue={initialValue}
                  onChange={(v) => handleChange(dim.id, v)}
                  phase="final"
                  max={100}
                  disabled={disabled}
                />
              </div>
            );
          })}
        </div>
      )}

      {/* Indicador de balance Masculina + Femenina */}
      {sumMF !== null && (
        <p
          className={`text-xs ${mfBalanced ? 'text-terra-400' : 'text-amber-600'}`}
          role={mfBalanced ? undefined : 'alert'}
        >
          {mfBalanced
            ? `Masculina (${masculinaValue}) + Femenina (${femeninaValue}) = 100 ✓`
            : `⚠ Masculina (${masculinaValue}) + Femenina (${femeninaValue}) = ${sumMF} — debe sumar 100`}
        </p>
      )}
    </section>
  );
}

export default StepEnergyFinal;
