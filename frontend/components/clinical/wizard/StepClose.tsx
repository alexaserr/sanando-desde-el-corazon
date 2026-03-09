'use client';

import { useId } from 'react';
import type { CloseData, SessionSummary } from './types';

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
      <h3 className="text-sm font-semibold text-[#4A1810] mb-3">
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

export interface StepCloseProps {
  value: CloseData;
  onChange: (field: keyof CloseData, val: string) => void;
  summary: SessionSummary;
  /** Callback para el botón "Cerrar sesión" (dispara el POST /sessions/{id}/close). */
  onCloseSession: () => void;
  disabled?: boolean;
  isClosing?: boolean;
}

export function StepClose({
  value,
  onChange,
  summary,
  onCloseSession,
  disabled = false,
  isClosing = false,
}: StepCloseProps) {
  const costId         = useId();
  const paymentNotesId = useId();
  const entitiesId     = useId();
  const implantsId     = useId();

  return (
    <section aria-labelledby="step-close-heading" className="space-y-6">
      <div>
        <h2
          id="step-close-heading"
          className="text-base font-semibold text-[#4A1810]"
        >
          Cierre de sesión
        </h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Completa los datos de cierre antes de finalizar la sesión.
        </p>
      </div>

      {/* Resumen visual */}
      <SessionSummaryPanel summary={summary} />

      {/* Formulario de cierre */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Costo */}
        <div className="flex flex-col gap-1">
          <label htmlFor={costId} className="text-sm font-medium text-gray-700">
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
              disabled={disabled || isClosing}
              onChange={(e) => onChange('cost', e.target.value)}
              placeholder="0.00"
              className="w-full rounded-md border border-gray-300 pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#4A1810] disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>
        </div>

        {/* Notas de pago */}
        <div className="flex flex-col gap-1">
          <label htmlFor={paymentNotesId} className="text-sm font-medium text-gray-700">
            Notas de pago
          </label>
          <input
            id={paymentNotesId}
            type="text"
            value={value.payment_notes}
            disabled={disabled || isClosing}
            onChange={(e) => onChange('payment_notes', e.target.value)}
            placeholder="Método de pago, referencia…"
            className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#4A1810] disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>

        {/* Entidades */}
        <div className="flex flex-col gap-1">
          <label htmlFor={entitiesId} className="text-sm font-medium text-gray-700">
            Entidades encontradas
          </label>
          <input
            id={entitiesId}
            type="number"
            min={0}
            step={1}
            value={value.entities}
            disabled={disabled || isClosing}
            onChange={(e) => onChange('entities', e.target.value)}
            placeholder="0"
            className="rounded-md border border-gray-300 px-3 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-[#4A1810] disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>

        {/* Implantes */}
        <div className="flex flex-col gap-1">
          <label htmlFor={implantsId} className="text-sm font-medium text-gray-700">
            Implantes encontrados
          </label>
          <input
            id={implantsId}
            type="number"
            min={0}
            step={1}
            value={value.implants}
            disabled={disabled || isClosing}
            onChange={(e) => onChange('implants', e.target.value)}
            placeholder="0"
            className="rounded-md border border-gray-300 px-3 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-[#4A1810] disabled:opacity-50 disabled:cursor-not-allowed"
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
