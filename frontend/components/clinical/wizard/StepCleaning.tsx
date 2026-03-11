'use client';

import { useEffect, useRef, useState } from 'react';
import { X, Plus, ChevronDown } from 'lucide-react';
import type { CleaningRow, CleaningSummary } from './types';

// ─── Catálogos hardcodeados (hasta que existan los endpoints) ─────────────────

const MANIFESTACIONES = [
  'Dolor físico',
  'Malestar emocional',
  'Pesadez energética',
  'Bloqueo en chakra',
  'Interferencia externa',
  'Otra',
];

const TRABAJOS = [
  'Limpieza de aura',
  'Extracción de entidad',
  'Limpieza de implante',
  'Desprogramación',
  'Protección',
  'Sellado energético',
  'Otro',
];

const MATERIALES = [
  'Cristal de cuarzo',
  'Vela blanca',
  'Incienso',
  'Sal marina',
  'Agua bendita',
  'Péndulo',
  'Otro',
];

const ORIGENES = [
  'Propio',
  'Heredado',
  'Ambiental',
  'Externo (trabajo/brujería)',
  'Kármico',
  'Otro',
];

const MESAS = [
  'Iluminación',
  'Hexágono',
  'Cubo',
  'Santería y magia ritual',
  'Brujería y hechizo',
  'Protección',
  'Limpieza de residuos',
  'Programaciones e implantes',
  'Otra',
];

// ─── MaterialsDropdown ────────────────────────────────────────────────────────

interface MaterialsDropdownProps {
  selected: string[];
  onChange: (val: string[]) => void;
  disabled?: boolean;
}

