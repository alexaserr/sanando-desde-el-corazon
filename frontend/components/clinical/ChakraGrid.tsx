'use client';

import { useMemo, useState, useEffect, useCallback, useId } from 'react';
import { getChakraColor, getChakraDisplayOrder } from './chakra-colors';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface ChakraReading {
  chakra_position_id: string;
  name: string;
  value: number;
}

export interface CompareReading {
  chakra_position_id: string;
  value: number;
}

export interface ChakraGridProps {
  readings: ChakraReading[];
  onChange: (chakra_position_id: string, value: number) => void;
  phase: 'initial' | 'final';
  compareReadings?: CompareReading[];
  disabled?: boolean;
  showAnimal?: boolean;
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ─── Delta badge ──────────────────────────────────────────────────────────────

function DeltaBadge({ delta }: { delta: number }) {
  if (delta > 0) {
    return (
      <span
        role="status"
        aria-label={`diferencia +${delta}`}
        className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold bg-green-100 text-green-700 select-none"
      >
        +{delta}
      </span>
    );
  }
  if (delta < 0) {
    return (
      <span
        role="status"
        aria-label={`diferencia ${delta}`}
        className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold bg-red-100 text-red-700 select-none"
      >
        {delta}
      </span>
    );
  }
  return (
    <span
      role="status"
      aria-label="sin diferencia"
      className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold bg-terra-100 text-terra-500 select-none"
    >
      0
    </span>
  );
}

// ─── ChakraSlider — slider horizontal con color propio del chakra ─────────────

interface ChakraSliderProps {
  reading: ChakraReading;
  color: string;
  onChange: (id: string, value: number) => void;
  disabled: boolean;
  /** Valor inicial del chakra (para fase final: muestra badge + delta). */
  compareValue?: number;
  phase: 'initial' | 'final';
}

function ChakraSlider({
  reading,
  color,
  onChange,
  disabled,
  compareValue,
  phase,
}: ChakraSliderProps) {
  const uid = useId();
  const sliderId = `cs${uid.replace(/[^a-zA-Z0-9-]/g, '-')}`;

  // Gradiente: chakra color al 15% → color pleno
  const trackGradient = `linear-gradient(to right, ${hexToRgba(color, 0.15)} 0%, ${color} 100%)`;

  const [inputStr, setInputStr] = useState(String(reading.value));

  useEffect(() => {
    setInputStr(String(reading.value));
  }, [reading.value]);

  const handleSliderChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange(reading.chakra_position_id, parseFloat(e.target.value));
    },
    [onChange, reading.chakra_position_id],
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const str = e.target.value;
      setInputStr(str);
      const n = parseFloat(str);
      if (!isNaN(n) && n >= 0 && n <= 14) {
        const snapped = Math.round(n / 0.5) * 0.5;
        onChange(reading.chakra_position_id, parseFloat(snapped.toFixed(1)));
      }
    },
    [onChange, reading.chakra_position_id],
  );

  const handleInputBlur = useCallback(() => {
    const n = parseFloat(inputStr);
    if (isNaN(n)) {
      setInputStr(String(reading.value));
    } else {
      const clamped = Math.min(14, Math.max(0, n));
      const snapped = Math.round(clamped / 0.5) * 0.5;
      const final = parseFloat(snapped.toFixed(1));
      setInputStr(String(final));
      onChange(reading.chakra_position_id, final);
    }
  }, [inputStr, reading.value, reading.chakra_position_id, onChange]);

  const hasDelta = phase === 'final' && compareValue !== undefined;
  const delta = hasDelta ? parseFloat((reading.value - compareValue!).toFixed(1)) : 0;

  return (
    <div className="flex flex-col gap-1 w-full">
      {/*
        Estilos inline con ID único para thumb/track.
        ::-webkit-slider-thumb no acepta inline styles; useId garantiza aislamiento.
      */}
      <style>{`
        #${sliderId} {
          -webkit-appearance: none;
          appearance: none;
          background: transparent;
          width: 100%;
          min-height: 44px;
          cursor: ${disabled ? 'not-allowed' : 'pointer'};
        }
        #${sliderId}::-webkit-slider-runnable-track {
          background: transparent;
          height: 6px;
        }
        #${sliderId}::-moz-range-track {
          background: transparent;
          height: 6px;
          border: none;
        }
        #${sliderId}::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: ${color};
          border: 2px solid #ffffff;
          box-shadow: 0 2px 6px rgba(54,32,23,0.30);
          margin-top: -7px;
          cursor: ${disabled ? 'not-allowed' : 'pointer'};
          transition: transform 0.15s ease, box-shadow 0.15s ease;
        }
        #${sliderId}:not(:disabled)::-webkit-slider-thumb:hover {
          transform: scale(1.1);
          box-shadow: 0 3px 10px rgba(54,32,23,0.40);
        }
        #${sliderId}::-moz-range-thumb {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: ${color};
          border: 2px solid #ffffff;
          box-shadow: 0 2px 6px rgba(54,32,23,0.30);
          cursor: ${disabled ? 'not-allowed' : 'pointer'};
        }
        #${sliderId}:focus-visible {
          outline: 2px solid ${color};
          outline-offset: 3px;
          border-radius: 4px;
        }
        #${sliderId}:disabled::-webkit-slider-thumb,
        #${sliderId}:disabled::-moz-range-thumb {
          opacity: 0.55;
          cursor: not-allowed;
        }
      `}</style>

      {/* Fila: nombre del chakra + badge Inicial (fase final) + input + delta */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <label
            htmlFor={sliderId}
            className="truncate select-none"
            style={{
              color,
              fontFamily: 'Lato, system-ui, sans-serif',
              fontSize: 16,
              fontWeight: 700,
            }}
          >
            {reading.name}
          </label>
          {phase === 'final' && compareValue !== undefined && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-terra-100 text-terra-600 select-none shrink-0 whitespace-nowrap">
              Inicial: {compareValue}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <input
            type="number"
            min={0}
            max={14}
            step={0.5}
            value={inputStr}
            onChange={handleInputChange}
            onBlur={handleInputBlur}
            disabled={disabled}
            aria-label={`${reading.name} valor numérico`}
            className="w-16 h-8 text-center text-sm border border-terra-200 rounded-md tabular-nums disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:border-terra-700 focus:ring-1 focus:ring-terra-700/20"
          />
          {hasDelta && <DeltaBadge delta={delta} />}
        </div>
      </div>

      {/* Track decorativo + input range superpuesto */}
      <div className="relative flex items-center" style={{ minHeight: 44 }}>
        <div
          aria-hidden="true"
          className="absolute inset-x-0 rounded-full pointer-events-none"
          style={{
            height: 6,
            top: '50%',
            transform: 'translateY(-50%)',
            background: trackGradient,
            opacity: disabled ? 0.5 : 1,
          }}
        />
        <input
          id={sliderId}
          type="range"
          min={0}
          max={14}
          step={0.5}
          value={reading.value}
          disabled={disabled}
          onChange={handleSliderChange}
          aria-label={reading.name}
          aria-valuemin={0}
          aria-valuemax={14}
          aria-valuenow={reading.value}
        />
      </div>
    </div>
  );
}

// ─── ChakraGrid ───────────────────────────────────────────────────────────────

/**
 * Grid de lecturas de chakras con sliders horizontales de color propio.
 * No hace fetch — recibe datos por props y los pasa al wizard de sesión.
 *
 * Layout: 1 col móvil / 2 col desktop. Escala 0-14 nativa (step 0.5).
 */
export function ChakraGrid({
  readings,
  onChange,
  phase,
  compareReadings,
  disabled = false,
  showAnimal = false,
}: ChakraGridProps) {
  const sorted = useMemo(() => {
    return readings
      .filter((r) => {
        if (!showAnimal && r.name.toLowerCase() === 'bud') return false;
        return true;
      })
      .sort((a, b) => getChakraDisplayOrder(a.name) - getChakraDisplayOrder(b.name));
  }, [readings, showAnimal]);

  const compareMap = useMemo<Map<string, number>>(() => {
    if (!compareReadings) return new Map();
    return new Map(compareReadings.map((r) => [r.chakra_position_id, r.value]));
  }, [compareReadings]);

  if (sorted.length === 0) {
    return (
      <p className="text-sm text-terra-400 text-center py-6">
        No hay lecturas de chakras registradas.
      </p>
    );
  }

  return (
    <div
      role="group"
      aria-label={`Chakras — fase ${phase === 'initial' ? 'inicial' : 'final'}`}
      className="grid grid-cols-1 md:grid-cols-2 gap-4"
    >
      {sorted.map((reading) => {
        const color = getChakraColor(reading.name);
        const compareValue = compareMap.get(reading.chakra_position_id);
        return (
          <div
            key={reading.chakra_position_id}
            className="bg-white rounded-xl p-4 shadow-sm border border-terra-100"
            style={{ borderLeftWidth: 3, borderLeftColor: color }}
          >
            <ChakraSlider
              reading={reading}
              color={color}
              onChange={onChange}
              disabled={disabled}
              compareValue={compareValue}
              phase={phase}
            />
          </div>
        );
      })}
    </div>
  );
}

export default ChakraGrid;
