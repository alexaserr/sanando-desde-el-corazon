'use client';

import { useState, useId } from 'react';
import { ThemeCard } from './ThemeCard';
import type { ThemeEntry, BlockageData, AgeData } from './types';
import type { ChakraPosition, ClientTopic } from '@/types/api';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const EMPTY_BLOCKAGE: BlockageData = { chakra_position_id: '', organ_name: '', energy: 50 };

const EMPTY_AGE_DATA: AgeData = {
  place: '',
  people: '',
  situation: '',
  description: '',
  emotions: '',
};

function newThemeEntry(name = '', topicId: string | null = null): ThemeEntry {
  return {
    _localId: crypto.randomUUID(),
    topic_id: topicId,
    name,
    is_secondary: false,
    blockages: [
      { ...EMPTY_BLOCKAGE },
      { ...EMPTY_BLOCKAGE },
      { ...EMPTY_BLOCKAGE },
    ],
    resultant: { ...EMPTY_BLOCKAGE },
    secondary_energy_initial: 50,
    secondary_energy_final: 50,
    childhood: { ...EMPTY_AGE_DATA },
    adulthood: { ...EMPTY_AGE_DATA },
    progress_pct: 0,
  };
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface StepTopicsProps {
  themes: ThemeEntry[];
  clientTopics: ClientTopic[];
  chakras: ChakraPosition[];
  onChange: (themes: ThemeEntry[]) => void;
  disabled?: boolean;
}

// ─── StepTopics ───────────────────────────────────────────────────────────────

export function StepTopics({
  themes,
  clientTopics,
  chakras,
  onChange,
  disabled = false,
}: StepTopicsProps) {
  // Modo de selección: 'existing' | 'new'
  const [mode, setMode]               = useState<'existing' | 'new'>('new');
  // Cuántos temas mostrar (1-5)
  const [themeCount, setThemeCount]   = useState(1);
  // Tema existente seleccionado del selector
  const [selectedTopicId, setSelectedTopicId] = useState('');
  // Nombre para tema nuevo
  const [newTopicName, setNewTopicName]        = useState('');

  const modeGroupId      = useId();
  const existingSelectId = useId();
  const newNameId        = useId();
  const counterId        = useId();

  // ── Ajustar cantidad de temas al cambiar el counter ───────────────────────

  function handleCountChange(count: number) {
    setThemeCount(count);
    if (count > themes.length) {
      // Agregar temas vacíos hasta llegar al count
      const extras = Array.from({ length: count - themes.length }, () =>
        newThemeEntry(),
      );
      onChange([...themes, ...extras]);
    } else if (count < themes.length) {
      onChange(themes.slice(0, count));
    }
  }

  // ── Agregar tema desde el selector/input ──────────────────────────────────

  function handleAddTheme() {
    if (mode === 'existing') {
      const existing = clientTopics.find((t) => t.id === selectedTopicId);
      if (!existing) return;
      const entry = newThemeEntry(existing.name, existing.id);
      // Marcar progreso actual del tema
      const updated = { ...entry, progress_pct: existing.progress_pct };
      const next = [...themes, updated];
      onChange(next);
      setThemeCount(next.length);
    } else {
      const name = newTopicName.trim();
      const entry = newThemeEntry(name || `Tema ${themes.length + 1}`, null);
      const next = [...themes, entry];
      onChange(next);
      setThemeCount(next.length);
      setNewTopicName('');
    }
  }

  // ── Actualizar un tema individual ─────────────────────────────────────────

  function handleThemeChange(localId: string, updates: Partial<ThemeEntry>) {
    onChange(
      themes.map((t) => (t._localId === localId ? { ...t, ...updates } : t)),
    );
  }

  // ── Counter (1-5) ─────────────────────────────────────────────────────────

  const counterValue = Math.min(5, Math.max(1, themeCount));

  const tooManyTopics = themes.length >= 5;

  return (
    <section aria-labelledby="step-topics-heading" className="space-y-6">
      {/* Cabecera */}
      <div>
        <h2 id="step-topics-heading" className="text-base font-semibold text-terra-700">
          Temas trabajados
        </h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Agrega los temas abordados durante la sesión.
        </p>
      </div>

      {/* ── Selector: ¿Tema existente o nuevo? ────────────────────────────── */}
      <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 space-y-4">
        {/* Radio group */}
        <div role="group" aria-labelledby={modeGroupId} className="flex gap-4 flex-wrap">
          <p id={modeGroupId} className="text-sm font-medium text-gray-700 w-full">
            ¿Tema existente o nuevo?
          </p>
          {(['existing', 'new'] as const).map((m) => (
            <label
              key={m}
              className="flex items-center gap-2 text-sm cursor-pointer select-none"
              style={{ minHeight: 44 }}
            >
              <input
                type="radio"
                name="topic-mode"
                value={m}
                checked={mode === m}
                disabled={disabled || tooManyTopics}
                onChange={() => setMode(m)}
                className="accent-terra-700"
              />
              {m === 'existing' ? 'Tema existente del paciente' : 'Tema nuevo'}
            </label>
          ))}
        </div>

        {/* Selector de tema existente */}
        {mode === 'existing' && (
          <div className="flex flex-col gap-1">
            <label htmlFor={existingSelectId} className="text-xs font-medium text-gray-600">
              Seleccionar tema
            </label>
            <select
              id={existingSelectId}
              value={selectedTopicId}
              disabled={disabled || tooManyTopics}
              onChange={(e) => setSelectedTopicId(e.target.value)}
              className="min-h-[44px] rounded border border-gray-300 px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-terra-700 disabled:opacity-50"
            >
              <option value="">— Seleccionar tema —</option>
              {clientTopics.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.progress_pct}%)
                </option>
              ))}
            </select>
            {clientTopics.length === 0 && (
              <p className="text-xs text-gray-400 mt-1">
                El paciente no tiene temas registrados aún.
              </p>
            )}
          </div>
        )}

        {/* Input para nombre del tema nuevo */}
        {mode === 'new' && (
          <div className="flex flex-col gap-1">
            <label htmlFor={newNameId} className="text-xs font-medium text-gray-600">
              Nombre del tema
            </label>
            <input
              id={newNameId}
              type="text"
              value={newTopicName}
              disabled={disabled || tooManyTopics}
              onChange={(e) => setNewTopicName(e.target.value)}
              placeholder="Ej: Miedo al abandono"
              className="min-h-[44px] rounded border border-gray-300 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-terra-700 disabled:opacity-50"
            />
          </div>
        )}

        {/* Botón agregar */}
        <button
          type="button"
          onClick={handleAddTheme}
          disabled={
            disabled ||
            tooManyTopics ||
            (mode === 'existing' && !selectedTopicId)
          }
          className="inline-flex items-center gap-1.5 rounded-md bg-terra-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-terra-800 focus:outline-none focus:ring-2 focus:ring-terra-700 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          style={{ minHeight: 44 }}
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

        {tooManyTopics && (
          <p className="text-xs text-amber-600">Máximo 5 temas por sesión.</p>
        )}
      </div>

      {/* ── Counter: ¿Cuántos temas? ────────────────────────────────────────── */}
      {themes.length > 0 && (
        <div className="flex items-center gap-3">
          <label htmlFor={counterId} className="text-sm font-medium text-gray-700 shrink-0">
            Cantidad de temas:
          </label>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => handleCountChange(Math.max(1, counterValue - 1))}
              disabled={disabled || counterValue <= 1}
              aria-label="Reducir temas"
              className="w-11 h-11 flex items-center justify-center rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-terra-700 transition-colors"
            >
              −
            </button>
            <output
              id={counterId}
              aria-live="polite"
              className="w-10 text-center text-sm font-semibold text-gray-900 tabular-nums"
            >
              {themes.length}
            </output>
            <button
              type="button"
              onClick={() => handleCountChange(Math.min(5, counterValue + 1))}
              disabled={disabled || counterValue >= 5}
              aria-label="Agregar tema"
              className="w-11 h-11 flex items-center justify-center rounded border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-terra-700 transition-colors"
            >
              +
            </button>
          </div>
        </div>
      )}

      {/* ── Lista de ThemeCards ───────────────────────────────────────────────── */}
      {themes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center text-sm text-gray-400">
          No hay temas. Usa el panel de arriba para agregar uno.
        </div>
      ) : (
        <div className="space-y-4">
          {themes.map((theme, index) => (
            <ThemeCard
              key={theme._localId}
              theme={theme}
              index={index}
              chakras={chakras}
              onChange={(updates) => handleThemeChange(theme._localId, updates)}
              disabled={disabled}
            />
          ))}
        </div>
      )}

      {/* Footer contador */}
      {themes.length > 0 && (
        <p className="text-xs text-gray-400 text-right">
          {themes.length} {themes.length === 1 ? 'tema' : 'temas'}
        </p>
      )}
    </section>
  );
}

export default StepTopics;
