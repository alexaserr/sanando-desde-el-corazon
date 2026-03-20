'use client';

import { useId, useEffect, useState, useMemo } from 'react';
import type { CloseData, SessionSummary } from './types';

// ─── Catálogo de precios por tipo de terapia ──────────────────────────────────

const PRICE_CATALOG: Record<string, number> = {
  'Sanación Energética':               1300,
  'Sanación Energética a Distancia':   1300,
  'Terapia LNT':                       1300,
  'Limpieza Energética':               1300,
  'Lectura de Aura':                   1300,
  'Medicina Cuántica':                 1600,
  'Extracción de Energías Densas':     2200,
  'Armonización Energética y Mandala': 2300,
  'Recuperación del Alma':             1700,
  'Despacho':                          2500,
};

// ─── Fila del resumen ─────────────────────────────────────────────────────────

function SummaryRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm font-medium text-gray-800">{value}</span>
    </div>
  );
}

// ─── Panel de resumen de sesión ───────────────────────────────────────────────

interface SessionSummaryPanelProps {
  summary: SessionSummary;
}

function SessionSummaryPanel({ summary }: SessionSummaryPanelProps) {
  // Formatear fecha legible
  const formattedDate = summary.measuredAt
    ? new Intl.DateTimeFormat('es-MX', {
        dateStyle: 'long',
        timeStyle: 'short',
      }).format(new Date(summary.measuredAt.replace('T', ' ')))
    : '—';

  const energyDeltaLabel = (() => {
    if (summary.energyInitialAvg === null || summary.energyFinalAvg === null) return '—';
    const delta = summary.energyFinalAvg - summary.energyInitialAvg;
    const sign  = delta > 0 ? '+' : '';
    return `${summary.energyInitialAvg} → ${summary.energyFinalAvg} (${sign}${delta})`;
  })();

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
      <h3 className="text-sm font-semibold text-[#2C2220] mb-3">
        Resumen de la sesión
      </h3>
      <div className="divide-y divide-gray-100">
        <SummaryRow label="Cliente"        value={summary.clientName || '—'} />
        <SummaryRow label="Tipo de terapia" value={summary.therapyTypeName || '—'} />
        <SummaryRow label="Fecha"           value={formattedDate} />
        <SummaryRow
          label="Energía general inicial"
          value={summary.generalEnergy}
        />
        <SummaryRow label="Evolución energética" value={energyDeltaLabel} />
        <SummaryRow
          label="Temas trabajados"
          value={summary.topicsCount}
        />
        <SummaryRow
          label="Chakras medidos"
          value={
            summary.chakraInitialCount > 0
              ? `${summary.chakraInitialCount} inicial / ${summary.chakraFinalCount} final`
              : '—'
          }
        />
      </div>
    </div>
  );
}

// ─── StepClose ────────────────────────────────────────────────────────────────

// ─── Helpers de formato ──────────────────────────────────────────────────────