function MaterialsDropdown({ selected, onChange, disabled = false }: MaterialsDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  function toggle(m: string) {
    if (selected.includes(m)) onChange(selected.filter((x) => x !== m));
    else onChange([...selected, m]);
  }

  const label =
    selected.length === 0
      ? '— Materiales —'
      : selected.length === 1
        ? selected[0]
        : `${selected.length} materiales`;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((p) => !p)}
        className="flex min-h-[36px] w-[180px] items-center justify-between gap-1 rounded border border-gray-300 bg-white px-2 py-1 text-sm text-left focus:outline-none focus:ring-1 focus:ring-terra-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span className={`truncate ${selected.length === 0 ? 'text-gray-400' : 'text-gray-800'}`}>
          {label}
        </span>
        <ChevronDown
          size={14}
          className={`shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div
          className="absolute z-50 mt-1 w-48 rounded border border-[#EDE5E0] bg-white py-1"
          style={{ boxShadow: '0 4px 16px rgba(54,32,23,0.12)' }}
        >
          {MATERIALES.map((m) => (
            <label
              key={m}
              className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-[#362017] hover:bg-[#F6EDEA]"
            >
              <input
                type="checkbox"
                checked={selected.includes(m)}
                onChange={() => toggle(m)}
                className="h-4 w-4 rounded border-[#C4A98A] accent-[#B1481E]"
              />
              {m}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── StepCleaning ─────────────────────────────────────────────────────────────

export interface StepCleaningProps {
  rows: CleaningRow[];
  onChange: (rows: CleaningRow[]) => void;
  summary: CleaningSummary;
  onSummaryChange: (summary: CleaningSummary) => void;
  disabled?: boolean;
}

const SELECT_CLASS =
  'min-h-[36px] rounded border border-gray-300 bg-white px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-terra-700 disabled:opacity-50 disabled:cursor-not-allowed';

function newRow(): CleaningRow {
  return {
    _localId: crypto.randomUUID(),
    manifestation: '',
    work: '',
    materials: [],
    origin: '',
  };
}

export function StepCleaning({
  rows,
  onChange,
  summary,
  onSummaryChange,
  disabled = false,
}: StepCleaningProps) {
  function updateRow(localId: string, patch: Partial<CleaningRow>) {
    onChange(rows.map((r) => (r._localId === localId ? { ...r, ...patch } : r)));
  }

  function deleteRow(localId: string) {
    onChange(rows.filter((r) => r._localId !== localId));
  }

  function addRow() {
    onChange([...rows, newRow()]);
  }

  function updateSummary(patch: Partial<CleaningSummary>) {
    onSummaryChange({ ...summary, ...patch });
  }

  return (
    <div className="space-y-8">
      {/* ── Encabezado ─────────────────────────────────────────────────────── */}
      <div>
        <h2
          className="text-lg font-bold text-terra-900"
          style={{ fontFamily: 'Almarai, sans-serif' }}
        >
          Reporte de Limpieza
        </h2>
        <p className="mt-0.5 text-sm text-gray-500">
          Registra cada evento de limpieza energética realizado en la sesión.
        </p>
      </div>

      {/* ── Tabla de filas ─────────────────────────────────────────────────── */}
      <section aria-label="Filas de limpieza">
        {/* Cabecera */}
        <div
          aria-hidden="true"
          className="mb-1 hidden grid-cols-[32px_1fr_1fr_1fr_1fr_36px] gap-2 px-1 text-xs font-semibold uppercase tracking-wide text-gray-500 lg:grid"
        >
          <span className="text-center">#</span>
          <span>Manifestación</span>
          <span>Trabajo</span>
          <span>Materiales</span>
          <span>Origen</span>
          <span />
        </div>

        {/* Filas */}
        <div className="space-y-2">
          {rows.length === 0 && (
            <p className="rounded-lg border border-dashed border-gray-200 px-4 py-6 text-center text-sm text-gray-400">
              Sin filas. Agrega una para empezar.
            </p>
          )}

          {rows.map((row, idx) => (
            <div
              key={row._localId}
              className="flex flex-wrap items-start gap-2 rounded-lg border border-gray-100 bg-gray-50 p-2 lg:grid lg:grid-cols-[32px_1fr_1fr_1fr_1fr_36px] lg:items-center lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0"
            >
              {/* Número */}
              <span className="flex h-9 w-8 items-center justify-center text-xs font-semibold text-terra-700 shrink-0">
                {idx + 1}
              </span>

              {/* Manifestación */}
              <select
                value={row.manifestation}
                disabled={disabled}
                onChange={(e) => updateRow(row._localId, { manifestation: e.target.value })}
                aria-label={`Manifestación fila ${idx + 1}`}
                className={`${SELECT_CLASS} w-full lg:w-auto`}
              >
                <option value="">— Manifestación —</option>
                {MANIFESTACIONES.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>

              {/* Trabajo */}
              <select
                value={row.work}
                disabled={disabled}
                onChange={(e) => updateRow(row._localId, { work: e.target.value })}
                aria-label={`Trabajo fila ${idx + 1}`}
                className={`${SELECT_CLASS} w-full lg:w-auto`}
              >
                <option value="">— Trabajo —</option>
                {TRABAJOS.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>

              {/* Materiales */}
              <MaterialsDropdown
                selected={row.materials}
                onChange={(m) => updateRow(row._localId, { materials: m })}
                disabled={disabled}
              />

              {/* Origen */}
              <select
                value={row.origin}
                disabled={disabled}
                onChange={(e) => updateRow(row._localId, { origin: e.target.value })}
                aria-label={`Origen fila ${idx + 1}`}
                className={`${SELECT_CLASS} w-full lg:w-auto`}
              >
                <option value="">— Origen —</option>
                {ORIGENES.map((o) => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>

              {/* Eliminar */}
              <button
                type="button"
                onClick={() => deleteRow(row._localId)}
                disabled={disabled}
                aria-label={`Eliminar fila ${idx + 1}`}
                className="flex h-9 w-9 items-center justify-center rounded text-gray-400 hover:bg-red-50 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:cursor-not-allowed disabled:opacity-40 transition-colors shrink-0"
              >
                <X size={16} />
              </button>
            </div>
          ))}
        </div>

        {/* Botón agregar */}
        <button
          type="button"
          onClick={addRow}
          disabled={disabled}
          className="mt-3 flex items-center gap-1.5 rounded-lg border border-dashed border-terra-300 px-4 py-2 text-sm font-medium text-terra-700 hover:border-terra-500 hover:bg-terra-50 focus:outline-none focus:ring-2 focus:ring-terra-700 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
        >
          <Plus size={15} />
          Agregar fila
        </button>
      </section>

      <hr className="border-gray-100" />

      {/* ── Resumen numérico ───────────────────────────────────────────────── */}
      <section aria-label="Resumen de limpieza" className="grid grid-cols-2 gap-4 sm:grid-cols-2 max-w-xs">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
            Cantidad de capas
          </label>
          <input
            type="number"
            min={0}
            value={summary.capas}
            disabled={disabled}
            onChange={(e) =>
              updateSummary({ capas: Math.max(0, parseInt(e.target.value, 10) || 0) })
            }
            className="h-9 w-full rounded-lg border border-[#EDE5E0] bg-white px-3 text-sm text-[#362017] focus:outline-none focus:ring-2 focus:ring-[#B1481E]/30 focus:border-[#B1481E] disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
            Limpiezas requeridas
          </label>
          <input
            type="number"
            min={0}
            value={summary.limpiezas_requeridas}
            disabled={disabled}
            onChange={(e) =>
              updateSummary({ limpiezas_requeridas: Math.max(0, parseInt(e.target.value, 10) || 0) })
            }
            className="h-9 w-full rounded-lg border border-[#EDE5E0] bg-white px-3 text-sm text-[#362017] focus:outline-none focus:ring-2 focus:ring-[#B1481E]/30 focus:border-[#B1481E] disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>
      </section>

      <hr className="border-gray-100" />

      {/* ── Mesa utilizada ─────────────────────────────────────────────────── */}
      <section aria-label="Mesa utilizada">
        <p
          className="mb-3 text-sm font-bold text-terra-700 uppercase tracking-wide"
          style={{ fontFamily: 'Almarai, sans-serif' }}
        >
          Mesa utilizada
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-y-2 gap-x-4">
          {MESAS.map((mesa) => (
            <label
              key={mesa}
              className="flex cursor-pointer items-center gap-2 text-sm text-[#362017]"
            >
              <input
                type="radio"
                name="mesa_utilizada"
                value={mesa}
                checked={summary.mesa_utilizada === mesa}
                disabled={disabled}
                onChange={() => updateSummary({ mesa_utilizada: mesa })}
                className="h-4 w-4 accent-[#B1481E] disabled:cursor-not-allowed"
              />
              {mesa}
            </label>
          ))}
        </div>
      </section>

      <hr className="border-gray-100" />

      {/* ── Beneficios al cliente ──────────────────────────────────────────── */}
      <section aria-label="Beneficios al cliente">
        <label
          className="mb-2 block text-sm font-bold text-terra-700 uppercase tracking-wide"
          style={{ fontFamily: 'Almarai, sans-serif' }}
        >
          Beneficios al cliente
        </label>
        <textarea
          rows={4}
          value={summary.beneficios}
          disabled={disabled}
          onChange={(e) => updateSummary({ beneficios: e.target.value })}
          placeholder="Describe los beneficios obtenidos durante la limpieza…"
          className="w-full rounded-lg border border-[#EDE5E0] bg-white px-3 py-2 text-sm text-[#362017] placeholder-[#A9967E] shadow-sm focus:outline-none focus:ring-2 focus:ring-[#B1481E]/30 focus:border-[#B1481E] disabled:opacity-50 disabled:cursor-not-allowed resize-none"
          style={{ fontFamily: 'Almarai, sans-serif' }}
        />
      </section>
    </div>
  );
}

export default StepCleaning;
