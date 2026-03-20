'use client';

import { useMemo } from 'react';
import { getChakraColor, getChakraDisplayOrder } from './chakra-colors';

// ─── Constantes SVG ────────────────────────────────────────────────────────────

const MAX = 14;
const R   = 40;          // radio del anillo
const SW  = 8;           // stroke-width del anillo principal
const GSW = 3;           // stroke-width del anillo fantasma (valor inicial)
const CX  = R + SW;      // centro x = centro y = 48
const CIRC = 2 * Math.PI * R; // circunferencia ≈ 251.33
const SIZE = CX * 2;    // tamaño del SVG = 96

// ─── Helpers SVG ──────────────────────────────────────────────────────────────

/** stroke-dashoffset para un arco sólido en escala 0-14. */
function solidOffset(value: number): number {
  return CIRC * (1 - Math.max(0, Math.min(MAX, value)) / MAX);
}

/**
 * stroke-dasharray para un arco discontinuo de longitud proporcional a value.
 * Genera guiones de 6px con huecos de 4px a lo largo del arco,
 * seguidos de un hueco grande que evita la repetición del patrón.
 */
function dashedArcArray(value: number): string {
  const arcLen = CIRC * (Math.max(0, Math.min(MAX, value)) / MAX);
  if (arcLen <= 0) return `0 ${CIRC.toFixed(1)}`;

  const dashSize = 6;
  const gapSize  = 4;
  const unit     = dashSize + gapSize;

  const fullUnits  = Math.floor(arcLen / unit);
  const remainder  = arcLen - fullUnits * unit;
  const trailingGap = CIRC - arcLen;

  const segs: number[] = [];
  for (let i = 0; i < fullUnits; i++) {
    segs.push(dashSize, gapSize);
  }

  if (remainder > 0) {
    const partDash = Math.min(remainder, dashSize);
    const partGap  = trailingGap + Math.max(0, remainder - dashSize);
    segs.push(partDash, partGap);
  } else if (segs.length >= 2) {
    segs[segs.length - 1] += trailingGap;
  } else {
    segs.push(0, trailingGap);
  }

  return segs.map((n) => n.toFixed(1)).join(' ');
}

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface ChakraGaugeReading {
  chakra_position_id: string;
  name: string;
  value: number;
}

export interface ChakraCircularGaugeProps {
  readings: ChakraGaugeReading[];
  onChange: (chakraId: string, value: number) => void;
  disabled?: boolean;
  phase?: 'initial' | 'final';
  /** Solo para fase final: valores iniciales keyed by chakra_position_id. */
  comparisonValues?: Record<string, number>;
  showAnimal?: boolean;
}

// ─── SingleGauge ──────────────────────────────────────────────────────────────

interface SingleGaugeProps {
  reading: ChakraGaugeReading;
  color: string;
  onChange: (id: string, value: number) => void;
  disabled: boolean;
  /** Valor inicial para mostrar como anillo fantasma discontinuo (fase final). */
  ghostValue?: number;
}

