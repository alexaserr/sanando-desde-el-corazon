'use client';

import { useEffect, useRef, useState } from 'react';
import { X, ChevronDown } from 'lucide-react';

export interface SearchableComboboxProps {
  options: readonly string[];
  value: string | string[];
  onChange: (val: string | string[]) => void;
  multiple?: boolean;
  placeholder?: string;
  disabled?: boolean;
}

export function SearchableCombobox({
  options,
  value,
  onChange,
  multiple = false,
  placeholder = '— Seleccionar —',
  disabled = false,
}: SearchableComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    }
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const selectedArr: string[] = Array.isArray(value) ? value : value ? [value] : [];
  const filtered = options.filter(
    (o) => o.toLowerCase().includes(query.toLowerCase()),
  );

  function select(item: string) {
    if (multiple) {
      const arr = selectedArr.includes(item)
        ? selectedArr.filter((x) => x !== item)
        : [...selectedArr, item];
      onChange(arr);
    } else {
      onChange(item);
      setOpen(false);
      setQuery('');
    }
  }

  function remove(item: string) {
    if (multiple) {
      onChange(selectedArr.filter((x) => x !== item));
    } else {
      onChange('');
    }
  }

  const displayLabel = multiple
    ? selectedArr.length === 0
      ? placeholder
      : `${selectedArr.length} seleccionado${selectedArr.length > 1 ? 's' : ''}`
    : selectedArr[0] || placeholder;

  return (
    <div ref={ref} className="relative w-full">
      {/* Trigger */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          setOpen((p) => !p);
          setTimeout(() => inputRef.current?.focus(), 0);
        }}
        className="flex min-h-[44px] w-full items-center justify-between gap-1 rounded-none border-0 border-b border-[#D4A592] bg-[#FAF7F5] px-2.5 py-1.5 text-sm text-left focus:outline-none focus:ring-0 focus:border-b-2 focus:border-[#C4704A] disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span className={`truncate ${selectedArr.length === 0 ? 'text-gray-400' : 'text-gray-800'}`}>
          {displayLabel}
        </span>
        <ChevronDown
          size={14}
          className={`shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className="absolute z-50 mt-1 w-full min-w-[220px] rounded bg-white border border-[#EDE5E0]"
          style={{ boxShadow: '0 2px 8px rgba(44,34,32,0.06)', maxHeight: 200 }}
        >
          {/* Search input */}
          <div className="p-1.5">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar..."
              className="h-9 w-full rounded border border-[#EDE5E0] bg-[#FAF7F5] px-2.5 text-sm focus:outline-none focus:ring-0 focus:border-[#C4704A]"
            />
          </div>

          {/* Options list */}
          <div className="max-h-[160px] overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <p className="px-3 py-2 text-xs text-gray-400">Sin resultados</p>
            ) : (
              filtered.map((o) => {
                const isSelected = selectedArr.includes(o);
                return (
                  <button
                    key={o}
                    type="button"
                    onClick={() => select(o)}
                    className={`flex w-full items-center gap-2 px-3 py-1.5 text-sm text-left hover:bg-[#FAF7F5] transition-colors ${
                      isSelected ? 'font-medium text-[#C4704A]' : 'text-[#2C2220]'
                    }`}
                    style={{ minHeight: 36 }}
                  >
                    {multiple && (
                      <span
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                          isSelected
                            ? 'border-[#C4704A] bg-[#C4704A] text-white'
                            : 'border-[#C4A98A]'
                        }`}
                      >
                        {isSelected && (
                          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                            <path d="M2 5l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </span>
                    )}
                    {o}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Selected chips (multiple mode) */}
      {multiple && selectedArr.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {selectedArr.slice(0, 4).map((item) => (
            <span
              key={item}
              className="inline-flex items-center gap-1 rounded-full bg-terra-200 px-2 py-0.5 text-xs text-terra-900"
            >
              {item}
              {!disabled && (
                <button
                  type="button"
                  onClick={() => remove(item)}
                  className="ml-0.5 rounded-full p-0.5 hover:bg-terra-300 transition-colors"
                  aria-label={`Quitar ${item}`}
                >
                  <X size={10} />
                </button>
              )}
            </span>
          ))}
          {selectedArr.length > 4 && (
            <span
              className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
              title={selectedArr.slice(4).join(', ')}
            >
              +{selectedArr.length - 4} más
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export default SearchableCombobox;
