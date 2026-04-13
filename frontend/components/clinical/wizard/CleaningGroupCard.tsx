'use client';

import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { LayerChips } from './LayerChips';
import { ManifestationAccordion } from './ManifestationAccordion';
import {
  MANIFESTATION_OPTIONS,
  MESA_OPTIONS,
} from '@/lib/data/cleaning-catalogs';
import type { CleaningGroup, ManifestationEntry, LayerEntry } from './types';

// ─── Shared styles ───────────────────────────────────────────────────────────

const LABEL_CLASS = 'text-xs font-normal uppercase tracking-[0.1em] text-[#4A3628]';
const LABEL_STYLE = { fontFamily: 'Lato, sans-serif' } as const;
const INPUT_CLASS =
  'h-11 w-full rounded-none border-0 border-b border-[#D4A592] bg-[#FAF7F5] px-3 text-sm text-[#2C2220] focus:outline-none focus:ring-0 focus:border-b-2 focus:border-[#C4704A] disabled:opacity-50 disabled:cursor-not-allowed';

const TARGET_TYPE_LABELS: Record<string, string> = {
  familiar: 'Familiar',
  casa: 'Casa',
  otro: 'Otro',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function newManifestation(name: string, isAutoInjected = false): ManifestationEntry {
  return {
    id: crypto.randomUUID(),
    name,
    value: 0,
    unit: 'numero',
    work_done: [],
    materials: [],
    origins: [],
    is_auto_injected: isAutoInjected,
    expanded: false,
  };
}

// ─── Props ───────────────────────────────────────────────────────────────────

export interface CleaningGroupCardProps {
  group: CleaningGroup;
  index: number;
  isPatientGroup: boolean;
  disabled: boolean;
  onUpdate: (patch: Partial<CleaningGroup>) => void;
  onDelete: () => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function CleaningGroupCard({
  group,
  index,
  isPatientGroup,
  disabled,
  onUpdate,
  onDelete,
}: CleaningGroupCardProps) {
  const [addManifName, setAddManifName] = useState('');

  const hasSinCapas = group.layers.some((l) => l.type === 'sin_capas');
  const totalCapas = group.layers
    .filter((l) => l.type !== 'sin_capas')
    .reduce((sum, l) => sum + l.quantity, 0);

  // ── Event helpers ──

  function updateManifestation(id: string, updates: Partial<ManifestationEntry>) {
    onUpdate({
      events: group.events.map((ev) =>
        ev.id === id ? { ...ev, ...updates } : ev,
      ),
    });
  }

  function deleteManifestation(id: string) {
    onUpdate({ events: group.events.filter((ev) => ev.id !== id) });
  }

  function addManifestation() {
    const name = addManifName || MANIFESTATION_OPTIONS[0];
    onUpdate({ events: [...group.events, newManifestation(name)] });
    setAddManifName('');
  }

  // ── Mesa helpers ──

  function toggleMesa(mesa: string) {
    const next = group.mesa_utilizada.includes(mesa)
      ? group.mesa_utilizada.filter((x) => x !== mesa)
      : [...group.mesa_utilizada, mesa];
    onUpdate({ mesa_utilizada: next });
  }

  return (
    <div
      className="rounded-lg p-5 space-y-6"
      style={{
        background: '#FAF7F5',
        boxShadow: '0 2px 8px rgba(44,34,32,0.06)',
      }}
    >
      {/* ── Header ── */}
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 space-y-3">
            {isPatientGroup ? (
              <h3
                className="text-base font-bold text-terra-900"
                style={LABEL_STYLE}
              >
                Limpieza de: {group.target_name}
              </h3>
            ) : (
              <div className="space-y-3">
                <p className={LABEL_CLASS} style={LABEL_STYLE}>
                  Limpieza #{index + 1}
                </p>

                {/* Tipo de target */}
                <div>
                  <p className={`${LABEL_CLASS} mb-2`} style={LABEL_STYLE}>Tipo</p>
                  <div className="flex flex-wrap gap-4">
                    {(['familiar', 'casa', 'otro'] as const).map((t) => (
                      <label
                        key={t}
                        className="flex items-center gap-2 text-sm text-[#2C2220] cursor-pointer select-none"
                      >
                        <input
                          type="radio"
                          name={`target-type-${group.id}`}
                          checked={group.target_type === t}
                          disabled={disabled}
                          onChange={() => onUpdate({ target_type: t })}
                          style={{ accentColor: '#C4704A' }}
                          className="h-4 w-4"
                        />
                        {TARGET_TYPE_LABELS[t]}
                      </label>
                    ))}
                  </div>
                </div>

                {/* Nombre */}
                <div>
                  <label className={`${LABEL_CLASS} mb-1 block`} style={LABEL_STYLE}>
                    Nombre
                  </label>
                  <input
                    type="text"
                    value={group.target_name}
                    disabled={disabled}
                    onChange={(e) => onUpdate({ target_name: e.target.value })}
                    placeholder="Nombre de la persona o lugar..."
                    className={INPUT_CLASS}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Limpiezas requeridas + Cobrar */}
        <div className="flex flex-wrap items-end gap-4">
          <div className="w-48">
            <label className={`${LABEL_CLASS} mb-1 block`} style={LABEL_STYLE}>
              Limpiezas requeridas
            </label>
            <input
              type="number"
              min={0}
              value={group.cleanings_required}
              disabled={disabled}
              onChange={(e) =>
                onUpdate({ cleanings_required: Math.max(0, parseInt(e.target.value, 10) || 0) })
              }
              className={INPUT_CLASS}
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-[#2C2220] cursor-pointer select-none min-h-[44px]">
            <input
              type="checkbox"
              checked={group.is_charged}
              disabled={disabled}
              onChange={(e) => onUpdate({ is_charged: e.target.checked })}
              className="h-4 w-4 cursor-pointer disabled:cursor-not-allowed"
              style={{ accentColor: '#C4704A' }}
            />
            Cobrar esta limpieza
          </label>

          {group.is_charged && (
            <div className="w-40">
              <label className={`${LABEL_CLASS} mb-1 block`} style={LABEL_STYLE}>
                Costo por limpieza
              </label>
              <input
                type="number"
                min={0}
                step="any"
                value={group.cost_per_cleaning}
                disabled={disabled}
                onChange={(e) =>
                  onUpdate({ cost_per_cleaning: Math.max(0, parseFloat(e.target.value) || 0) })
                }
                className={INPUT_CLASS}
              />
            </div>
          )}
        </div>
      </div>

      {/* ── Capas (LayerChips) ── */}
      <section aria-label={`Capas grupo ${index + 1}`}>
        <p className={`${LABEL_CLASS} mb-3`} style={LABEL_STYLE}>
          Capas
        </p>
        <LayerChips
          layers={group.layers}
          onChange={(layers: LayerEntry[]) => onUpdate({ layers })}
          disabled={disabled}
        />
        {totalCapas > 0 && (
          <p className="mt-2 text-xs text-[#854F0B]">
            Total capas: {totalCapas}
          </p>
        )}
      </section>

      {/* ── Manifestaciones ── */}
      <section
        aria-label={`Manifestaciones grupo ${index + 1}`}
        className={hasSinCapas ? 'opacity-40 pointer-events-none' : ''}
      >
        <p className={`${LABEL_CLASS} mb-3`} style={LABEL_STYLE}>
          Manifestaciones
        </p>

        <div className="space-y-2">
          {group.events.length === 0 && (
            <p className="rounded-lg border border-dashed border-terra-100 bg-terra-50/60 px-4 py-6 text-center text-sm text-terra-400">
              Sin manifestaciones. Agrega una para empezar.
            </p>
          )}

          {group.events.map((ev, evIdx) => (
            <ManifestationAccordion
              key={ev.id}
              entry={ev}
              index={evIdx}
              onChange={(updates) => updateManifestation(ev.id, updates)}
              onDelete={() => deleteManifestation(ev.id)}
              disabled={disabled || hasSinCapas}
            />
          ))}
        </div>

        {/* Add manifestation */}
        <div className="mt-3 flex items-center gap-2">
          <select
            value={addManifName}
            disabled={disabled || hasSinCapas}
            onChange={(e) => setAddManifName(e.target.value)}
            className="h-11 flex-1 rounded-none border-0 border-b border-[#D4A592] bg-[#FAF7F5] px-2.5 text-sm text-[#2C2220] focus:outline-none focus:ring-0 focus:border-b-2 focus:border-[#C4704A] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <option value="">— Manifestación —</option>
            {MANIFESTATION_OPTIONS.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>

          <button
            type="button"
            onClick={addManifestation}
            disabled={disabled || hasSinCapas}
            className="flex items-center gap-1.5 rounded-lg border border-dashed border-[#C4704A] px-4 py-2.5 text-sm font-medium text-[#C4704A] hover:border-terra-500 hover:bg-[#FDF8F6] focus:outline-none focus:ring-2 focus:ring-terra-700 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
            style={{ minHeight: 44 }}
          >
            <Plus size={15} />
            Agregar
          </button>
        </div>
      </section>

      {/* ── Mesa utilizada ── */}
      <section aria-label={`Mesa utilizada grupo ${index + 1}`}>
        <p className={`${LABEL_CLASS} mb-3`} style={LABEL_STYLE}>
          Mesa utilizada
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-y-2 gap-x-4">
          {MESA_OPTIONS.map((mesa) => (
            <label
              key={mesa}
              className="flex cursor-pointer items-center gap-2 text-sm text-[#2C2220] select-none"
              style={{ minHeight: 44 }}
            >
              <input
                type="checkbox"
                checked={group.mesa_utilizada.includes(mesa)}
                disabled={disabled}
                onChange={() => toggleMesa(mesa)}
                className="h-4 w-4 cursor-pointer disabled:cursor-not-allowed"
                style={{ accentColor: '#C4704A' }}
              />
              {mesa}
            </label>
          ))}
        </div>
      </section>

      {/* ── Beneficios ── */}
      <section aria-label={`Beneficios grupo ${index + 1}`}>
        <label className={`${LABEL_CLASS} mb-2 block`} style={LABEL_STYLE}>
          Beneficios al cliente
        </label>
        <textarea
          rows={3}
          value={group.beneficios}
          disabled={disabled}
          onChange={(e) => onUpdate({ beneficios: e.target.value })}
          placeholder="Describe los beneficios obtenidos..."
          className="w-full rounded-none border-0 border-b border-[#D4A592] bg-terra-50 px-3 py-2 text-sm text-[#2C2220] placeholder-[#A9967E] focus:outline-none focus:ring-0 focus:border-b-2 focus:border-[#C4704A] disabled:opacity-50 disabled:cursor-not-allowed resize-none"
          style={LABEL_STYLE}
        />
      </section>

      {/* ── Eliminar grupo (solo adicionales) ── */}
      {!isPatientGroup && (
        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={onDelete}
            disabled={disabled}
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
          >
            <Trash2 size={15} strokeWidth={1.5} />
            Eliminar limpieza
          </button>
        </div>
      )}
    </div>
  );
}

export default CleaningGroupCard;
