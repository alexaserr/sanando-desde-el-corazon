'use client';

import { useState, useId, useRef, useEffect } from 'react';
import { BlockageRow } from './BlockageRow';
import { AgesSection } from './AgesSection';
import { EnergySlider } from '../EnergySlider';
import EmotionSelector from '../EmotionSelector';
import type { ThemeEntry, BlockageData } from './types';
import type { ChakraPosition } from '@/types/api';

export interface ThemeCardProps {
  theme: ThemeEntry;
  index: number;
  chakras: ChakraPosition[];
  onChange: (updates: Partial<ThemeEntry>) => void;
  onDelete?: () => void;
  disabled?: boolean;
  /** Si es true, la tarjeta se desplaza automáticamente al viewport al montar. */
  isNew?: boolean;
}

const EMPTY_BLOCKAGE: BlockageData = {
  chakra_position_id: '',
  organ_name: '',
  energy: 0,
};

export function ThemeCard({ theme, index, chakras, onChange, onDelete, disabled = false, isNew = false }: ThemeCardProps) {
  const [expanded, setExpanded]           = useState(true);
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput]         = useState(theme.name);
  const [blockageCount, setBlockageCount] = useState<1 | 2 | 3>(1);
  const nameInputRef                      = useRef<HTMLInputElement>(null);
  const articleRef                        = useRef<HTMLElement>(null);
  const headingId      = useId();
  const secondaryTogId = useId();

  // Desplazar al viewport cuando la tarjeta es recién añadida
  useEffect(() => {
    if (isNew) {
      articleRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
    // Solo ejecutar al montar — isNew no cambia después del primer render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function updateBlockage(slot: 0 | 1 | 2, val: BlockageData) {
    const next: [BlockageData, BlockageData, BlockageData] = [...theme.blockages] as [BlockageData, BlockageData, BlockageData];
    next[slot] = val;
    onChange({ blockages: next });
  }

  function startEditingName() {
    if (disabled) return;
    setNameInput(theme.name);
    setIsEditingName(true);
    setTimeout(() => nameInputRef.current?.focus(), 0);
  }

  function commitNameEdit() {
    const trimmed = nameInput.trim();
    if (trimmed && trimmed !== theme.name) {
      onChange({ name: trimmed });
    }
    setIsEditingName(false);
  }

  const progressPct = Math.round(theme.progress_pct);

  return (
    <article
      ref={articleRef}
      aria-labelledby={headingId}
      className="bg-white rounded-lg shadow-[0_2px_8px_rgba(44,34,32,0.06)] overflow-hidden"
    >
      {/* ── Cabecera colapsable ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-4 py-3 bg-terra-50 border-b border-gray-100">
        {/* Título / editor inline */}
        <div className="flex-1 min-w-0">
          {isEditingName ? (
            <input
              ref={nameInputRef}
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onBlur={commitNameEdit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); commitNameEdit(); }
                if (e.key === 'Escape') { setIsEditingName(false); }
              }}
              aria-label="Nombre del tema"
              className="w-full rounded border border-terra-300 bg-white px-2 py-0.5 text-sm font-semibold text-terra-700 focus:outline-none focus:ring-1 focus:ring-terra-700"
            />
          ) : (
            <button
              type="button"
              id={headingId}
              onClick={startEditingName}
              disabled={disabled}
              title="Clic para editar nombre"
              className="flex items-center gap-1 text-left w-full text-sm font-semibold text-terra-700 truncate hover:underline focus:outline-none focus:ring-1 focus:ring-terra-700 rounded disabled:cursor-default disabled:no-underline"
            >
              <span className="truncate">
                Tema {index + 1}{theme.name ? `: ${theme.name}` : ''}
              </span>
              {!disabled && (
                <svg
                  aria-hidden="true"
                  className="w-3.5 h-3.5 shrink-0 text-terra-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 13l6.364-6.364a2 2 0 012.828 2.828L11.828 15.828a2 2 0 01-1.414.586H9v-2.414a2 2 0 01.586-1.414z" />
                </svg>
              )}
            </button>
          )}
        </div>

        {/* Badge progreso */}
        <span
          aria-label={`Progreso ${progressPct}%`}
          className="shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-terra-100 text-terra-700"
        >
          {progressPct}%
        </span>

        {/* Botón eliminar */}
        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            disabled={disabled}
            aria-label={`Eliminar tema ${index + 1}`}
            title="Eliminar tema"
            className="shrink-0 p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        )}

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

          {/* Bloqueos + Resultante */}
          <section aria-label="Bloqueos y resultante" className="space-y-3">
            {/* Selector de cantidad de bloqueos */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-gray-600 select-none">Bloqueos:</span>
              {([1, 2, 3] as const).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setBlockageCount(n)}
                  disabled={disabled}
                  aria-pressed={blockageCount === n}
                  className={`w-8 h-7 rounded-full text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-terra-700 disabled:cursor-not-allowed ${
                    blockageCount === n
                      ? 'bg-terra-700 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>

            {/* Solo renderizar los bloqueos activos (datos se conservan al reducir) */}
            {([0, 1, 2] as const).map((slot) =>
              slot < blockageCount ? (
                <BlockageRow
                  key={slot}
                  label={`Bloqueo ${slot + 1}`}
                  chakras={chakras}
                  value={theme.blockages[slot] ?? EMPTY_BLOCKAGE}
                  onChange={(v) => updateBlockage(slot, v)}
                  disabled={disabled}
                />
              ) : null,
            )}

            <BlockageRow
              label="Resultante"
              chakras={chakras}
              value={theme.resultant}
              onChange={(v) => onChange({ resultant: v })}
              disabled={disabled}
            />
          </section>

          {/* Interpretación general del tema */}
          <div className="flex flex-col gap-1">
            <label
              className="text-xs font-normal text-[#4A3628] uppercase tracking-wide select-none"
              style={{ fontFamily: 'Lato, sans-serif', letterSpacing: '0.1em' }}
            >
              Interpretación del tema
            </label>
            <textarea
              value={theme.interpretacion_tema ?? ''}
              onChange={(e) => onChange({ interpretacion_tema: e.target.value })}
              placeholder="Interpretación general del tema…"
              disabled={disabled}
              rows={3}
              className="w-full rounded-none border-0 border-b border-[#D4A592] bg-[#FAF7F5] px-3 py-2 text-sm text-[#2C2220] placeholder-[#A9967E] focus:outline-none focus:ring-0 focus:border-b-2 focus:border-[#C4704A] disabled:opacity-50 disabled:cursor-not-allowed resize-y"
              style={{ fontFamily: 'Lato, sans-serif' }}
            />
          </div>

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
              className="text-xs uppercase tracking-wide font-normal text-[#4A3628] cursor-pointer select-none"
            >
              Tema secundario
            </label>
          </div>

          {/* Nombre + sliders energía ini/fin del tema secundario */}
          {theme.is_secondary && (
            <div className="pl-7 space-y-4">
              {/* Nombre del tema secundario */}
              <div className="flex flex-col gap-1">
                <label
                  className="text-xs font-normal text-[#4A3628] uppercase tracking-wide select-none"
                  style={{ fontFamily: 'Lato, sans-serif' }}
                >
                  Nombre del tema secundario
                </label>
                <input
                  type="text"
                  value={theme.secondary_name ?? ''}
                  disabled={disabled}
                  onChange={(e) => onChange({ secondary_name: e.target.value })}
                  placeholder="Ej. Miedo al rechazo"
                  className="w-full rounded-none border-0 border-b border-[#D4A592] bg-[#FAF7F5] px-3 py-2 text-sm text-[#2C2220] placeholder-[#A9967E] focus:outline-none focus:ring-0 focus:border-b-2 focus:border-[#C4704A] disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ fontFamily: 'Lato, sans-serif' }}
                />
              </div>
            </div>
          )}
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

          {/* Emociones predominantes */}
          <div className="flex flex-col gap-1.5">
            <p
              className="text-xs font-normal text-[#4A3628] uppercase tracking-wide select-none"
              style={{ fontFamily: 'Lato, sans-serif' }}
            >
              Emociones predominantes
            </p>
            <EmotionSelector
              selected={theme.emotions ?? []}
              onChange={(emotions) => onChange({ emotions })}
              disabled={disabled}
            />
          </div>

          <hr className="border-gray-100" />

          {/* Edades Infancia / Adultez */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label
                className="text-xs font-normal text-[#4A3628] uppercase tracking-wide select-none"
                style={{ fontFamily: 'Lato, sans-serif', letterSpacing: '0.1em' }}
              >
                Edad Infancia
              </label>
              <input
                type="number"
                step="any"
                min={0}
                value={theme.childhood_age ?? ''}
                onChange={(e) => {
                  const raw = e.target.value;
                  onChange({ childhood_age: raw === '' ? null : Number(raw) });
                }}
                placeholder="Ej: 3.5"
                disabled={disabled}
                className="w-full rounded-none border-0 border-b border-[#D4A592] bg-[#FAF7F5] px-3 py-2 text-sm text-[#2C2220] placeholder-[#A9967E] focus:outline-none focus:ring-0 focus:border-b-2 focus:border-[#C4704A] disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ fontFamily: 'Lato, sans-serif' }}
              />
              {theme.childhood_age != null && theme.childhood_age > 9 && (
                <span className="text-xs text-red-600">La edad de infancia debe ser ≤ 9</span>
              )}
            </div>
            <div className="flex flex-col gap-1">
              <label
                className="text-xs font-normal text-[#4A3628] uppercase tracking-wide select-none"
                style={{ fontFamily: 'Lato, sans-serif', letterSpacing: '0.1em' }}
              >
                Edad Adultez
              </label>
              <input
                type="number"
                step="any"
                min={0}
                value={theme.adulthood_age ?? ''}
                onChange={(e) => {
                  const raw = e.target.value;
                  onChange({ adulthood_age: raw === '' ? null : Number(raw) });
                }}
                placeholder="Ej: 27"
                disabled={disabled}
                className="w-full rounded-none border-0 border-b border-[#D4A592] bg-[#FAF7F5] px-3 py-2 text-sm text-[#2C2220] placeholder-[#A9967E] focus:outline-none focus:ring-0 focus:border-b-2 focus:border-[#C4704A] disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ fontFamily: 'Lato, sans-serif' }}
              />
            </div>
          </div>

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
