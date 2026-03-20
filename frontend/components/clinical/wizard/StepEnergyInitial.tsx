'use client';

import { useMemo, useCallback, useState } from 'react';
import { Plus } from 'lucide-react';
import { EnergySlider } from '../EnergySlider';
import { StepAncestors } from './StepAncestors';
import { createEnergyDimension } from '@/lib/api/clinical';
import { useAuthStore } from '@/store/auth';
import type { EnergyDimension, EnergyReading, AncestorEntry, AncestorConciliation } from './types';

export interface StepEnergyInitialProps {
  /** Dimensiones del catálogo (GET /catalogs/energy-dimensions). */
  catalogDimensions: EnergyDimension[];
  /** Lecturas actuales indexadas por dimension_id. */
  readings: EnergyReading[];
  onChange: (dimension_id: string, value: number) => void;
  disabled?: boolean;
  // Ancestros
  ancestors: AncestorEntry[];
  onAncestorsChange: (ancestors: AncestorEntry[]) => void;
  conciliation: AncestorConciliation;
  onConciliationChange: (conciliation: AncestorConciliation) => void;
  /** Callback cuando se crea una nueva dimensión desde el formulario inline. */
  onDimensionCreated?: (dim: { id: string; name: string }) => void;
}

export function StepEnergyInitial({
  catalogDimensions,
  readings,
  onChange,
  disabled = false,
  ancestors,
  onAncestorsChange,
  conciliation,
  onConciliationChange,
  onDimensionCreated,
}: StepEnergyInitialProps) {
  const [isAncestorsOpen, setIsAncestorsOpen] = useState(false);

  // Nueva dimensión — inline form state
  const [showNewDimForm, setShowNewDimForm] = useState(false);
  const [newDimName, setNewDimName] = useState('');
  const [newDimError, setNewDimError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'admin';

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

  const ancestorBadge = ancestors.length > 0 ? ancestors.length : null;

  // Handler para crear nueva dimensión
  const handleCreateDimension = useCallback(async () => {
    const trimmed = newDimName.trim();
    if (!trimmed) return;

    setIsCreating(true);
    setNewDimError(null);
    try {
      const created = await createEnergyDimension(trimmed);
      onDimensionCreated?.(created);
      setNewDimName('');
      setShowNewDimForm(false);
    } catch (err) {
      setNewDimError(err instanceof Error ? err.message : 'Error al crear la dimensión.');
    } finally {
      setIsCreating(false);
    }
  }, [newDimName, onDimensionCreated]);

  return (
    <section aria-labelledby="step-energy-initial-heading" className="space-y-5">
      {/* Encabezado + botón Ancestros */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2
            id="step-energy-initial-heading"
            className="text-base font-semibold text-[#2C2220]"
          >
            Energía inicial
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Registra el nivel de cada dimensión energética al inicio de la sesión.
            Escala 0 – 100.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsAncestorsOpen(true)}
          disabled={disabled}
          className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-terra-300 bg-white px-3 py-1.5 text-sm font-medium text-terra-700 hover:bg-terra-50 focus:outline-none focus:ring-2 focus:ring-terra-700 focus:ring-offset-1 disabled:opacity-50 transition-colors"
        >
          <svg aria-hidden="true" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Ancestros
          {ancestorBadge !== null && (
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-terra-700 text-white text-[10px] font-bold">
              {ancestorBadge}
            </span>
          )}
        </button>
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

      {/* Botón + formulario inline para nueva dimensión (solo admin) */}
      {isAdmin && !disabled && (
        <div className="pt-1">
          {!showNewDimForm ? (
            <button
              type="button"
              onClick={() => setShowNewDimForm(true)}
              className="text-xs text-[#C4704A] flex items-center gap-1 hover:text-[#A35A38] transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Nueva dimensión
            </button>
          ) : (
            <div className="bg-[#F2E8E4] rounded-lg p-3 flex gap-2 items-end animate-in fade-in slide-in-from-top-1 duration-200">
              <div className="flex-1">
                <label className="block text-[11px] uppercase tracking-wide text-[#4A3628] mb-1">
                  Nombre de la nueva dimensión
                </label>
                <input
                  type="text"
                  value={newDimName}
                  onChange={(e) => setNewDimName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleCreateDimension(); }}
                  placeholder="Ej. Energía Vital"
                  disabled={isCreating}
                  className="w-full bg-[#FAF7F5] border-b border-[#D4A592] rounded-none px-2 py-1.5 text-sm text-[#2C2220] placeholder:text-gray-400 focus:outline-none focus:border-[#C4704A] disabled:opacity-50 transition-colors"
                />
                {newDimError && (
                  <p className="text-xs text-red-600 mt-1">{newDimError}</p>
                )}
              </div>
              <button
                type="button"
                onClick={handleCreateDimension}
                disabled={isCreating || !newDimName.trim()}
                className="bg-[#C4704A] text-white rounded-md px-3 py-1.5 text-[13px] uppercase font-medium hover:bg-[#A35A38] disabled:opacity-50 transition-colors shrink-0"
              >
                {isCreating ? 'Creando…' : 'Crear'}
              </button>
              <button
                type="button"
                onClick={() => { setShowNewDimForm(false); setNewDimName(''); setNewDimError(null); }}
                disabled={isCreating}
                className="text-[#4A3628] text-xs hover:underline shrink-0 pb-0.5"
              >
                Cancelar
              </button>
            </div>
          )}
        </div>
      )}

      {/* Modal de Ancestros */}
      <StepAncestors
        isOpen={isAncestorsOpen}
        onClose={() => setIsAncestorsOpen(false)}
        ancestors={ancestors}
        onAncestorsChange={onAncestorsChange}
        conciliation={conciliation}
        onConciliationChange={onConciliationChange}
        disabled={disabled}
      />
    </section>
  );
}

export default StepEnergyInitial;
