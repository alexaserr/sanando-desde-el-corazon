'use client';

import { useState, useRef, useEffect, useId, useCallback } from 'react';
import { EnergySlider } from '../EnergySlider';
import type { ClientOption, TherapyTypeOption, GeneralData } from './types';

// ─── Combobox con búsqueda ────────────────────────────────────────────────────

interface ComboboxOption {
  value: string;
  label: string;
}

interface ComboboxProps {
  id: string;
  label: string;
  options: ComboboxOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  /** Si se provee, la búsqueda se hace contra el servidor (debounce 300ms). */
  onSearch?: (query: string) => Promise<ComboboxOption[]>;
  emptyMessage?: string;
  loadingMessage?: string;
}

function Combobox({
  id,
  label,
  options,
  value,
  onChange,
  placeholder = 'Buscar…',
  disabled = false,
  onSearch,
  emptyMessage = 'Sin resultados',
  loadingMessage = 'Buscando...',
}: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [asyncOptions, setAsyncOptions] = useState<ComboboxOption[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  // Cache the label of a server-side selected option so the button can display it
  const [cachedLabel, setCachedLabel] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Display label: check static options first, then async results, then cache
  const selected =
    options.find((o) => o.value === value) ??
    asyncOptions.find((o) => o.value === value) ??
    (cachedLabel && value ? { value, label: cachedLabel } : undefined);

  // Debounced server-side search
  useEffect(() => {
    if (!onSearch || !open) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim() === '') {
      setAsyncOptions([]);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    debounceRef.current = setTimeout(() => {
      onSearch(query)
        .then((res) => { setAsyncOptions(res); setIsSearching(false); })
        .catch(() => { setAsyncOptions([]); setIsSearching(false); });
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, onSearch, open]);

  // Options to render: server results when async active and query non-empty; else filter static
  const visibleOptions: ComboboxOption[] = onSearch
    ? (query.trim() === '' ? options : asyncOptions)
    : options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()));

  // Cerrar al hacer click fuera del combobox
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs uppercase tracking-wide font-normal text-[#4A3628]">
        {label}
      </label>
      <div ref={containerRef} className="relative">
        <button
          id={id}
          type="button"
          disabled={disabled}
          onClick={() => {
            setOpen((prev) => !prev);
            setQuery('');
          }}
          aria-haspopup="listbox"
          aria-expanded={open}
          className="w-full flex items-center justify-between rounded-none border-0 border-b border-[#D4A592] bg-[#FAF7F5] px-3 py-2 text-sm text-left focus:outline-none focus:ring-0 focus:border-b-2 focus:border-[#C4704A] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span className={selected ? 'text-terra-900' : 'text-terra-400'}>
            {selected ? selected.label : placeholder}
          </span>
          <svg
            aria-hidden="true"
            className={`w-4 h-4 text-terra-400 transition-transform ${open ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {open && (
          <div
            role="listbox"
            aria-label={label}
            className="absolute z-20 mt-1 w-full rounded-md border border-terra-100 bg-terra-50 shadow-lg"
          >
            <div className="p-2 border-b border-terra-100">
              <input
                autoFocus
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar…"
                className="w-full rounded border border-terra-100 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#2C2220]"
              />
            </div>
            <ul className="max-h-52 overflow-y-auto py-1">
              {isSearching ? (
                <li className="px-3 py-2 text-sm text-terra-400">{loadingMessage}</li>
              ) : visibleOptions.length === 0 ? (
                <li className="px-3 py-2 text-sm text-terra-400">{emptyMessage}</li>
              ) : (
                visibleOptions.map((opt) => (
                  <li
                    key={opt.value}
                    role="option"
                    aria-selected={opt.value === value}
                    onClick={() => {
                      onChange(opt.value);
                      setCachedLabel(opt.label);
                      setOpen(false);
                      setQuery('');
                    }}
                    className={`px-3 py-2 text-sm cursor-pointer select-none hover:bg-terra-50 ${
                      opt.value === value ? 'font-semibold text-[#2C2220] bg-amber-50' : 'text-terra-900'
                    }`}
                  >
                    {opt.label}
                  </li>
                ))
              )}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Pill Sí/No ───────────────────────────────────────────────────────────────

interface YesNoPillsProps {
  value: boolean | null;
  onChange: (val: boolean) => void;
  disabled?: boolean;
}

function YesNoPills({ value, onChange, disabled = false }: YesNoPillsProps) {
  function pillClass(option: boolean) {
    if (value === option) {
      return option
        ? 'px-4 py-1.5 rounded-md text-sm font-medium transition-colors bg-[#C4704A] text-white'
        : 'px-4 py-1.5 rounded-md text-sm font-medium transition-colors bg-terra-100 text-terra-800';
    }
    return 'px-4 py-1.5 rounded-md text-sm font-medium transition-colors border border-terra-100 text-terra-400 hover:border-terra-200';
  }

  return (
    <div className="flex gap-2">
      <button type="button" disabled={disabled} onClick={() => onChange(true)} className={pillClass(true)}>
        Sí
      </button>
      <button type="button" disabled={disabled} onClick={() => onChange(false)} className={pillClass(false)}>
        No
      </button>
    </div>
  );
}

// ─── StepGeneral ──────────────────────────────────────────────────────────────

export interface StepGeneralProps {
  clients: ClientOption[];
  therapyTypes: TherapyTypeOption[];
  value: GeneralData;
  onChange: (value: GeneralData) => void;
  disabled?: boolean;
  /** Búsqueda server-side de clientes (debounce 300ms). */
  onSearchClients?: (query: string) => Promise<ClientOption[]>;
  /** Notifica si alguno de entidades/bajo astral/implantes está en "Sí" → inyecta StepCleaning. */
  onCleaningTriggered?: (hasAny: boolean) => void;
}

export function StepGeneral({
  clients,
  therapyTypes,
  value,
  onChange,
  disabled = false,
  onSearchClients,
  onCleaningTriggered,
}: StepGeneralProps) {
  const clientSelectId   = useId();
  const therapySelectId  = useId();
  const dateInputId      = useId();
  const notesInputId     = useId();

  const clientOptions    = clients.map((c) => ({ value: c.id, label: c.full_name }));
  const therapyOptions   = therapyTypes.map((t) => ({ value: t.id, label: t.name }));

  // Notify parent when entidades/bajo astral/implantes toggles change → inject StepCleaning
  const hasAnyEntity = value.has_entities === true || value.has_capas === true || value.has_implants === true;
  const stableOnCleaningTriggered = useCallback(
    (flag: boolean) => onCleaningTriggered?.(flag),
    [onCleaningTriggered],
  );
  useEffect(() => {
    stableOnCleaningTriggered(hasAnyEntity);
  }, [hasAnyEntity, stableOnCleaningTriggered]);

  function update<K extends keyof GeneralData>(field: K, val: GeneralData[K]) {
    onChange({ ...value, [field]: val });
  }

  return (
    <section aria-labelledby="step-general-heading" className="space-y-6">
      <h2
        id="step-general-heading"
        className="text-base font-semibold text-[#2C2220]"
      >
        Datos de sesión
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Cliente */}
        <Combobox
          id={clientSelectId}
          label="Cliente *"
          options={clientOptions}
          value={value.client_id}
          onChange={(v) => update('client_id', v)}
          placeholder="Seleccionar cliente…"
          disabled={disabled}
          onSearch={
            onSearchClients
              ? (q) => onSearchClients(q).then((items) => items.map((c) => ({ value: c.id, label: c.full_name })))
              : undefined
          }
          emptyMessage="No se encontraron clientes"
          loadingMessage="Buscando..."
        />

        {/* Tipo de terapia */}
        <Combobox
          id={therapySelectId}
          label="Tipo de terapia *"
          options={therapyOptions}
          value={value.therapy_type_id}
          onChange={(v) => update('therapy_type_id', v)}
          placeholder="Seleccionar tipo…"
          disabled={disabled}
        />
      </div>

      {/* Fecha y hora de medición */}
      <div className="flex flex-col gap-1 max-w-xs">
        <label htmlFor={dateInputId} className="text-xs uppercase tracking-wide font-normal text-[#4A3628]">
          Fecha de medición *
        </label>
        <input
          id={dateInputId}
          type="datetime-local"
          value={value.measured_at}
          disabled={disabled}
          onChange={(e) => update('measured_at', e.target.value)}
          className="rounded-none border-0 border-b border-[#D4A592] bg-[#FAF7F5] px-3 py-2 text-sm focus:outline-none focus:ring-0 focus:border-b-2 focus:border-[#C4704A] disabled:opacity-50 disabled:cursor-not-allowed"
        />
      </div>

      {/* Energía general */}
      <div className="bg-terra-50 rounded-lg p-4">
        <p className="text-xs uppercase tracking-wide font-normal text-[#4A3628] mb-3">
          Nivel de energía general
        </p>
        <EnergySlider
          label="Energía general"
          value={value.general_energy}
          onChange={(v) => update('general_energy', v)}
          phase="initial"
          max={14}
          disabled={disabled}
        />
      </div>

      {/* Notas generales */}
      <div className="flex flex-col gap-1">
        <label htmlFor={notesInputId} className="text-xs uppercase tracking-wide font-normal text-[#4A3628]">
          Notas generales
        </label>
        <textarea
          id={notesInputId}
          value={value.notes}
          disabled={disabled}
          onChange={(e) => update('notes', e.target.value)}
          rows={4}
          placeholder="Observaciones generales de la sesión…"
          className="rounded-none border-0 border-b border-[#D4A592] bg-[#FAF7F5] px-3 py-2 text-sm resize-none focus:outline-none focus:ring-0 focus:border-b-2 focus:border-[#C4704A] disabled:opacity-50 disabled:cursor-not-allowed"
        />
      </div>

      {/* ─── Entidades y Bajo Astral ───────────────────────────────────────── */}
      <div className="border-t border-[#D4A592] pt-6 mt-6">
        <p className="font-semibold text-[#2C2220]">Entidades y Bajo Astral</p>
        <p className="text-sm text-terra-500 mt-0.5 mb-5">
          Registra entidades, trabajos de bajo astral e implantes detectados
        </p>

        <div className="space-y-5">
          {/* Entidades */}
          <div className="flex flex-wrap items-center gap-4">
            <span className="text-[13px] uppercase tracking-[0.1em] font-normal text-[#4A3628] w-32 shrink-0">Entidades</span>
            <YesNoPills
              value={value.has_entities}
              onChange={(v) => update('has_entities', v)}
              disabled={disabled}
            />
            <div
              className={`transition-all duration-200 overflow-hidden ${
                value.has_entities === true ? 'max-h-12 opacity-100' : 'max-h-0 opacity-0'
              }`}
            >
              <input
                type="number"
                min={0}
                value={value.entities_count}
                disabled={disabled}
                onChange={(e) => update('entities_count', Math.max(0, parseInt(e.target.value, 10) || 0))}
                className="w-[60px] h-10 text-center text-sm border-0 border-b border-[#D4A592] bg-[#FAF7F5] rounded-none focus:outline-none focus:border-b-2 focus:border-[#C4704A] disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>
          </div>

          {/* Trabajos de bajo astral (DB: has_capas) */}
          <div className="flex flex-wrap items-center gap-4">
            <span className="text-[13px] uppercase tracking-[0.1em] font-normal text-[#4A3628] w-32 shrink-0">Trabajos de bajo astral</span>
            <YesNoPills
              value={value.has_capas}
              onChange={(v) => update('has_capas', v)}
              disabled={disabled}
            />
          </div>

          {/* Implantes */}
          <div className="flex flex-wrap items-center gap-4">
            <span className="text-[13px] uppercase tracking-[0.1em] font-normal text-[#4A3628] w-32 shrink-0">Implantes</span>
            <YesNoPills
              value={value.has_implants}
              onChange={(v) => update('has_implants', v)}
              disabled={disabled}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

export default StepGeneral;
