'use client';

import { useState, useEffect, useCallback, useId } from 'react';

export interface EnergySliderProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label: string;
  phase: 'initial' | 'final';
  compareValue?: number;
  disabled?: boolean;
  showDelta?: boolean;
  /** Mostrar u ocultar visualmente el label (sigue presente para accesibilidad). */
  showLabel?: boolean;
}

// terra-700 — color del thumb del slider (design system SDC)
const THUMB_BORDER = '#8B2E1A';

// Acentos por fase
const PHASE_COLOR: Record<'initial' | 'final', string> = {
  initial: '#4A1810', // terra-900
  final: '#1E5631',   // success
};

// Gradiente energético suave: rosa → durazno → ámbar claro → lima → verde
const TRACK_GRADIENT =
  'linear-gradient(to right, #E8A0A0 0%, #E8C8A0 30%, #E8D8A0 50%, #C8D8A0 70%, #A0C8A0 100%)';

// ─── Delta badge ─────────────────────────────────────────────────────────────

interface DeltaBadgeProps {
  delta: number;
}

function DeltaBadge({ delta }: DeltaBadgeProps) {
  if (delta > 0) {
    return (
      <span
        role="status"
        aria-label={`diferencia positiva ${delta}`}
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
        aria-label={`diferencia negativa ${delta}`}
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
      className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold bg-gray-100 text-gray-500 select-none"
    >
      0
    </span>
  );
}

// ─── EnergySlider ─────────────────────────────────────────────────────────────

export function EnergySlider({
  value,
  onChange,
  min = 0,
  max = 100,
  step,
  label,
  phase,
  compareValue,
  disabled = false,
  showDelta,
  showLabel = true,
}: EnergySliderProps) {
  // useId genera IDs únicos estables en SSR/CSR — React 18+
  const uid = useId();
  // CSS.escape no disponible en todos los entornos SSR; normalizar manualmente
  const sliderId = `es${uid.replace(/[^a-zA-Z0-9-]/g, '-')}`;

  // Paso efectivo: 0.5 si es escala de chakras (max=14), 1 para energía (max=100)
  const effectiveStep = step !== undefined ? step : max === 14 ? 0.5 : 1;

  const phaseColor = PHASE_COLOR[phase];

  const shouldShowDelta =
    compareValue !== undefined && (showDelta !== undefined ? showDelta : true);

  // Redondear a 1 decimal para evitar ruido de punto flotante
  const delta =
    compareValue !== undefined
      ? parseFloat((value - compareValue).toFixed(1))
      : 0;

  // Estado local del input numérico — permite escribir libremente sin snap en cada tecla
  const [inputStr, setInputStr] = useState(String(value));

  // Sincronizar cuando el valor cambia desde fuera (arrastre del slider o actualización del padre)
  useEffect(() => {
    setInputStr(String(value));
  }, [value]);

  const handleSliderChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange(parseFloat(e.target.value));
    },
    [onChange],
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const str = e.target.value;
      setInputStr(str);
      const n = parseFloat(str);
      if (!isNaN(n) && n >= min && n <= max) {
        const snapped = Math.round(n / effectiveStep) * effectiveStep;
        onChange(parseFloat(snapped.toFixed(2)));
      }
    },
    [onChange, min, max, effectiveStep],
  );

  const handleInputBlur = useCallback(() => {
    const n = parseFloat(inputStr);
    if (isNaN(n)) {
      setInputStr(String(value));
    } else {
      const clamped = Math.min(max, Math.max(min, n));
      const snapped = Math.round(clamped / effectiveStep) * effectiveStep;
      const final = parseFloat(snapped.toFixed(2));
      setInputStr(String(final));
      onChange(final);
    }
  }, [inputStr, value, min, max, effectiveStep, onChange]);

  return (
    <div className="flex flex-col gap-1 w-full">
      {/*
        Estilos inline con ID único para el track y thumb del slider nativo.
        Se necesita pseudo-elemento ::-webkit-slider-thumb que no admite
        inline styles; el useId garantiza aislamiento entre instancias.
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
          background: #ffffff;
          border: 2px solid ${THUMB_BORDER};
          box-shadow: 0 1px 3px rgba(0,0,0,0.15);
          margin-top: -7px;
          cursor: ${disabled ? 'not-allowed' : 'pointer'};
          transition: box-shadow 0.15s ease;
        }
        #${sliderId}:not(:disabled)::-webkit-slider-thumb:hover {
          box-shadow: 0 2px 6px rgba(0,0,0,0.22);
        }
        #${sliderId}::-moz-range-thumb {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #ffffff;
          border: 2px solid ${THUMB_BORDER};
          box-shadow: 0 1px 3px rgba(0,0,0,0.15);
          cursor: ${disabled ? 'not-allowed' : 'pointer'};
        }
        #${sliderId}:focus-visible {
          outline: 2px solid ${phaseColor};
          outline-offset: 3px;
          border-radius: 4px;
        }
        #${sliderId}:disabled::-webkit-slider-thumb,
        #${sliderId}:disabled::-moz-range-thumb {
          opacity: 0.55;
          cursor: not-allowed;
        }
      `}</style>

      {/* Fila de label + input numérico + delta */}
      <div className={`flex items-center gap-2 ${showLabel ? 'justify-between' : 'justify-end'}`}>
        {/* Label — siempre presente en el DOM para accesibilidad */}
        <label
          htmlFor={sliderId}
          className={`text-sm font-medium leading-none truncate select-none ${showLabel ? '' : 'sr-only'}`}
          style={showLabel ? { color: phaseColor } : undefined}
        >
          {label}
        </label>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* Input numérico bidireccional */}
          <input
            type="number"
            min={min}
            max={max}
            step={effectiveStep}
            value={inputStr}
            onChange={handleInputChange}
            onBlur={handleInputBlur}
            disabled={disabled}
            aria-label={`${label} valor numérico`}
            className="w-16 h-8 text-center text-sm border border-gray-200 rounded tabular-nums disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:border-terra-500 focus:ring-1 focus:ring-terra-500/20"
          />
          {shouldShowDelta && <DeltaBadge delta={delta} />}
        </div>
      </div>

      {/* Track con gradiente + input range superpuesto */}
      <div
        className="relative flex items-center"
        style={{ minHeight: 44 }}
      >
        {/* Track visual — solo decorativo */}
        <div
          aria-hidden="true"
          className="absolute inset-x-0 rounded-full pointer-events-none"
          style={{
            height: 6,
            top: '50%',
            transform: 'translateY(-50%)',
            background: TRACK_GRADIENT,
            opacity: disabled ? 0.5 : 1,
          }}
        />

        <input
          id={sliderId}
          type="range"
          min={min}
          max={max}
          step={effectiveStep}
          value={value}
          disabled={disabled}
          onChange={handleSliderChange}
          aria-label={label}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={value}
        />
      </div>
    </div>
  );
}

export default EnergySlider;
