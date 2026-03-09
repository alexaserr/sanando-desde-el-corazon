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
}

function Combobox({
  id,
  label,
  options,
  value,
  onChange,
  placeholder = 'Buscar…',
  disabled = false,
}: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);

  const filtered =
    query.trim() === ''
      ? options
      : options.filter((o) =>
          o.label.toLowerCase().includes(query.toLowerCase()),
        );

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
              {filtered.length === 0 ? (
                <li className="px-3 py-2 text-sm text-gray-400">Sin resultados</li>
              ) : (
                filtered.map((opt) => (
                  <li
                    key={opt.value}
                    role="option"
                    aria-selected={opt.value === value}
                    onClick={() => {
                      onChange(opt.value);
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

// ─── StepGeneral ──────────────────────────────────────────────────────────────

export interface StepGeneralProps {
  clients: ClientOption[];
  therapyTypes: TherapyTypeOption[];
  value: GeneralData;
  onChange: (value: GeneralData) => void;
  disabled?: boolean;
}

export function StepGeneral({
  clients,
  therapyTypes,
  value,
  onChange,
  disabled = false,
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
    </section>
  );
}

export default StepGeneral;
