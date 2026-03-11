'use client';

import { useState, useRef, useEffect, useId } from 'react';
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
      <label htmlFor={id} className="text-sm font-medium text-gray-700">
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
          className="w-full flex items-center justify-between rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-left shadow-sm focus:outline-none focus:ring-2 focus:ring-[#4A1810] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span className={selected ? 'text-gray-900' : 'text-gray-400'}>
            {selected ? selected.label : placeholder}
          </span>
          <svg
            aria-hidden="true"
            className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
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
            className="absolute z-20 mt-1 w-full rounded-md border border-gray-200 bg-white shadow-lg"
          >
            <div className="p-2 border-b border-gray-100">
              <input
                autoFocus
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar…"
                className="w-full rounded border border-gray-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#4A1810]"
              />
            </div>
            <ul className="max-h-52 overflow-y-auto py-1">
              {isSearching ? (
                <li className="px-3 py-2 text-sm text-gray-400">{loadingMessage}</li>
              ) : visibleOptions.length === 0 ? (
                <li className="px-3 py-2 text-sm text-gray-400">{emptyMessage}</li>
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
                    className={`px-3 py-2 text-sm cursor-pointer select-none hover:bg-gray-50 ${
                      opt.value === value ? 'font-semibold text-[#4A1810] bg-amber-50' : 'text-gray-800'
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
        ? 'px-4 py-1.5 rounded-full text-sm font-medium transition-colors bg-[#4A1810] text-white'
        : 'px-4 py-1.5 rounded-full text-sm font-medium transition-colors bg-gray-100 text-gray-600';
    }
    return 'px-4 py-1.5 rounded-full text-sm font-medium transition-colors border border-gray-200 text-gray-400 hover:border-gray-300';
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
}

export function StepGeneral({
  clients,
  therapyTypes,
  value,
  onChange,
  disabled = false,
  onSearchClients,
}: StepGeneralProps) {
  const clientSelectId   = useId();
  const therapySelectId  = useId();
  const dateInputId      = useId();
  const notesInputId     = useId();

  const clientOptions    = clients.map((c) => ({ value: c.id, label: c.full_name }));
  const therapyOptions   = therapyTypes.map((t) => ({ value: t.id, label: t.name }));

  function update<K extends keyof GeneralData>(field: K, val: GeneralData[K]) {
    onChange({ ...value, [field]: val });
  }

  return (
    <section aria-labelledby="step-general-heading" className="space-y-6">
      <h2
        id="step-general-heading"
        className="text-base font-semibold text-[#4A1810]"
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
        <label htmlFor={dateInputId} className="text-sm font-medium text-gray-700">
          Fecha de medición *
        </label>
        <input
          id={dateInputId}
          type="datetime-local"
          value={value.measured_at}
          disabled={disabled}
          onChange={(e) => update('measured_at', e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#4A1810] disabled:opacity-50 disabled:cursor-not-allowed"
        />
      </div>

      {/* Energía general */}
      <div className="bg-gray-50 rounded-lg p-4">
        <p className="text-sm font-medium text-gray-600 mb-3">
          Nivel de energía general
        </p>
        <EnergySlider
          label="Energía general"
          value={value.general_energy}
          onChange={(v) => update('general_energy', v)}
          phase="initial"
          max={100}
          disabled={disabled}
        />
      </div>

      {/* Notas generales */}
      <div className="flex flex-col gap-1">
        <label htmlFor={notesInputId} className="text-sm font-medium text-gray-700">
          Notas generales
        </label>
        <textarea
          id={notesInputId}
          value={value.notes}
          disabled={disabled}
          onChange={(e) => update('notes', e.target.value)}
          rows={4}
          placeholder="Observaciones generales de la sesión…"
          className="rounded-md border border-gray-300 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#4A1810] disabled:opacity-50 disabled:cursor-not-allowed"
        />
      </div>

      {/* ─── Limpieza y Entidades ──────────────────────────────────────────── */}
      <div className="border-t border-gray-100 pt-6 mt-6">
        <p className="font-semibold text-[#4A1810]">Limpieza y Entidades</p>
        <p className="text-sm text-gray-500 mt-0.5 mb-5">
          Registra la información de limpieza detectada
        </p>

        <div className="space-y-5">
          {/* Entidades */}
          <div className="flex flex-wrap items-center gap-4">
            <span className="text-sm font-medium text-gray-700 w-32 shrink-0">Entidades</span>
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
                className="w-20 h-10 text-center text-sm border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-[#4A1810] disabled:opacity-50"
              />
            </div>
          </div>

          {/* Capas */}
          <div className="flex flex-wrap items-center gap-4">
            <span className="text-sm font-medium text-gray-700 w-32 shrink-0">Capas</span>
            <YesNoPills
              value={value.has_capas}
              onChange={(v) => update('has_capas', v)}
              disabled={disabled}
            />
            <div
              className={`transition-all duration-200 overflow-hidden ${
                value.has_capas === true ? 'max-h-12 opacity-100' : 'max-h-0 opacity-0'
              }`}
            >
              <input
                type="number"
                min={0}
                value={value.capas_count}
                disabled={disabled}
                onChange={(e) => update('capas_count', Math.max(0, parseInt(e.target.value, 10) || 0))}
                className="w-20 h-10 text-center text-sm border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-[#4A1810] disabled:opacity-50"
              />
            </div>
          </div>

          {/* Implantes */}
          <div className="flex flex-wrap items-center gap-4">
            <span className="text-sm font-medium text-gray-700 w-32 shrink-0">Implantes</span>
            <YesNoPills
              value={value.has_implants}
              onChange={(v) => update('has_implants', v)}
              disabled={disabled}
            />
            <div
              className={`transition-all duration-200 overflow-hidden ${
                value.has_implants === true ? 'max-h-12 opacity-100' : 'max-h-0 opacity-0'
              }`}
            >
              <input
                type="number"
                min={0}
                value={value.implants_count}
                disabled={disabled}
                onChange={(e) => update('implants_count', Math.max(0, parseInt(e.target.value, 10) || 0))}
                className="w-20 h-10 text-center text-sm border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-[#4A1810] disabled:opacity-50"
              />
            </div>
          </div>

          {/* Requiere limpiezas */}
          <div className="flex flex-wrap items-center gap-4">
            <span className="text-sm font-medium text-gray-700 w-32 shrink-0">¿Limpiezas?</span>
            <YesNoPills
              value={value.requires_cleanings}
              onChange={(v) => update('requires_cleanings', v)}
              disabled={disabled}
            />
            <div
              className={`transition-all duration-200 overflow-hidden ${
                value.requires_cleanings === true ? 'max-h-12 opacity-100' : 'max-h-0 opacity-0'
              }`}
            >
              <input
                type="number"
                min={0}
                value={value.total_cleanings}
                disabled={disabled}
                onChange={(e) => update('total_cleanings', Math.max(0, parseInt(e.target.value, 10) || 0))}
                className="w-20 h-10 text-center text-sm border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-[#4A1810] disabled:opacity-50"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default StepGeneral;
