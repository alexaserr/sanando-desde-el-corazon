'use client';

import { useState, useId } from 'react';
import type { AncestorEntry, AncestorConciliation } from './types';

// ─── Catálogos de opciones ────────────────────────────────────────────────────

const BOND_ENERGY_OPTIONS = [
  'Pertenencia',
  'Jerarquía',
  'Amor interrumpido',
  'Lealtad ciega',
  'Compensación',
  'Sanación',
];

const ROLE_OPTIONS = [
  'El que da',
  'El que recibe',
  'El que carga',
  'El excluido',
  'El reemplazo',
  'El identificado con otro',
  'El que repite un patrón',
  'El sanador',
  'Sostiene la lealtad familiar',
  'El no visto',
];

function newLocalId() {
  return Math.random().toString(36).slice(2);
}

function emptyAncestor(): AncestorEntry {
  return {
    _localId: newLocalId(),
    member: '',
    lineage: '',
    bond_energy: [],
    ancestor_roles: [],
    consultant_roles: [],
    energy_expressions: [],
    family_traumas: [],
  };
}

// ─── CheckboxGroup ────────────────────────────────────────────────────────────

interface CheckboxGroupProps {
  legend: string;
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  disabled?: boolean;
}

function CheckboxGroup({ legend, options, selected, onChange, disabled }: CheckboxGroupProps) {
  function toggle(opt: string) {
    onChange(
      selected.includes(opt) ? selected.filter((s) => s !== opt) : [...selected, opt],
    );
  }

  return (
    <fieldset>
      <legend className="text-xs font-semibold text-terra-700 mb-2">{legend}</legend>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2">
        {options.map((opt) => (
          <label key={opt} className="flex items-start gap-1.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={selected.includes(opt)}
              onChange={() => toggle(opt)}
              disabled={disabled}
              className="mt-0.5 w-3.5 h-3.5 accent-terra-700 shrink-0"
            />
            <span className="text-xs text-gray-700 leading-snug">{opt}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

// ─── DynamicList ──────────────────────────────────────────────────────────────

interface DynamicListItem {
  number: number;
  text: string;
}

interface DynamicListProps {
  legend: string;
  items: DynamicListItem[];
  onChange: (items: DynamicListItem[]) => void;
  disabled?: boolean;
  placeholder?: string;
}

function DynamicList({ legend, items, onChange, disabled, placeholder }: DynamicListProps) {
  function addItem() {
    const nextNum = items.length > 0 ? Math.max(...items.map((i) => i.number)) + 1 : 1;
    onChange([...items, { number: nextNum, text: '' }]);
  }

  function updateText(index: number, text: string) {
    onChange(items.map((item, i) => (i === index ? { ...item, text } : item)));
  }

  function removeItem(index: number) {
    onChange(items.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-terra-700">{legend}</p>

      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="shrink-0 w-5 h-5 flex items-center justify-center rounded-full bg-terra-100 text-terra-700 text-[10px] font-bold">
            {item.number}
          </span>
          <input
            type="text"
            value={item.text}
            onChange={(e) => updateText(i, e.target.value)}
            disabled={disabled}
            placeholder={placeholder}
            className="flex-1 min-h-[32px] rounded border border-gray-300 px-2 py-1 text-sm text-gray-800 focus:outline-none focus:ring-1 focus:ring-terra-700 disabled:opacity-50"
          />
          <button
            type="button"
            onClick={() => removeItem(i)}
            disabled={disabled}
            aria-label="Eliminar"
            className="shrink-0 p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-40 transition-colors"
          >
            <svg aria-hidden="true" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={addItem}
        disabled={disabled}
        className="flex items-center gap-1 text-xs font-medium text-terra-600 hover:text-terra-800 disabled:opacity-50 transition-colors"
      >
        <svg aria-hidden="true" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
        Agregar
      </button>
    </div>
  );
}

// ─── AncestorCard ─────────────────────────────────────────────────────────────

interface AncestorCardProps {
  entry: AncestorEntry;
  index: number;
  onChange: (updated: AncestorEntry) => void;
  onDelete: () => void;
  disabled?: boolean;
}

function AncestorCard({ entry, index, onChange, onDelete, disabled }: AncestorCardProps) {
  const [expanded, setExpanded] = useState(true);
  const headingId = useId();

  function update<K extends keyof AncestorEntry>(key: K, value: AncestorEntry[K]) {
    onChange({ ...entry, [key]: value });
  }

  return (
    <article
      aria-labelledby={headingId}
      className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm"
    >
      {/* Cabecera */}
      <div className="flex items-center gap-2 px-4 py-3 bg-terra-50 border-b border-gray-100">
        <span id={headingId} className="flex-1 text-sm font-semibold text-terra-700 truncate">
          Ancestro {index + 1}{entry.member ? `: ${entry.member}` : ''}
        </span>

        <button
          type="button"
          onClick={onDelete}
          disabled={disabled}
          aria-label={`Eliminar ancestro ${index + 1}`}
          title="Eliminar"
          className="shrink-0 p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-40 transition-colors"
        >
          <svg aria-hidden="true" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>

        <button
          type="button"
          onClick={() => setExpanded((p) => !p)}
          aria-expanded={expanded}
          className="shrink-0 p-1.5 rounded text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-terra-700 transition-colors"
        >
          <svg aria-hidden="true" className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
          <span className="sr-only">{expanded ? 'Colapsar' : 'Expandir'}</span>
        </button>
      </div>

      {/* Cuerpo */}
      {expanded && (
        <div className="p-4 space-y-5">
          {/* Miembro */}
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-terra-700">Miembro</label>
            <input
              type="text"
              value={entry.member}
              onChange={(e) => update('member', e.target.value)}
              disabled={disabled}
              placeholder="Nombre del familiar"
              className="w-full rounded border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-terra-700 disabled:opacity-50"
            />
          </div>

          {/* Linaje */}
          <fieldset>
            <legend className="text-xs font-semibold text-terra-700 mb-2">Linaje</legend>
            <div className="flex gap-5">
              {(['materno', 'paterno', 'ambos'] as const).map((opt) => (
                <label key={opt} className="flex items-center gap-1.5 cursor-pointer select-none">
                  <input
                    type="radio"
                    name={`lineage-${entry._localId}`}
                    value={opt}
                    checked={entry.lineage === opt}
                    onChange={() => update('lineage', opt)}
                    disabled={disabled}
                    className="w-3.5 h-3.5 accent-terra-700"
                  />
                  <span className="text-sm capitalize text-gray-700">{opt}</span>
                </label>
              ))}
            </div>
          </fieldset>

          {/* Energía del vínculo */}
          <CheckboxGroup
            legend="Energía del vínculo"
            options={BOND_ENERGY_OPTIONS}
            selected={entry.bond_energy}
            onChange={(v) => update('bond_energy', v)}
            disabled={disabled}
          />

          {/* Roles del Ancestro */}
          <CheckboxGroup
            legend="Roles del Ancestro"
            options={ROLE_OPTIONS}
            selected={entry.ancestor_roles}
            onChange={(v) => update('ancestor_roles', v)}
            disabled={disabled}
          />

          {/* Roles del Consultante */}
          <CheckboxGroup
            legend="Roles del Consultante"
            options={ROLE_OPTIONS}
            selected={entry.consultant_roles}
            onChange={(v) => update('consultant_roles', v)}
            disabled={disabled}
          />

          <hr className="border-gray-100" />

          {/* Expresiones de la energía */}
          <DynamicList
            legend="Expresiones de la energía"
            items={entry.energy_expressions.map((e) => ({ number: e.number, text: e.expression }))}
            onChange={(items) =>
              update('energy_expressions', items.map((i) => ({ number: i.number, expression: i.text })))
            }
            disabled={disabled}
            placeholder="Descripción de la expresión…"
          />

          {/* Traumas familiares */}
          <DynamicList
            legend="Traumas familiares"
            items={entry.family_traumas.map((t) => ({ number: t.number, text: t.trauma }))}
            onChange={(items) =>
              update('family_traumas', items.map((i) => ({ number: i.number, trauma: i.text })))
            }
            disabled={disabled}
            placeholder="Descripción del trauma…"
          />
        </div>
      )}
    </article>
  );
}

// ─── StepAncestors (Modal) ────────────────────────────────────────────────────

const CONCILIATION_FIELDS: { key: keyof AncestorConciliation; label: string }[] = [
  { key: 'healing_phrases',     label: '¿Qué frases sanadoras se deben usar?' },
  { key: 'conciliation_acts',   label: '¿Qué actos de conciliación se deben hacer?' },
  { key: 'life_aspects_affected', label: '¿En qué aspectos de su vida afecta esto al paciente?' },
  { key: 'session_relationship',  label: '¿En qué se relaciona esta constelación a la sesión de hoy?' },
];

export interface StepAncestorsProps {
  isOpen: boolean;
  onClose: () => void;
  ancestors: AncestorEntry[];
  onAncestorsChange: (ancestors: AncestorEntry[]) => void;
  conciliation: AncestorConciliation;
  onConciliationChange: (conciliation: AncestorConciliation) => void;
  disabled?: boolean;
}

export function StepAncestors({
  isOpen,
  onClose,
  ancestors,
  onAncestorsChange,
  conciliation,
  onConciliationChange,
  disabled = false,
}: StepAncestorsProps) {
  if (!isOpen) return null;

  function addAncestor() {
    onAncestorsChange([...ancestors, emptyAncestor()]);
  }

  function updateAncestor(index: number, updated: AncestorEntry) {
    onAncestorsChange(ancestors.map((a, i) => (i === index ? updated : a)));
  }

  function deleteAncestor(index: number) {
    onAncestorsChange(ancestors.filter((_, i) => i !== index));
  }

  function updateConciliation(key: keyof AncestorConciliation, value: string) {
    onConciliationChange({ ...conciliation, [key]: value });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Reporte de Ancestros"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        className="relative z-10 w-full max-w-4xl max-h-[92vh] bg-white rounded-xl shadow-2xl flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-terra-50 shrink-0">
          <h2 className="text-base font-semibold text-terra-800">Reporte de Ancestros</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-terra-700 transition-colors"
          >
            <svg aria-hidden="true" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">

          {/* Tarjetas de ancestros */}
          {ancestors.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-8">
              Sin ancestros registrados. Agrega uno con el botón de abajo.
            </p>
          )}

          {ancestors.map((entry, i) => (
            <AncestorCard
              key={entry._localId}
              entry={entry}
              index={i}
              onChange={(updated) => updateAncestor(i, updated)}
              onDelete={() => deleteAncestor(i)}
              disabled={disabled}
            />
          ))}

          {/* Botón agregar ancestro */}
          <button
            type="button"
            onClick={addAncestor}
            disabled={disabled}
            className="w-full flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-terra-200 py-3 text-sm font-medium text-terra-600 hover:border-terra-400 hover:bg-terra-50 focus:outline-none focus:ring-2 focus:ring-terra-700 disabled:opacity-50 transition-colors"
          >
            <svg aria-hidden="true" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Agregar ancestro
          </button>

          <hr className="border-gray-200" />

          {/* Conciliación de Ancestros */}
          <section className="space-y-4">
            <h3 className="text-sm font-semibold text-terra-800">Conciliación de Ancestros</h3>

            {CONCILIATION_FIELDS.map(({ key, label }) => (
              <div key={key} className="space-y-1.5">
                <label className="block text-xs font-semibold text-terra-700">{label}</label>
                <textarea
                  rows={3}
                  value={conciliation[key]}
                  onChange={(e) => updateConciliation(key, e.target.value)}
                  disabled={disabled}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 resize-y focus:outline-none focus:ring-1 focus:ring-terra-700 disabled:opacity-50"
                />
              </div>
            ))}
          </section>
        </div>

        {/* Footer */}
        <div className="shrink-0 px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1.5 rounded-lg bg-terra-700 px-5 py-2 text-sm font-semibold text-white hover:bg-terra-600 focus:outline-none focus:ring-2 focus:ring-terra-700 focus:ring-offset-1 transition-colors"
          >
            <svg aria-hidden="true" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            Guardar y cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

export default StepAncestors;
