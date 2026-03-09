'use client';

import { useMemo } from 'react';
import { EnergySlider } from './EnergySlider';
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
      className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold bg-gray-100 text-gray-500 select-none"
    >
      0
    </span>
  );
}

// ─── Card simple (sin comparativa) ───────────────────────────────────────────

interface SimpleCardProps {
  reading: ChakraReading;
  color: string;
  onChange: (id: string, value: number) => void;
  phase: 'initial' | 'final';
  disabled: boolean;
}

function SimpleCard({ reading, color, onChange, phase, disabled }: SimpleCardProps) {
  return (
    <div
      className="bg-white rounded-lg p-4 shadow-sm border border-gray-100"
      style={{ borderLeftWidth: 4, borderLeftColor: color }}
    >
      <p
        className="text-sm font-semibold mb-3"
        style={{ color }}
      >
        {reading.name}
      </p>
      <EnergySlider
        label={reading.name}
        value={reading.value}
        onChange={(v) => onChange(reading.chakra_position_id, v)}
        phase={phase}
        max={14}
        step={0.5}
        disabled={disabled}
      />
    </div>
  );
}

// ─── Card comparativa (Inicial | Final) ──────────────────────────────────────

interface CompareCardProps {
  reading: ChakraReading;
  compareValue: number | undefined;
  color: string;
  onChange: (id: string, value: number) => void;
  phase: 'initial' | 'final';
  disabled: boolean;
}

function CompareCard({
  reading,
  compareValue,
  color,
  onChange,
  phase,
  disabled,
}: CompareCardProps) {
  // Determinar qué valor va en Inicial y cuál en Final según la fase activa
  const initialValue = phase === 'initial' ? reading.value : (compareValue ?? 0);
  const finalValue   = phase === 'final'   ? reading.value : (compareValue ?? 0);
  const delta = parseFloat((finalValue - initialValue).toFixed(1));

  const initialDisabled = phase !== 'initial' || disabled;
  const finalDisabled   = phase !== 'final'   || disabled;

  return (
    <div
      className="bg-white rounded-lg p-4 shadow-sm border border-gray-100"
      style={{ borderLeftWidth: 4, borderLeftColor: color }}
    >
      {/* Cabecera: nombre + delta */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <p className="text-sm font-semibold" style={{ color }}>
          {reading.name}
        </p>
        <DeltaBadge delta={delta} />
      </div>

      {/*
        Tres columnas: Inicial | badge delta | Final
        En iPad 10.9" (768px+) esto es cómodo lado a lado.
      */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-x-2">
        {/* Inicial */}
        <div>
          <p className="text-xs font-medium text-gray-400 mb-1 select-none">
            Inicial
          </p>
          <EnergySlider
            label={`${reading.name} - Inicial`}
            value={initialValue}
            onChange={
              phase === 'initial'
                ? (v) => onChange(reading.chakra_position_id, v)
                : () => undefined
            }
            phase="initial"
            max={14}
            step={0.5}
            disabled={initialDisabled}
          />
        </div>

        {/* Delta badge centrado verticalmente */}
        <div className="flex items-center justify-center pt-6">
          <span
            aria-hidden="true"
            className="text-gray-300 text-base select-none"
          >
            ↔
          </span>
        </div>

        {/* Final */}
        <div>
          <p className="text-xs font-medium text-gray-400 mb-1 select-none">
            Final
          </p>
          <EnergySlider
            label={`${reading.name} - Final`}
            value={finalValue}
            onChange={
              phase === 'final'
                ? (v) => onChange(reading.chakra_position_id, v)
                : () => undefined
            }
            phase="final"
            max={14}
            step={0.5}
            disabled={finalDisabled}
          />
        </div>
      </div>
    </div>
  );
}

// ─── ChakraGrid ───────────────────────────────────────────────────────────────

/**
 * Grid presentacional de lecturas de chakras.
 * No hace fetch — recibe datos por props y los pasa al wizard de sesión.
 *
 * Layout: 1 col móvil / 2 col tablet / 4 col desktop (prioridad iPad 10.9").
 * Escala de chakras: 0-14 nativa (NO convertir a 0-100).
 */
export function ChakraGrid({
  readings,
  onChange,
  phase,
  compareReadings,
  disabled = false,
  showAnimal = false,
}: ChakraGridProps) {
  // Ordenar según orden canónico y filtrar Bud si no es sesión animal
  const sorted = useMemo(() => {
    return readings
      .filter((r) => {
        if (!showAnimal && r.name.toLowerCase() === 'bud') return false;
        return true;
      })
      .sort((a, b) => getChakraDisplayOrder(a.name) - getChakraDisplayOrder(b.name));
  }, [readings, showAnimal]);

  // Índice de compareReadings por chakra_position_id para O(1) lookup
  const compareMap = useMemo<Map<string, number>>(() => {
    if (!compareReadings) return new Map();
    return new Map(compareReadings.map((r) => [r.chakra_position_id, r.value]));
  }, [compareReadings]);

  if (sorted.length === 0) {
    return (
      <p className="text-sm text-gray-400 text-center py-6">
        No hay lecturas de chakras registradas.
      </p>
    );
  }

  return (
    <div
      role="group"
      aria-label={`Chakras — fase ${phase === 'initial' ? 'inicial' : 'final'}`}
      className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4"
    >
      {sorted.map((reading) => {
        const color = getChakraColor(reading.name);
        const hasCompare = compareReadings !== undefined;

        if (hasCompare) {
          return (
            <CompareCard
              key={reading.chakra_position_id}
              reading={reading}
              compareValue={compareMap.get(reading.chakra_position_id)}
              color={color}
              onChange={onChange}
              phase={phase}
              disabled={disabled}
            />
          );
        }

        return (
          <SimpleCard
            key={reading.chakra_position_id}
            reading={reading}
            color={color}
            onChange={onChange}
            phase={phase}
            disabled={disabled}
          />
        );
      })}
    </div>
  );
}

export default ChakraGrid;
