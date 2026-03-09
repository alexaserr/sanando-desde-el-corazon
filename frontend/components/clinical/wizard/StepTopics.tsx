'use client';

import { useId } from 'react';
import { EnergySlider } from '../EnergySlider';
import type { Topic, SourceType } from './types';

// ─── TopicCard ────────────────────────────────────────────────────────────────

interface TopicCardProps {
  topic: Topic;
  index: number;
  onChange: (localId: string, updates: Partial<Omit<Topic, '_localId'>>) => void;
  onRemove: (localId: string) => void;
  disabled: boolean;
}

function TopicCard({ topic, index, onChange, onRemove, disabled }: TopicCardProps) {
  const headingId   = useId();
  const zoneId      = useId();
  const adultThemeId = useId();
  const childThemeId = useId();
  const adultAgeId  = useId();
  const childAgeId  = useId();
  const emotionsId  = useId();

  function update<K extends keyof Omit<Topic, '_localId'>>(
    field: K,
    value: Omit<Topic, '_localId'>[K],
  ) {
    onChange(topic._localId, { [field]: value });
  }

  return (
    <article
      aria-labelledby={headingId}
      className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden"
    >
      {/* Cabecera */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-100">
        <h3 id={headingId} className="text-sm font-semibold text-gray-700">
          Tema {index + 1}
        </h3>

        {/* source_type — radio compacto */}
        <div
          role="group"
          aria-label="Tipo de fuente"
          className="flex items-center gap-3"
        >
          {(['spine', 'organ'] as SourceType[]).map((type) => (
            <label
              key={type}
              className="flex items-center gap-1.5 text-sm cursor-pointer select-none"
            >
              <input
                type="radio"
                name={`source-${topic._localId}`}
                value={type}
                checked={topic.source_type === type}
                disabled={disabled}
                onChange={() => update('source_type', type)}
                className="accent-[#4A1810]"
              />
              {type === 'spine' ? 'Columna' : 'Órgano'}
            </label>
          ))}
        </div>

        {/* Botón eliminar */}
        {!disabled && (
          <button
            type="button"
            onClick={() => onRemove(topic._localId)}
            aria-label={`Eliminar tema ${index + 1}`}
            className="ml-3 p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
          >
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
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}
      </div>

      {/* Cuerpo del tema */}
      <div className="p-4 space-y-4">
        {/* Zona + temas adulto/niño en grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="flex flex-col gap-1">
            <label htmlFor={zoneId} className="text-xs font-medium text-gray-600">
              Zona
            </label>
            <input
              id={zoneId}
              type="text"
              value={topic.zone}
              disabled={disabled}
              onChange={(e) => update('zone', e.target.value)}
              placeholder="Ej: L3, hígado…"
              className="rounded border border-gray-300 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#4A1810] disabled:opacity-50"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor={adultThemeId} className="text-xs font-medium text-gray-600">
              Tema adulto
            </label>
            <input
              id={adultThemeId}
              type="text"
              value={topic.adult_theme}
              disabled={disabled}
              onChange={(e) => update('adult_theme', e.target.value)}
              placeholder="Tema en el adulto…"
              className="rounded border border-gray-300 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#4A1810] disabled:opacity-50"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor={childThemeId} className="text-xs font-medium text-gray-600">
              Tema niño interior
            </label>
            <input
              id={childThemeId}
              type="text"
              value={topic.child_theme}
              disabled={disabled}
              onChange={(e) => update('child_theme', e.target.value)}
              placeholder="Tema en el niño…"
              className="rounded border border-gray-300 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-[#4A1810] disabled:opacity-50"
            />
          </div>
        </div>

        {/* Edades */}
        <div className="grid grid-cols-2 gap-3 max-w-xs">
          <div className="flex flex-col gap-1">
            <label htmlFor={adultAgeId} className="text-xs font-medium text-gray-600">
              Edad adulto
            </label>
            <input
              id={adultAgeId}
              type="number"
              min={0}
              max={120}
              value={topic.adult_age}
              disabled={disabled}
              onChange={(e) => update('adult_age', e.target.value)}
              placeholder="—"
              className="rounded border border-gray-300 px-2.5 py-1.5 text-sm text-center focus:outline-none focus:ring-1 focus:ring-[#4A1810] disabled:opacity-50"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor={childAgeId} className="text-xs font-medium text-gray-600">
              Edad niño
            </label>
            <input
              id={childAgeId}
              type="number"
              min={0}
              max={18}
              value={topic.child_age}
              disabled={disabled}
              onChange={(e) => update('child_age', e.target.value)}
              placeholder="—"
              className="rounded border border-gray-300 px-2.5 py-1.5 text-sm text-center focus:outline-none focus:ring-1 focus:ring-[#4A1810] disabled:opacity-50"
            />
          </div>
        </div>

        {/* Emociones */}
        <div className="flex flex-col gap-1">
          <label htmlFor={emotionsId} className="text-xs font-medium text-gray-600">
            Emociones / notas
          </label>
          <textarea
            id={emotionsId}
            value={topic.emotions}
            disabled={disabled}
            onChange={(e) => update('emotions', e.target.value)}
            rows={2}
            placeholder="Emociones relacionadas, observaciones…"
            className="rounded border border-gray-300 px-2.5 py-1.5 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-[#4A1810] disabled:opacity-50"
          />
        </div>

        {/* Energía inicial y final del tema */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
          <EnergySlider
            label="Energía inicial del tema"
            value={topic.initial_energy}
            onChange={(v) => update('initial_energy', v)}
            phase="initial"
            max={100}
            disabled={disabled}
          />
          <EnergySlider
            label="Energía final del tema"
            value={topic.final_energy}
            compareValue={topic.initial_energy}
            onChange={(v) => update('final_energy', v)}
            phase="final"
            max={100}
            disabled={disabled}
          />
        </div>
      </div>
    </article>
  );
}

// ─── StepTopics ───────────────────────────────────────────────────────────────

export interface StepTopicsProps {
  topics: Topic[];
  onAdd: () => void;
  onRemove: (localId: string) => void;
  onChange: (localId: string, updates: Partial<Omit<Topic, '_localId'>>) => void;
  disabled?: boolean;
}

export function StepTopics({
  topics,
  onAdd,
  onRemove,
  onChange,
  disabled = false,
}: StepTopicsProps) {
  return (
    <section aria-labelledby="step-topics-heading" className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2
            id="step-topics-heading"
            className="text-base font-semibold text-[#4A1810]"
          >
            Temas trabajados
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Agrega los temas abordados durante la sesión.
          </p>
        </div>

        {!disabled && (
          <button
            type="button"
            onClick={onAdd}
            className="inline-flex items-center gap-1.5 rounded-md bg-[#4A1810] px-3 py-2 text-sm font-medium text-white hover:bg-[#6A2015] focus:outline-none focus:ring-2 focus:ring-[#4A1810] focus:ring-offset-2 transition-colors"
          >
            <svg
              aria-hidden="true"
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Agregar tema
          </button>
        )}
      </div>

      {topics.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <p className="text-sm text-gray-400">
            No hay temas registrados. Pulsa "Agregar tema" para comenzar.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {topics.map((topic, index) => (
            <TopicCard
              key={topic._localId}
              topic={topic}
              index={index}
              onChange={onChange}
              onRemove={onRemove}
              disabled={disabled}
            />
          ))}
        </div>
      )}

      {/* Footer con contador */}
      {topics.length > 0 && (
        <p className="text-xs text-gray-400 text-right">
          {topics.length} {topics.length === 1 ? 'tema' : 'temas'}
        </p>
      )}
    </section>
  );
}

export default StepTopics;
