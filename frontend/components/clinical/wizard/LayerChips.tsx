'use client';

import { CAPAS_OPTIONS } from '@/lib/data/cleaning-catalogs';
import type { LayerEntry } from './types';

export interface LayerChipsProps {
  layers: LayerEntry[];
  onChange: (layers: LayerEntry[]) => void;
  disabled?: boolean;
}

const SIN_CAPAS_VALUE = 'sin_capas';

export function LayerChips({ layers, onChange, disabled = false }: LayerChipsProps) {
  const hasSinCapas = layers.some((l) => l.type === SIN_CAPAS_VALUE);

  function toggle(value: LayerEntry['type']) {
    if (value === SIN_CAPAS_VALUE) {
      if (hasSinCapas) {
        onChange(layers.filter((l) => l.type !== SIN_CAPAS_VALUE));
      } else {
        // Mutually exclusive: clear all others
        onChange([{ type: SIN_CAPAS_VALUE, quantity: 0 }]);
      }
      return;
    }
    // Any other chip deselects "sin capas"
    const withoutSinCapas = layers.filter((l) => l.type !== SIN_CAPAS_VALUE);
    const exists = withoutSinCapas.find((l) => l.type === value);
    if (exists) {
      onChange(withoutSinCapas.filter((l) => l.type !== value));
    } else {
      onChange([...withoutSinCapas, { type: value, quantity: 1 }]);
    }
  }

  function updateQuantity(value: LayerEntry['type'], qty: number) {
    onChange(
      layers.map((l) => (l.type === value ? { ...l, quantity: Math.max(0, qty) } : l)),
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {CAPAS_OPTIONS.map((opt) => {
        const entry = layers.find((l) => l.type === opt.value);
        const isActive = !!entry;
        const isSinCapas = opt.value === SIN_CAPAS_VALUE;
        const isOtherDisabled = !isSinCapas && hasSinCapas;

        return (
          <div key={opt.value} className="flex items-center">
            <button
              type="button"
              disabled={disabled || isOtherDisabled}
              onClick={() => toggle(opt.value)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium border transition-colors select-none ${
                isActive
                  ? 'bg-[#FAEEDA] border-[#BA7517] text-[#854F0B]'
                  : 'bg-[#FAF7F5] border-gray-300 text-gray-500'
              } ${
                disabled || isOtherDisabled
                  ? 'opacity-40 cursor-not-allowed'
                  : 'cursor-pointer hover:border-[#BA7517]/60'
              }`}
              style={{ minHeight: 36, borderRadius: 13 }}
            >
              {opt.label}
              {isActive && !isSinCapas && (
                <span className="text-[#854F0B]">&times;</span>
              )}
            </button>

            {/* Inline quantity input */}
            {isActive && !isSinCapas && (
              <input
                type="number"
                min={0}
                value={entry.quantity}
                disabled={disabled}
                onChange={(e) =>
                  updateQuantity(opt.value, parseInt(e.target.value, 10) || 0)
                }
                className="ml-1 h-8 w-[40px] rounded border border-[#BA7517]/40 bg-[#FAEEDA] px-1 text-center text-sm text-[#854F0B] focus:outline-none focus:ring-0 focus:border-[#BA7517] disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label={`Cantidad ${opt.label}`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default LayerChips;