function formatMXN(amount: number): string {
  return amount.toLocaleString('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// ─── Props ───────────────────────────────────────────────────────────────────

export interface StepCloseProps {
  value: CloseData;
  onChange: (field: keyof CloseData, val: string) => void;
  summary: SessionSummary;
  /** Callback para el botón "Cerrar sesión" (dispara el POST /sessions/{id}/close). */
  onCloseSession: () => void;
  disabled?: boolean;
  isClosing?: boolean;
  /** true cuando la terapia es "Limpieza Energética" o StepCleaning fue inyectado. */
  isCleaningSession?: boolean;
  /** Número de limpiezas requeridas (de StepCleaning). */
  limpiezasRequeridas?: number;
}

export function StepClose({
  value,
  onChange,
  summary,
  onCloseSession,
  disabled = false,
  isClosing = false,
  isCleaningSession = false,
  limpiezasRequeridas = 0,
}: StepCloseProps) {
  const costId         = useId();
  const paymentNotesId = useId();

  // ─── Estado del cálculo de limpieza ──────────────────────────────────────────
  const [porcentajePago, setPorcentajePago] = useState(100);
  const [incluyeIva, setIncluyeIva]         = useState(false);

  const therapyBasePrice   = PRICE_CATALOG[summary.therapyTypeName] ?? 0;
  const cleaningSurcharge  = limpiezasRequeridas * 1300;
  const costoBase          = therapyBasePrice + cleaningSurcharge;
  const costoAjustado      = costoBase * (porcentajePago / 100);
  const costoFinal         = incluyeIva ? costoAjustado * 1.16 : costoAjustado;

  // Sincronizar costo final de limpieza con el campo cost del formulario
  useEffect(() => {
    if (isCleaningSession) {
      onChange('cost', String(Math.round(costoFinal * 100) / 100));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [costoFinal, isCleaningSession]);

  // Auto-rellenar el costo al entrar al paso 7 o al cambiar el tipo de terapia (solo no-limpieza)
  const suggestedPrice = PRICE_CATALOG[summary.therapyTypeName];
  useEffect(() => {
    if (isCleaningSession) return;
    const price = PRICE_CATALOG[summary.therapyTypeName];
    if (price !== undefined && (value.cost === '' || value.cost === '0')) {
      onChange('cost', String(price));
    }
    // Solo ejecutar cuando cambia el tipo de terapia, no en cada cambio de costo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [summary.therapyTypeName, isCleaningSession]);

  return (
    <section aria-labelledby="step-close-heading" className="space-y-6">
      <div>
        <h2
          id="step-close-heading"
          className="text-base font-semibold text-[#2C2220]"
        >
          Cierre de sesión
        </h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Completa los datos de cierre antes de finalizar la sesión.
        </p>
      </div>

      {/* Resumen visual */}
      <SessionSummaryPanel summary={summary} />

      {/* Cálculo de Limpieza (solo para sesiones de limpieza) */}
      {isCleaningSession && (
        <div className="bg-white border border-gray-200 rounded-lg p-5 space-y-4">
          <h3 className="text-sm font-semibold text-[#2C2220]">
            Cálculo de Limpieza
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Costo de la cita */}
            <div className="flex flex-col gap-1">
              <span className="text-sm text-gray-500">Costo de la cita</span>
              <span className="text-sm font-medium text-gray-800">{formatMXN(therapyBasePrice)}</span>
            </div>

            {/* Costo de limpiezas */}
            <div className="flex flex-col gap-1">
              <span className="text-sm text-gray-500">Costo de limpiezas ({limpiezasRequeridas} × $1,300)</span>
              <span className="text-sm font-medium text-gray-800">{formatMXN(cleaningSurcharge)}</span>
            </div>
          </div>

          {/* Subtotal */}
          <div className="flex items-center justify-between py-2 border-b border-gray-100">
            <span className="text-sm text-gray-500">Subtotal</span>
            <span className="text-sm font-semibold text-gray-800">{formatMXN(costoBase)}</span>
          </div>

          {/* Porcentaje que puede pagar — slider */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Porcentaje que puede pagar</span>
              <span className="text-sm font-semibold text-[#2C2220]">{porcentajePago}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={porcentajePago}
              disabled={disabled || isClosing}
              onChange={(e) => setPorcentajePago(Number(e.target.value))}
              className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-[#2C2220] disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: `linear-gradient(to right, #2C2220 0%, #C4704A ${porcentajePago}%, #e5e7eb ${porcentajePago}%)`,
              }}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Costo ajustado */}
            <div className="flex flex-col gap-1">
              <span className="text-sm text-gray-500">Costo ajustado</span>
              <span className="text-sm font-medium text-gray-800">{formatMXN(costoAjustado)}</span>
            </div>

            {/* +IVA toggle */}
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-500">+IVA</span>
              <button
                type="button"
                role="switch"
                aria-checked={incluyeIva}
                disabled={disabled || isClosing}
                onClick={() => setIncluyeIva((prev) => !prev)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[#2C2220] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                  incluyeIva ? 'bg-[#2C2220]' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition-transform duration-200 ${
                    incluyeIva ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Costo final */}
          <div className="flex items-center justify-between pt-2 border-t border-gray-100">
            <span className="text-sm text-gray-500">Costo final</span>
            <span className="text-2xl font-bold text-[#2C2220]">{formatMXN(costoFinal)}</span>
          </div>
        </div>
      )}

      {/* Formulario de cierre */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Costo */}
        <div className="flex flex-col gap-1">
          <label htmlFor={costId} className="text-xs uppercase tracking-wide font-normal text-[#4A3628]">
            Costo de la sesión (MXN)
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 pointer-events-none">
              $
            </span>
            <input
              id={costId}
              type="number"
              min={0}
              step={0.01}
              value={value.cost}
              disabled={disabled || isClosing || isCleaningSession}
              onChange={(e) => onChange('cost', e.target.value)}
              placeholder="0.00"
              className="w-full rounded-none border-0 border-b border-[#D4A592] bg-[#FAF7F5] pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-0 focus:border-b-2 focus:border-[#C4704A] disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>
          {!isCleaningSession && suggestedPrice !== undefined && (
            <p className="text-xs text-gray-400 mt-0.5">
              Precio sugerido: ${suggestedPrice.toLocaleString('es-MX')} MXN
            </p>
          )}
          {isCleaningSession && (
            <p className="text-xs text-gray-400 mt-0.5">
              Calculado automáticamente desde la sección de limpieza
            </p>
          )}
        </div>

        {/* Notas de pago */}
        <div className="flex flex-col gap-1">
          <label htmlFor={paymentNotesId} className="text-xs uppercase tracking-wide font-normal text-[#4A3628]">
            Notas de pago
          </label>
          <input
            id={paymentNotesId}
            type="text"
            value={value.payment_notes}
            disabled={disabled || isClosing}
            onChange={(e) => onChange('payment_notes', e.target.value)}
            placeholder="Método de pago, referencia…"
            className="rounded-none border-0 border-b border-[#D4A592] bg-[#FAF7F5] px-3 py-2 text-sm focus:outline-none focus:ring-0 focus:border-b-2 focus:border-[#C4704A] disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>
      </div>

      {/* Botón de cierre — ocupa todo el ancho, llamativo */}
      <div className="pt-2">
        <button
          type="button"
          onClick={onCloseSession}
          disabled={disabled || isClosing}
          className="w-full flex items-center justify-center gap-2 rounded-lg bg-[#1E5631] px-4 py-3 text-sm font-semibold text-white hover:bg-[#174926] focus:outline-none focus:ring-2 focus:ring-[#1E5631] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isClosing ? (
            <>
              <svg
                aria-hidden="true"
                className="w-4 h-4 animate-spin"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                />
              </svg>
              Cerrando sesión…
            </>
          ) : (
            <>
              <svg
                aria-hidden="true"
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              Cerrar sesión
            </>
          )}
        </button>
        <p className="text-xs text-gray-400 text-center mt-2">
          Esta acción es irreversible. Verifica los datos antes de confirmar.
        </p>
      </div>
    </section>
  );
}

export default StepClose;
