'use client';

import { ChevronDown, Trash2 } from 'lucide-react';
import { SearchableCombobox } from './SearchableCombobox';
import {
  TRABAJO_OPTIONS,
  MATERIALS_OPTIONS,
  ORIGIN_OPTIONS,
} from '@/lib/data/cleaning-catalogs';
import type { ManifestationEntry } from './types';

// ─── Shared styles ───────────────────────────────────────────────────────────

const LABEL_CLASS = 'text-xs font-normal uppercase tracking-[0.1em] text-[#4A3628]';
const LABEL_STYLE = { fontFamily: 'Lato, sans-serif' } as const;

// ─── Props ───────────────────────────────────────────────────────────────────

export interface ManifestationAccordionProps {
  entry: ManifestationEntry;
  index: number;
  onChange: (updates: Partial<ManifestationEntry>) => void;
  onDelete: () => void;
  disabled?: boolean;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ManifestationAccordion({
  entry,
  index,
  onChange,
  onDelete,
  disabled = false,
}: ManifestationAccordionProps) {
  const unitLabel = entry.unit === 'porcentaje' ? '%' : '#';

  function toggleUnit() {
    onChange({ unit: entry.unit === 'numero' ? 'porcentaje' : 'numero' });
  }

  return (
    <div className="rounded-lg border border-[#EDE5E0] bg-terra-50">
      {/* ── Header (always visible) ── */}
      <button
        type="button"
        onClick={() => onChange({ expanded: !entry.expanded })}
        className="flex w-full items-center gap-2 rounded-t-lg px-3 py-2.5 text-left hover:bg-[#F2E8E4] transition-colors"
        style={{ minHeight: 44 }}
      >
        <ChevronDown
          size={14}
          className={`shrink-0 text-terra-400 transition-transform ${entry.expanded ? '' : '-rotate-90'}`}
        />

        <span className="flex-1 text-sm text-[#2C2220] font-medium truncate">
          <span className="text-terra-400 mr-1">{index + 1}.</span>
          {entry.name || 'Sin nombre'}
          <span className="ml-2 text-terra-400">
            — {entry.value} — {entry.unit === 'porcentaje' ? 'Porcentaje' : 'Número'}
          </span>
        </span>

        {entry.is_auto_injected && (
          <span className="shrink-0 rounded bg-[#C4704A] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
            AUTO
          </span>
        )}

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          disabled={disabled}
          aria-label={`Eliminar manifestación ${index + 1}`}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded text-terra-400 hover:bg-red-50 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:cursor-not-allowed disabled:opacity-40 transition-colors"
        >
          <Trash2 size={14} strokeWidth={1.5} />
        </button>
      </button>

      {/* ── Expanded content ── */}
      {entry.expanded && (
        <div className="border-t border-[#EDE5E0] px-3 py-3 space-y-3">
          {/* Row: Value + Unit toggle */}
          <div className="flex items-end gap-2">
            <div className="w-28">
              <label className={`${LABEL_CLASS} mb-1 block`} style={LABEL_STYLE}>
                Valor
              </label>
              <input
                type="number"
                min={0}
                step="any"
                value={entry.value}
                disabled={disabled}
                onChange={(e) =>
                  onChange({ value: parseFloat(e.target.value) || 0 })
                }
                className="h-11 w-full rounded-none border-0 border-b border-[#D4A592] bg-[#FAF7F5] px-3 text-sm text-[#2C2220] focus:outline-none focus:ring-0 focus:border-b-2 focus:border-[#C4704A] disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>
            <button
              type="button"
              disabled={disabled}
              onClick={toggleUnit}
              className="h-11 w-11 rounded border border-[#D4A592] bg-[#FAF7F5] text-sm font-medium text-[#4A3628] hover:bg-terra-100 focus:outline-none focus:ring-0 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title={entry.unit === 'porcentaje' ? 'Porcentaje' : 'Número'}
            >
              {unitLabel}
            </button>
          </div>

          {/* Trabajo realizado */}
          <div>
            <label className={`${LABEL_CLASS} mb-1 block`} style={LABEL_STYLE}>
              Trabajo realizado
            </label>
            <SearchableCombobox
              options={TRABAJO_OPTIONS}
              value={entry.work_done}
              onChange={(val) => onChange({ work_done: val as string[] })}
              multiple
              placeholder="— Trabajo —"
              disabled={disabled}
            />
            {entry.work_done.includes('Otro') && (
              <input
                type="text"
                value={entry.work_done_custom ?? ''}
                disabled={disabled}
                onChange={(e) => onChange({ work_done_custom: e.target.value })}
                placeholder="Especificar trabajo..."
                className="mt-2 h-11 w-full rounded-none border-0 border-b border-[#D4A592] bg-[#FAF7F5] px-3 text-sm text-[#2C2220] placeholder-[#A9967E] focus:outline-none focus:ring-0 focus:border-b-2 focus:border-[#C4704A] disabled:opacity-50 disabled:cursor-not-allowed"
              />
            )}
          </div>

          {/* Materiales */}
          <div>
            <label className={`${LABEL_CLASS} mb-1 block`} style={LABEL_STYLE}>
              Materiales
            </label>
            <SearchableCombobox
              options={MATERIALS_OPTIONS}
              value={entry.materials}
              onChange={(val) => onChange({ materials: val as string[] })}
              multiple
              placeholder="— Materiales —"
              disabled={disabled}
            />
          </div>

          {/* Origen(es) */}
          <div>
            <label className={`${LABEL_CLASS} mb-1 block`} style={LABEL_STYLE}>
              Origen(es)
            </label>
            <SearchableCombobox
              options={ORIGIN_OPTIONS}
              value={entry.origins}
              onChange={(val) => onChange({ origins: val as string[] })}
              multiple
              placeholder="— Origen —"
              disabled={disabled}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default ManifestationAccordion;
