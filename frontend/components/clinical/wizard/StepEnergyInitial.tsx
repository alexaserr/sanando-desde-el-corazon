'use client';

import { useMemo, useCallback, useState } from 'react';
import { Plus, Pencil, Check, X } from 'lucide-react';
import { EnergySlider } from '../EnergySlider';
import { createEnergyDimension, renameEnergyDimension } from '@/lib/api/clinical';
import type { EnergyDimension, EnergyReading } from './types';

export interface StepEnergyInitialProps {
  /** Dimensiones del catálogo (GET /catalogs/energy-dimensions). */
  catalogDimensions: EnergyDimension[];
  /** Lecturas actuales indexadas por dimension_id. */
  readings: EnergyReading[];
  onChange: (dimension_id: string, value: number) => void;
  disabled?: boolean;
  /** Callback cuando se crea una nueva dimensión desde el formulario inline. */
  onDimensionCreated?: (dim: { id: string; name: string }) => void;
  /** Callback cuando se renombra una dimensión existente (admin only). */
  onDimensionRenamed?: (id: string, newName: string) => void;
  /** Whether the current user is admin (controls rename/create UI). */
  isAdmin?: boolean;
}

// ─── Inline editable label for dimension names (admin only) ──────────────────

interface EditableDimensionLabelProps {
  dimensionId: string;
  name: string;
  isAdmin: boolean;
  onRename: (id: string, newName: string) => void;
}

function EditableDimensionLabel({ dimensionId, name, isAdmin, onRename }: EditableDimensionLabelProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);

  function save() {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== name) {
      onRename(dimensionId, trimmed);
      renameEnergyDimension(dimensionId, trimmed).catch(() => {
        // Silently fail — local state already updated
      });
    }
    setEditing(false);
  }

  function cancel() {
    setDraft(name);
    setEditing(false);
  }

  if (!isAdmin || !editing) {
    return (
      <span className="inline-flex items-center gap-1.5 group">
        <span className="text-sm font-medium text-[#2C2220]">{name}</span>
        {isAdmin && (
          <button
            type="button"
            onClick={() => { setDraft(name); setEditing(true); }}
            className="opacity-0 group-hover:opacity-100 text-[#4A3628]/40 hover:text-[#C4704A] transition-opacity"
            title="Renombrar dimensión"
          >
            <Pencil className="w-3 h-3" />
          </button>
        )}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <input
        autoFocus
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') save();
          if (e.key === 'Escape') cancel();
        }}
        onBlur={save}
        className="w-40 bg-[#FAF7F5] border-b border-[#D4A592] rounded-none px-1 py-0.5 text-sm text-[#2C2220] focus:outline-none focus:border-[#C4704A] transition-colors"
      />
      <button type="button" onMouseDown={save} className="text-emerald-600 hover:text-emerald-700">
        <Check className="w-3.5 h-3.5" />
      </button>
      <button type="button" onMouseDown={cancel} className="text-[#4A3628]/40 hover:text-red-500">
        <X className="w-3.5 h-3.5" />
      </button>
    </span>
  );
}

export function StepEnergyInitial({
  catalogDimensions,
  readings,
  onChange,
  disabled = false,
  onDimensionCreated,
  onDimensionRenamed,
  isAdmin = false,
}: StepEnergyInitialProps) {
  // Nueva dimensión — inline form state
  const [showNewDimForm, setShowNewDimForm] = useState(false);
  const [newDimName, setNewDimName] = useState('');
  const [newDimError, setNewDimError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

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

  // Handler para renombrar dimensión
  const handleRenameDimension = useCallback(
    (id: string, newName: string) => {
      onDimensionRenamed?.(id, newName);
    },
    [onDimensionRenamed],
  );

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
      {/* Encabezado */}
      <div>
        <h2
          id="step-energy-initial-heading"
          className="text-base font-semibold text-[#2C2220]"
        >
          Energía inicial
        </h2>
        <p className="text-sm text-terra-500 mt-0.5">
          Registra el nivel de cada dimensión energética al inicio de la sesión.
          Escala 0 – 100.
        </p>
      </div>

      {catalogDimensions.length === 0 ? (
        <p className="text-sm text-terra-400 text-center py-8">
          No hay dimensiones energéticas en el catálogo.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {catalogDimensions.map((dim) => (
              <div
                key={dim.id}
                className="bg-terra-50 rounded-lg border border-terra-100 shadow-sm p-4"
              >
                {/* Row: editable name + number input */}
                <div className="flex items-center justify-between mb-1">
                  <EditableDimensionLabel
                    dimensionId={dim.id}
                    name={dim.name}
                    isAdmin={isAdmin}
                    onRename={handleRenameDimension}
                  />
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={readingMap.get(dim.id) ?? 0}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      if (!isNaN(n) && n >= 0 && n <= 100) handleChange(dim.id, n);
                    }}
                    disabled={disabled}
                    aria-label={`${dim.name} valor numérico`}
                    className="w-16 h-8 text-center text-sm border border-terra-200 rounded-md tabular-nums disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:border-terra-700 focus:ring-1 focus:ring-terra-700/20"
                  />
                </div>
                {/* Slider only — label and input hidden, handled above */}
                <EnergySlider
                  label={dim.name}
                  showLabel={false}
                  showInput={false}
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
              className={`text-xs ${mfBalanced ? 'text-terra-400' : 'text-amber-600'}`}
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
                  className="w-full bg-[#FAF7F5] border-b border-[#D4A592] rounded-none px-2 py-1.5 text-sm text-[#2C2220] placeholder:text-terra-200 focus:outline-none focus:border-[#C4704A] disabled:opacity-50 transition-colors"
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

    </section>
  );
}

export default StepEnergyInitial;
