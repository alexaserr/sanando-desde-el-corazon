'use client';

import { useId } from 'react';
import { EnergySlider } from '../EnergySlider';
import type { LntEntry } from './types';

// ─── Campos de sanación ───────────────────────────────────────────────────────

const HEALING_FIELDS = [
  { key: 'healing_physical_body',  label: 'Cuerpo físico' },
  { key: 'healing_energy_body',    label: 'Cuerpo energético' },
  { key: 'healing_spiritual_body', label: 'Cuerpo espiritual' },
] as const;

// ─── Props ────────────────────────────────────────────────────────────────────

export interface StepLNTProps {
  entries: LntEntry[];
  onChange: (entries: LntEntry[]) => void;
  peticiones: string;
  onPeticionesChange: (val: string) => void;
  disabled?: boolean;
}

// ─── Tarjeta de un tema LNT ───────────────────────────────────────────────────

interface LntCardProps {
  entry: LntEntry;
  index: number;
  onChange: (updates: Partial<LntEntry>) => void;
  onDelete: () => void;
  disabled?: boolean;
}

function LntCard({ entry, index, onChange, onDelete, disabled = false }: LntCardProps) {
  const nameId = useId();

  function handleCheckbox(
    key: 'healing_physical_body' | 'healing_energy_body' | 'healing_spiritual_body',
    val: boolean,
  ) {
    const update: Partial<LntEntry> = {};
    update[key] = val;
    onChange(update);
  }

  return (
    <article className="bg-terra-50 rounded-lg shadow-[0_2px_8px_rgba(44,34,32,0.06)] overflow-hidden">
      {/* Cabecera */}
      <div className="flex items-center justify-between px-4 py-3 bg-terra-50 border-b border-terra-100">
        <span className="text-sm font-semibold text-terra-700">
          Tema {index + 1}
        </span>
        <button
          type="button"
          onClick={onDelete}
          disabled={disabled}
          aria-label={`Eliminar tema ${index + 1}`}
          title="Eliminar tema"
          className="p-1.5 rounded text-terra-400 hover:text-red-600 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          style={{ minWidth: 44, minHeight: 44 }}
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
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
            />
          </svg>
        </button>
      </div>

      {/* Cuerpo */}
      <div className="p-4 space-y-5">
        {/* Nombre del tema */}
        <div className="flex flex-col gap-1">
          <label htmlFor={nameId} className="text-xs uppercase tracking-wide font-normal text-[#4A3628]">
            Tema trabajado
          </label>
          <input
            id={nameId}
            type="text"
            value={entry.theme_organ}
            disabled={disabled}
            onChange={(e) => onChange({ theme_organ: e.target.value })}
            placeholder="Ej: Miedo al abandono"
            className="w-full rounded-none border-0 border-b border-[#D4A592] bg-[#FAF7F5] px-3 py-2 text-sm focus:outline-none focus:ring-0 focus:border-b-2 focus:border-[#C4704A] disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>

        {/* Sliders N.E. Inicial / Final */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <EnergySlider
            label="N.E. Inicial"
            value={entry.initial_energy}
            onChange={(v) => onChange({ initial_energy: v })}
            phase="initial"
            max={14}
            disabled={disabled}
          />
          <EnergySlider
            label="N.E. Final"
            value={entry.final_energy}
            compareValue={entry.initial_energy}
            onChange={(v) => onChange({ final_energy: v })}
            phase="final"
            max={14}
            disabled={disabled}
          />
        </div>

        {/* Checkboxes de sanación */}
        <div
          role="group"
          aria-label={`Sanación — Tema ${index + 1}`}
          className="flex flex-wrap gap-x-6 gap-y-2"
        >
          {HEALING_FIELDS.map(({ key, label }) => (
            <label
              key={key}
              className="flex items-center gap-2 text-sm cursor-pointer select-none"
              style={{ minHeight: 44 }}
            >
              <input
                type="checkbox"
                checked={entry[key]}
                disabled={disabled}
                onChange={(e) => handleCheckbox(key, e.target.checked)}
                className="w-4 h-4 cursor-pointer disabled:cursor-not-allowed"
                style={{ accentColor: '#C4704A' }}
              />
              {label}
            </label>
          ))}
        </div>
      </div>
    </article>
  );
}

// ─── StepLNT ──────────────────────────────────────────────────────────────────

export function StepLNT({
  entries,
  onChange,
  peticiones,
  onPeticionesChange,
  disabled = false,
}: StepLNTProps) {
  const peticionesId = useId();

  function addEntry() {
    onChange([
      ...entries,
      {
        _localId: crypto.randomUUID(),
        theme_organ: '',
        initial_energy: 7,
        final_energy: 7,
        healing_energy_body: false,
        healing_spiritual_body: false,
        healing_physical_body: false,
      },
    ]);
  }

  function removeEntry(localId: string) {
    onChange(entries.filter((e) => e._localId !== localId));
  }

  function updateEntry(localId: string, updates: Partial<LntEntry>) {
    onChange(entries.map((e) => (e._localId === localId ? { ...e, ...updates } : e)));
  }

  return (
    <section aria-labelledby="step-lnt-heading" className="space-y-6">
      {/* Cabecera */}
      <div>
        <h2
          id="step-lnt-heading"
          className="text-base font-semibold text-[#2C2220]"
          style={{ fontFamily: 'Playfair Display, serif' }}
        >
          Temas LNT
        </h2>
        <p className="text-sm text-terra-500 mt-0.5">
          Registra los temas trabajados durante la sesión LNT.
        </p>
      </div>

      {/* Botón agregar */}
      <button
        type="button"
        onClick={addEntry}
        disabled={disabled || entries.length >= 10}
        className="inline-flex items-center gap-1.5 rounded-md bg-terra-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-terra-800 focus:outline-none focus:ring-2 focus:ring-terra-700 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        style={{ minHeight: 44 }}
      >
        <svg
          aria-hidden="true"
          className="w-4 h-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
        Agregar tema
      </button>

      {/* Lista de temas */}
      {entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center text-sm text-terra-400">
          No hay temas. Usa el botón de arriba para agregar uno.
        </div>
      ) : (
        <div className="space-y-4">
          {entries.map((entry, index) => (
            <LntCard
              key={entry._localId}
              entry={entry}
              index={index}
              onChange={(updates) => updateEntry(entry._localId, updates)}
              onDelete={() => removeEntry(entry._localId)}
              disabled={disabled}
            />
          ))}
        </div>
      )}

      {/* Peticiones */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor={peticionesId} className="text-xs uppercase tracking-wide font-normal text-[#4A3628]">
          Peticiones
        </label>
        <textarea
          id={peticionesId}
          rows={4}
          value={peticiones}
          disabled={disabled}
          onChange={(e) => onPeticionesChange(e.target.value)}
          placeholder="Intenciones y peticiones de la sesión…"
          className="w-full rounded-none border-0 border-b border-[#D4A592] bg-[#FAF7F5] px-3 py-2 text-sm focus:outline-none focus:ring-0 focus:border-b-2 focus:border-[#C4704A] disabled:opacity-50 disabled:cursor-not-allowed resize-y"
        />
      </div>
    </section>
  );
}

export default StepLNT;
