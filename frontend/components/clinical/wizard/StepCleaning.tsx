'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { X, Plus, ChevronDown, Trash2 } from 'lucide-react';
import type { CleaningRow, CleaningCheck, CleaningSummary } from './types';

// ─── Catálogos reales ────────────────────────────────────────────────────────

const CHECK_LABELS: string[] = [
  'Sin capas',
  'Capas',
  'Capas invisibles',
  'Capas ocultas',
  'Candados',
  'Reprogramaciones',
  'Reprogramaciones invisibles',
  'Reprogramaciones ocultas',
];

const MANIFESTACIONES = [
  'Entidad',
  'Legión',
  'Otras entidades',
  'Egregor',
  'Desencarnado',
  'Gusanos o larvas',
  'Brujería',
  'Santería',
  'Vudú',
  'Conjuro',
  'Magia ritual',
  'Maldición familiar',
  'Portal',
  'Programación',
  'Implante',
] as const;

const TRABAJOS = [
  'Alejamiento',
  'Amarre emocional',
  'Amarre sexual',
  'Amarre mental',
  'Arruinamiento',
  'Atadura de pies',
  'Atadura de manos',
  'Atadura de rodillas',
  'Bloqueo energético',
  'Brujería en comida o bebida',
  'Chequeo con tabaco',
  'Cierre de boca',
  'Cierre de caminos',
  'Congelamiento',
  'Deseo de muerte',
  'Desespero',
  'Destierro',
  'Dominio',
  'Embrujamiento',
  'Envío de espanto/ánima',
  'Mal de ojo',
  'Maldición',
  'Muerto enviado',
  'Objeto etérico enviado',
  'Salación',
  'Separación',
  'Venganza',
  'Volteo',
  'Velación',
  'Otro',
] as const;

const MATERIALES = [
  'Tabaco',
  'Santa Muerte',
  'Plumas',
  'Sangre',
  'Órganos',
  'Orina',
  'Excremento',
  'Fotografías o videos',
  'Objetos personales',
  'Cabello o uñas',
  'Tierra común',
  'Tierra de cementerio',
  'Agua',
  'Saliva',
  'Fuego',
  'Cenizas',
  'Velas',
  'Otro',
] as const;

const ORIGENES = [
  'Pareja',
  'Ex-pareja',
  'Suegro',
  'Suegra',
  'Ex-suegro',
  'Ex-suegra',
  'Mamá',
  'Madrastra',
  'Papá',
  'Padrastro',
  'Hermano',
  'Hermana',
  'Hermanastro',
  'Hermanastra',
  'Tío',
  'Tía',
  'Abuelo',
  'Abuela',
  'Primo',
  'Prima',
  'Familiar lejano',
  'Cuñado',
  'Cuñada',
  'Socio',
  'Jefe',
  'Empleado',
  'Amistad rota',
  'Enemigo declarado',
  'Vecino',
  'Linaje materno',
  'Linaje paterno',
  'Kármico',
  'Vida pasada',
  'Auto-generado / propio',
] as const;

const MESAS = [
  'Mesa sencilla',
  'Limpieza de brujería',
  'Limpieza de entidades',
  'Limpieza de residuos',
  'Limpieza de Programaciones e implantes',
  'Otra',
] as const;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function defaultChecks(): CleaningCheck[] {
  return CHECK_LABELS.map((label) => ({ label, checked: false, quantity: 0 }));
}

function newRow(): CleaningRow {
  return {
    _localId: crypto.randomUUID(),
    manifestation: '',
    work_done: '',
    materials: [],
    origin: '',
  };
}

/** Serializa mesa[] ↔ string delimitada por pipe para CleaningSummary. */
function mesaToArray(s: string): string[] {
  return s ? s.split('|').filter(Boolean) : [];
}
function mesaToString(arr: string[]): string {
  return arr.join('|');
}

