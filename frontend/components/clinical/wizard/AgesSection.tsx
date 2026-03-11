'use client';

import { useId } from 'react';
import type { AgeData } from './types';

export interface AgesSectionProps {
  /** Etiqueta de la sección, ej: "Infancia" o "Adultez" */
  label: string;
  value: AgeData;
  onChange: (value: AgeData) => void;
  disabled?: boolean;
}

export function AgesSection({ label, value, onChange, disabled = false }: AgesSectionProps) {
  const placeId       = useId();
  const peopleId      = useId();
  const situationId   = useId();
  const descriptionId = useId();
  const emotionsId    = useId();

  function update<K extends keyof AgeData>(field: K, val: AgeData[K]) {
    onChange({ ...value, [field]: val });
  }

  const inputClass =
    'w-full rounded border border-gray-300 px-2.5 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-terra-700 disabled:opacity-50 disabled:cursor-not-allowed';

  const textareaClass =
    'w-full rounded border border-gray-300 px-2.5 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-terra-700 disabled:opacity-50 disabled:cursor-not-allowed';

  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-semibold text-gray-700">{label}</legend>

      {/* Lugar / Espacio */}
      <div className="flex flex-col gap-1">
        <label htmlFor={placeId} className="text-xs font-medium text-gray-600">
          Lugar / Espacio
        </label>
        <input
          id={placeId}
          type="text"
          value={value.place}
          disabled={disabled}
          onChange={(e) => update('place', e.target.value)}
          placeholder="¿En qué lugar ocurrió?"
          className={inputClass}
          style={{ minHeight: 44 }}
        />
      </div>

      {/* Personas involucradas */}
      <div className="flex flex-col gap-1">
        <label htmlFor={peopleId} className="text-xs font-medium text-gray-600">
          Personas involucradas
        </label>
        <input
          id={peopleId}
          type="text"
          value={value.people}
          disabled={disabled}
          onChange={(e) => update('people', e.target.value)}
          placeholder="¿Quiénes estaban presentes?"
          className={inputClass}
          style={{ minHeight: 44 }}
        />
      </div>

      {/* Situación ocurrida */}
      <div className="flex flex-col gap-1">
        <label htmlFor={situationId} className="text-xs font-medium text-gray-600">
          Situación ocurrida
        </label>
        <textarea
          id={situationId}
          value={value.situation}
          disabled={disabled}
          onChange={(e) => update('situation', e.target.value)}
          rows={2}
          placeholder="¿Qué sucedió?"
          className={textareaClass}
        />
      </div>

      {/* Descripción */}
      <div className="flex flex-col gap-1">
        <label htmlFor={descriptionId} className="text-xs font-medium text-gray-600">
          Descripción
        </label>
        <textarea
          id={descriptionId}
          value={value.description}
          disabled={disabled}
          onChange={(e) => update('description', e.target.value)}
          rows={2}
          placeholder="Descripción detallada…"
          className={textareaClass}
        />
      </div>

      {/* Emociones generadas */}
      <div className="flex flex-col gap-1">
        <label htmlFor={emotionsId} className="text-xs font-medium text-gray-600">
          Emociones generadas
        </label>
        <input
          id={emotionsId}
          type="text"
          value={value.emotions}
          disabled={disabled}
          onChange={(e) => update('emotions', e.target.value)}
          placeholder="Miedo, tristeza, enojo…"
          className={inputClass}
          style={{ minHeight: 44 }}
        />
      </div>
    </fieldset>
  );
}

export default AgesSection;
