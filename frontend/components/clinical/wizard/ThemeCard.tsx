'use client';

import { useState, useId } from 'react';
import { BlockageRow } from './BlockageRow';
import { AgesSection } from './AgesSection';
import { EnergySlider } from '../EnergySlider';
import type { ThemeEntry, BlockageData } from './types';
import type { ChakraPosition } from '@/types/api';

export interface ThemeCardProps {
  theme: ThemeEntry;
  index: number;
  chakras: ChakraPosition[];
  onChange: (updates: Partial<ThemeEntry>) => void;
  disabled?: boolean;
}

const EMPTY_BLOCKAGE: BlockageData = {
  chakra_position_id: '',
  organ_name: '',
  energy: 50,
};

export function ThemeCard({ theme, index, chakras, onChange, disabled = false }: ThemeCardProps) {
  const [expanded, setExpanded] = useState(true);
  const headingId      = useId();
  const secondaryTogId = useId();

  function updateBlockage(slot: 0 | 1 | 2, val: BlockageData) {
    const next: [BlockageData, BlockageData, BlockageData] = [...theme.blockages] as [BlockageData, BlockageData, BlockageData];
    next[slot] = val;
    onChange({ blockages: next });
  }

  const progressPct = Math.round(theme.progress_pct);

  return (
    <article
      aria-labelledby={headingId}
      className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden"
    >
      {/* ── Cabecera colapsable ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 py-3 bg-terra-50 border-b border-gray-100">
        <div className="flex-1 min-w-0">
          <h3 id={headingId} className="text-sm font-semibold text-terra-700 truncate">
            Tema {index + 1}{theme.name ? `: ${theme.name}` : ''}
          </h3>
        </div>

        {/* Badge progreso */}
        <span
          aria-label={`Progreso ${progressPct}%`}
          className="shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-terra-100 text-terra-700"
        >
          {progressPct}%
        </span>

        {/* Botón expandir/colapsar */}
        <button
          type="button"
          onClick={() => setExpanded((p) => !p)}
          aria-expanded={expanded}
          aria-controls={`theme-body-${theme._localId}`}
          className="shrink-0 p-1.5 rounded text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-terra-700 transition-colors"
          style={{ minWidth: 44, minHeight: 44 }}
        >
          <svg
            aria-hidden="true"
            className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
          <span className="sr-only">{expanded ? 'Colapsar' : 'Expandir'}</span>
        </button>
      </div>

      {/* ── Cuerpo colapsable ───────────────────────────────────────────────── */}
      {expanded && (
        <div id={`theme-body-${theme._localId}`} className="p-4 space-y-6">

          {/* 4 filas de bloqueos */}
          <section aria-label="Bloqueos y resultante" className="space-y-5">
            <BlockageRow
              label="Bloqueo 1"
              chakras={chakras}
              value={theme.blockages[0] ?? EMPTY_BLOCKAGE}
              onChange={(v) => updateBlockage(0, v)}
              disabled={disabled}
            />
            <BlockageRow
              label="Bloqueo 2"
              chakras={chakras}
              value={theme.blockages[1] ?? EMPTY_BLOCKAGE}
              onChange={(v) => updateBlockage(1, v)}
              disabled={disabled}
            />
            <BlockageRow
              label="Bloqueo 3"
              chakras={chakras}
              value={theme.blockages[2] ?? EMPTY_BLOCKAGE}
              onChange={(v) => updateBlockage(2, v)}
              disabled={disabled}
            />
            <BlockageRow
              label="Resultante"
              chakras={chakras}
              value={theme.resultant}
              onChange={(v) => onChange({ resultant: v })}
              disabled={disabled}
            />
          </section>

          <hr className="border-gray-100" />

          {/* Toggle tema secundario */}
          <div className="flex items-center gap-3">
            <input
              id={secondaryTogId}
              type="checkbox"
              checked={theme.is_secondary}
              disabled={disabled}
              onChange={(e) => onChange({ is_secondary: e.target.checked })}
              className="w-4 h-4 accent-terra-700 cursor-pointer disabled:cursor-not-allowed"
            />
            <label
              htmlFor={secondaryTogId}
              className="text-sm font-medium text-gray-700 cursor-pointer select-none"
            >
              Tema secundario
            </label>
          </div>

          {/* Sliders energía ini/fin del tema secundario */}
          {theme.is_secondary && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-7">
              <EnergySlider
                label="Energía inicial (secundario)"
                value={theme.secondary_energy_initial}
                onChange={(v) => onChange({ secondary_energy_initial: v })}
                phase="initial"
                max={100}
                disabled={disabled}
              />
              <EnergySlider
                label="Energía final (secundario)"
                value={theme.secondary_energy_final}
                compareValue={theme.secondary_energy_initial}
                onChange={(v) => onChange({ secondary_energy_final: v })}
                phase="final"
                max={100}
                disabled={disabled}
              />
            </div>
          )}

          <hr className="border-gray-100" />

          {/* Secciones etarias */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <AgesSection
              label="Infancia"
              value={theme.childhood}
              onChange={(v) => onChange({ childhood: v })}
              disabled={disabled}
            />
            <AgesSection
              label="Adultez"
              value={theme.adulthood}
              onChange={(v) => onChange({ adulthood: v })}
              disabled={disabled}
            />
          </div>

          <hr className="border-gray-100" />

          {/* Progreso del tema */}
          <EnergySlider
            label={`Progreso del tema ${index + 1}`}
            value={theme.progress_pct}
            onChange={(v) => onChange({ progress_pct: v })}
            phase="final"
            max={100}
            disabled={disabled}
          />
        </div>
      )}
    </article>
  );
}

export default ThemeCard;