function SingleGauge({ reading, color, onChange, disabled, ghostValue }: SingleGaugeProps) {
  const { chakra_position_id: id, name, value } = reading;

  const clamp = (v: number) => Math.max(0, Math.min(MAX, Math.round(v)));

  const offset       = solidOffset(value);
  const ghostDashArr = ghostValue !== undefined ? dashedArcArray(ghostValue) : null;

  return (
    <div className="flex flex-col items-center gap-2">
      {/* Gauge SVG + número editable superpuesto */}
      <div className="relative" style={{ width: SIZE, height: SIZE }}>
        <svg
          width={SIZE}
          height={SIZE}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          aria-hidden="true"
        >
          {/* Pista de fondo: mismo color al 15% */}
          <circle
            cx={CX}
            cy={CX}
            r={R}
            fill="none"
            stroke={color}
            strokeWidth={SW}
            strokeOpacity={0.15}
          />

          {/* Anillo fantasma discontinuo: valor inicial (solo fase final) */}
          {ghostDashArr !== null && (
            <circle
              cx={CX}
              cy={CX}
              r={R}
              fill="none"
              stroke={color}
              strokeWidth={GSW}
              strokeOpacity={0.45}
              strokeDasharray={ghostDashArr}
              strokeLinecap="round"
              transform={`rotate(-90, ${CX}, ${CX})`}
            />
          )}

          {/* Arco principal: valor actual */}
          <circle
            cx={CX}
            cy={CX}
            r={R}
            fill="none"
            stroke={color}
            strokeWidth={SW}
            strokeDasharray={CIRC}
            strokeDashoffset={offset}
            strokeLinecap="round"
            transform={`rotate(-90, ${CX}, ${CX})`}
          />
        </svg>

        {/* Número editable centrado en el gauge */}
        <div className="absolute inset-0 flex items-center justify-center">
          <input
            type="number"
            min={0}
            max={MAX}
            step={1}
            value={value}
            disabled={disabled}
            aria-label={`${name}: valor ${value} de ${MAX}`}
            onChange={(e) => {
              const parsed = parseInt(e.target.value, 10);
              if (!isNaN(parsed)) onChange(id, clamp(parsed));
            }}
            className={[
              'w-9 text-center text-xl font-bold bg-transparent',
              'border-none outline-none p-0 leading-none',
              '[appearance:textfield]',
              '[&::-webkit-outer-spin-button]:appearance-none',
              '[&::-webkit-inner-spin-button]:appearance-none',
              disabled ? 'cursor-default opacity-80' : 'cursor-text',
            ].join(' ')}
            style={{ color }}
          />
        </div>
      </div>

      {/* Botones − y + */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={disabled || value <= 0}
          onClick={() => onChange(id, clamp(value - 1))}
          aria-label={`Disminuir ${name}`}
          className="w-7 h-7 rounded-full flex items-center justify-center text-white text-base font-bold leading-none select-none disabled:opacity-40 active:scale-95 transition-transform"
          style={{ backgroundColor: color }}
        >
          −
        </button>
        <button
          type="button"
          disabled={disabled || value >= MAX}
          onClick={() => onChange(id, clamp(value + 1))}
          aria-label={`Aumentar ${name}`}
          className="w-7 h-7 rounded-full flex items-center justify-center text-white text-base font-bold leading-none select-none disabled:opacity-40 active:scale-95 transition-transform"
          style={{ backgroundColor: color }}
        >
          +
        </button>
      </div>

      {/* Nombre del chakra — Lato 700, 18px, en el color del chakra */}
      <span
        className="text-center leading-tight max-w-[110px]"
        style={{
          color,
          fontFamily: 'Lato, sans-serif',
          fontWeight: 700,
          fontSize: '18px',
        }}
      >
        {name}
      </span>
    </div>
  );
}

// ─── ChakraCircularGauge ──────────────────────────────────────────────────────

/**
 * Grid de medidores circulares SVG para las lecturas de chakras.
 * Escala 0-14 nativa — nunca convertir a 0-100.
 *
 * Layout: 2 cols en móvil/tablet · 4 cols en desktop (xl).
 */
export function ChakraCircularGauge({
  readings,
  onChange,
  disabled = false,
  phase = 'initial',
  comparisonValues,
  showAnimal = false,
}: ChakraCircularGaugeProps) {
  const sorted = useMemo(() => {
    return readings
      .filter((r) => showAnimal || r.name.toLowerCase() !== 'bud')
      .sort((a, b) => getChakraDisplayOrder(a.name) - getChakraDisplayOrder(b.name));
  }, [readings, showAnimal]);

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
      className="grid grid-cols-2 xl:grid-cols-4 gap-6 justify-items-center"
    >
      {sorted.map((reading) => {
        const color = getChakraColor(reading.name);
        const ghostValue =
          phase === 'final' && comparisonValues
            ? comparisonValues[reading.chakra_position_id]
            : undefined;

        return (
          <SingleGauge
            key={reading.chakra_position_id}
            reading={reading}
            color={color}
            onChange={onChange}
            disabled={disabled}
            ghostValue={ghostValue}
          />
        );
      })}
    </div>
  );
}

export default ChakraCircularGauge;