// ─── MaterialsDropdown ──────────────────────────────────────────────────────

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
    <div ref={ref} className="relative w-full">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((p) => !p)}
        className="flex min-h-[44px] w-full items-center justify-between gap-1 rounded border border-gray-300 bg-white px-2.5 py-1.5 text-sm text-left focus:outline-none focus:ring-1 focus:ring-terra-700 disabled:opacity-50 disabled:cursor-not-allowed"
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
          className="absolute z-50 mt-1 max-h-60 w-56 overflow-y-auto rounded border border-[#EDE5E0] bg-white py-1"
          style={{ boxShadow: '0 4px 16px rgba(54,32,23,0.12)' }}
        >
          {MATERIALES.map((m) => (
            <label
              key={m}
              className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-[#2C2220] hover:bg-[#FAF7F5]"
            >
              <input
                type="checkbox"
                checked={selected.includes(m)}
                onChange={() => toggle(m)}
                className="h-4 w-4 rounded border-[#C4A98A]"
                style={{ accentColor: '#C4704A' }}
              />
              {m}
            </label>
          ))}
        </div>
      )}

      {/* Chips */}
      {selected.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {selected.map((m) => (
            <span
              key={m}
              className="inline-flex items-center gap-1 rounded-full bg-terra-200 px-2 py-0.5 text-xs text-terra-900"
            >
              {m}
              {!disabled && (
                <button
                  type="button"
                  onClick={() => onChange(selected.filter((x) => x !== m))}
                  className="ml-0.5 rounded-full p-0.5 hover:bg-terra-300 transition-colors"
                  aria-label={`Quitar ${m}`}
                >
                  <X size={10} />
                </button>
              )}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── StepCleaning ───────────────────────────────────────────────────────────

export interface StepCleaningProps {
  rows: CleaningRow[];
  onChange: (rows: CleaningRow[]) => void;
  summary: CleaningSummary;
  onSummaryChange: (summary: CleaningSummary) => void;
  disabled?: boolean;
}

const SELECT_CLASS =
  'min-h-[44px] w-full rounded border border-gray-300 bg-white px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-terra-700 disabled:opacity-50 disabled:cursor-not-allowed';

const INPUT_CLASS =
  'h-11 w-full rounded-lg border border-[#EDE5E0] bg-white px-3 text-sm text-[#2C2220] focus:outline-none focus:ring-2 focus:ring-[#C4704A]/30 focus:border-[#C4704A] disabled:opacity-50 disabled:cursor-not-allowed';

export function StepCleaning({
  rows,
  onChange,
  summary,
  onSummaryChange,
  disabled = false,
}: StepCleaningProps) {
  // ── Internal state for checks (not in summary to keep page.tsx untouched) ──
  const [checks, setChecks] = useState<CleaningCheck[]>(defaultChecks);

  // ── Derived mesa array from summary.mesa_utilizada string ──
  const mesaArr = mesaToArray(summary.mesa_utilizada);

  // ── Sync capas sum → summary.capas ──
  const capasSum = checks.reduce((acc, c) => acc + (c.checked ? c.quantity : 0), 0);
  const prevCapasRef = useRef(capasSum);
  useEffect(() => {
    if (capasSum !== prevCapasRef.current) {
      prevCapasRef.current = capasSum;
      onSummaryChange({ ...summary, capas: capasSum });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [capasSum]);

  // ── Handlers ──

  const handleCheckToggle = useCallback(
    (idx: number) => {
      setChecks((prev) => {
        const next = [...prev];
        const isSinCapas = idx === 0;
        if (isSinCapas) {
          // "Sin capas" checked → uncheck all others, lock qty at 0
          const nowChecked = !next[0].checked;
          return next.map((c, i) =>
            i === 0
              ? { ...c, checked: nowChecked, quantity: 0 }
              : { ...c, checked: false, quantity: 0 },
          );
        }
        // Any other check → uncheck "Sin capas"
        const nowChecked = !next[idx].checked;
        return next.map((c, i) => {
          if (i === 0) return { ...c, checked: false, quantity: 0 };
          if (i === idx)
            return { ...c, checked: nowChecked, quantity: nowChecked ? Math.max(c.quantity, 1) : 0 };
          return c;
        });
      });
    },
    [],
  );

  const handleCheckQuantity = useCallback(
    (idx: number, val: number) => {
      setChecks((prev) => {
        const next = [...prev];
        next[idx] = { ...next[idx], quantity: Math.max(0, val) };
        return next;
      });
    },
    [],
  );

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

  function toggleMesa(m: string) {
    const next = mesaArr.includes(m) ? mesaArr.filter((x) => x !== m) : [...mesaArr, m];
    updateSummary({ mesa_utilizada: mesaToString(next) });
  }

  return (
    <div className="space-y-8">
      {/* ── Encabezado ─────────────────────────────────────────────────────── */}
      <div>
        <h2
          className="text-lg font-bold text-terra-900"
          style={{ fontFamily: 'Lato, sans-serif' }}
        >
          Reporte de Limpieza
        </h2>
        <p className="mt-0.5 text-sm text-gray-500">
          Registra cada evento de limpieza energética realizado en la sesión.
        </p>
      </div>

      {/* ── Sección 1: Checks pre-tabla ────────────────────────────────────── */}
      <section
        aria-label="Tipos de capas"
        className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
      >
        <p
          className="mb-3 text-xs font-semibold uppercase tracking-wide text-terra-700"
          style={{ fontFamily: 'Lato, sans-serif' }}
        >
          Capas detectadas
        </p>
        <div className="space-y-2">
          {checks.map((chk, idx) => {
            const isSinCapas = idx === 0;
            const qtyDisabled = disabled || !chk.checked || isSinCapas;
            return (
              <div key={chk.label} className="flex items-center gap-3">
                <label className="flex min-w-[220px] cursor-pointer items-center gap-2 text-sm text-[#2C2220] select-none">
                  <input
                    type="checkbox"
                    checked={chk.checked}
                    disabled={disabled}
                    onChange={() => handleCheckToggle(idx)}
                    className="h-4 w-4 cursor-pointer disabled:cursor-not-allowed"
                    style={{ accentColor: '#C4704A' }}
                  />
                  {chk.label}
                </label>
                <input
                  type="number"
                  min={0}
                  value={qtyDisabled && !chk.checked ? '' : chk.quantity}
                  disabled={qtyDisabled}
                  onChange={(e) =>
                    handleCheckQuantity(idx, parseInt(e.target.value, 10) || 0)
                  }
                  className="h-9 w-20 rounded border border-gray-300 bg-white px-2 text-center text-sm focus:outline-none focus:ring-1 focus:ring-terra-700 disabled:opacity-40 disabled:cursor-not-allowed"
                  aria-label={`Cantidad ${chk.label}`}
                />
              </div>
            );
          })}
        </div>
        <div className="mt-4 flex items-center gap-2 rounded bg-terra-200/60 px-3 py-2 text-sm font-semibold text-terra-900">
          Cantidad de capas: <span className="text-base">{capasSum}</span>
        </div>
      </section>

      {/* ── Sección 2: Tabla de eventos ────────────────────────────────────── */}
      <section aria-label="Filas de limpieza">
        <p
          className="mb-3 text-xs font-semibold uppercase tracking-wide text-terra-700"
          style={{ fontFamily: 'Lato, sans-serif' }}
        >
          Eventos de limpieza
        </p>

        {/* Cabecera desktop */}
        <div
          aria-hidden="true"
          className="mb-1 hidden grid-cols-[32px_1fr_1fr_1fr_1fr_36px] gap-2 px-1 text-xs font-semibold uppercase tracking-wide text-gray-500 xl:grid"
        >
          <span className="text-center">#</span>
          <span>Manifestación</span>
          <span>Trabajo realizado</span>
          <span>Materiales</span>
          <span>Origen</span>
          <span />
        </div>

        {/* Filas */}
        <div className="space-y-3">
          {rows.length === 0 && (
            <p className="rounded-lg border border-dashed border-gray-200 px-4 py-6 text-center text-sm text-gray-400">
              Sin filas. Agrega una para empezar.
            </p>
          )}

          {rows.map((row, idx) => (
            <div
              key={row._localId}
              className="rounded-lg border border-gray-100 bg-gray-50 p-3 space-y-3 xl:grid xl:grid-cols-[32px_1fr_1fr_1fr_1fr_36px] xl:gap-2 xl:items-start xl:space-y-0 xl:rounded-none xl:border-0 xl:bg-transparent xl:p-0"
            >
              {/* Número */}
              <span className="hidden xl:flex h-9 w-8 items-center justify-center text-xs font-semibold text-terra-700 shrink-0">
                {idx + 1}
              </span>

              {/* Mobile row header */}
              <div className="flex items-center justify-between xl:hidden">
                <span className="text-xs font-semibold text-terra-700">#{idx + 1}</span>
                <button
                  type="button"
                  onClick={() => deleteRow(row._localId)}
                  disabled={disabled}
                  aria-label={`Eliminar fila ${idx + 1}`}
                  className="flex h-9 w-9 items-center justify-center rounded text-gray-400 hover:bg-red-50 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:cursor-not-allowed disabled:opacity-40 transition-colors"
                >
                  <Trash2 size={15} />
                </button>
              </div>

              {/* Manifestación */}
              <div>
                <label className="mb-1 block text-xs text-gray-500 xl:hidden">Manifestación</label>
                <select
                  value={row.manifestation}
                  disabled={disabled}
                  onChange={(e) => updateRow(row._localId, { manifestation: e.target.value })}
                  aria-label={`Manifestación fila ${idx + 1}`}
                  className={SELECT_CLASS}
                >
                  <option value="">— Manifestación —</option>
                  {MANIFESTACIONES.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>

              {/* Trabajo realizado */}
              <div>
                <label className="mb-1 block text-xs text-gray-500 xl:hidden">Trabajo realizado</label>
                <select
                  value={row.work_done}
                  disabled={disabled}
                  onChange={(e) => updateRow(row._localId, { work_done: e.target.value, work_done_other: e.target.value === 'Otro' ? row.work_done_other : undefined })}
                  aria-label={`Trabajo fila ${idx + 1}`}
                  className={SELECT_CLASS}
                >
                  <option value="">— Trabajo —</option>
                  {TRABAJOS.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
                {row.work_done === 'Otro' && (
                  <input
                    type="text"
                    value={row.work_done_other ?? ''}
                    disabled={disabled}
                    onChange={(e) => updateRow(row._localId, { work_done_other: e.target.value })}
                    placeholder="Especifica…"
                    className="mt-1.5 h-9 w-full rounded border border-gray-300 bg-white px-2.5 text-sm placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-terra-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-label={`Trabajo otro fila ${idx + 1}`}
                  />
                )}
              </div>

              {/* Materiales */}
              <div>
                <label className="mb-1 block text-xs text-gray-500 xl:hidden">Materiales</label>
                <MaterialsDropdown
                  selected={row.materials}
                  onChange={(m) => updateRow(row._localId, { materials: m })}
                  disabled={disabled}
                />
              </div>

              {/* Origen */}
              <div>
                <label className="mb-1 block text-xs text-gray-500 xl:hidden">Origen</label>
                <select
                  value={row.origin}
                  disabled={disabled}
                  onChange={(e) => updateRow(row._localId, { origin: e.target.value })}
                  aria-label={`Origen fila ${idx + 1}`}
                  className={SELECT_CLASS}
                >
                  <option value="">— Origen —</option>
                  {ORIGENES.map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              </div>

              {/* Eliminar (desktop) */}
              <button
                type="button"
                onClick={() => deleteRow(row._localId)}
                disabled={disabled}
                aria-label={`Eliminar fila ${idx + 1}`}
                className="hidden xl:flex h-9 w-9 items-center justify-center rounded text-gray-400 hover:bg-red-50 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:cursor-not-allowed disabled:opacity-40 transition-colors shrink-0"
              >
                <Trash2 size={15} />
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

      {/* ── Sección 3: Mesa utilizada (multi-select) ──────────────────────── */}
      <section aria-label="Mesa utilizada">
        <p
          className="mb-3 text-xs font-semibold uppercase tracking-wide text-terra-700"
          style={{ fontFamily: 'Lato, sans-serif' }}
        >
          Mesa utilizada
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-y-2 gap-x-4">
          {MESAS.map((mesa) => (
            <label
              key={mesa}
              className="flex cursor-pointer items-center gap-2 text-sm text-[#2C2220] select-none"
              style={{ minHeight: 44 }}
            >
              <input
                type="checkbox"
                checked={mesaArr.includes(mesa)}
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

      <hr className="border-gray-100" />

      {/* ── Sección 4: Beneficios al cliente ──────────────────────────────── */}
      <section aria-label="Beneficios al cliente">
        <label
          className="mb-2 block text-xs font-semibold uppercase tracking-wide text-terra-700"
          style={{ fontFamily: 'Lato, sans-serif' }}
        >
          Beneficios al cliente
        </label>
        <textarea
          rows={4}
          value={summary.beneficios}
          disabled={disabled}
          onChange={(e) => updateSummary({ beneficios: e.target.value })}
          placeholder="Describe los beneficios obtenidos durante la limpieza…"
          className="w-full rounded-lg border border-[#EDE5E0] bg-white px-3 py-2 text-sm text-[#2C2220] placeholder-[#A9967E] shadow-sm focus:outline-none focus:ring-2 focus:ring-[#C4704A]/30 focus:border-[#C4704A] disabled:opacity-50 disabled:cursor-not-allowed resize-none"
          style={{ fontFamily: 'Lato, sans-serif' }}
        />
      </section>

      <hr className="border-gray-100" />

      {/* ── Sección 5: Resumen ────────────────────────────────────────────── */}
      <section aria-label="Resumen de limpieza" className="grid grid-cols-2 gap-4 max-w-sm">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold uppercase tracking-wide text-gray-600">
            Cantidad de capas
          </label>
          <div className={`${INPUT_CLASS} flex items-center opacity-70 cursor-default`}>
            {capasSum}
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold uppercase tracking-wide text-gray-600">
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
            className={INPUT_CLASS}
          />
        </div>
      </section>
    </div>
  );
}

export default StepCleaning;
