'use client';

import { useState, useId } from 'react';
import { ThemeCard } from './ThemeCard';
import type { ThemeEntry, BlockageData, AgeData } from './types';
import type { ChakraPosition, ClientTopic } from '@/types/api';
import { createClientTopic, deleteClientTopic } from '@/lib/api/clinical';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const EMPTY_BLOCKAGE: BlockageData = { chakra_position_id: '', organ_name: '', energy: 0 };

const EMPTY_AGE_DATA: AgeData = {
  place: '',
  people: '',
  situation: '',
  description: '',
  emotions: '',
};

function newThemeEntry(
  name = '',
  topicId: string | null = null,
  isCreatedLocally = false,
): ThemeEntry {
  return {
    _localId: crypto.randomUUID(),
    topic_id: topicId,
    _isCreatedLocally: isCreatedLocally,
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
  clientId: string;
  chakras: ChakraPosition[];
  onChange: (themes: ThemeEntry[]) => void;
  disabled?: boolean;
  /** Show peticiones section (only for Medicina Cuántica) */
  showPeticiones?: boolean;
  peticiones?: string;
  onPeticionesChange?: (val: string) => void;
}

// ─── StepTopics ───────────────────────────────────────────────────────────────

export function StepTopics({
  themes,
  clientTopics,
  clientId,
  chakras,
  onChange,
  disabled = false,
  showPeticiones = false,
  peticiones,
  onPeticionesChange,
}: StepTopicsProps) {
  const [mode, setMode]               = useState<'existing' | 'new'>('new');
  const [themeCount, setThemeCount]   = useState(1);
  const [selectedTopicId, setSelectedTopicId] = useState('');
  const [newTopicName, setNewTopicName]        = useState('');
  const [isAdding, setIsAdding]               = useState(false);
  const [addError, setAddError]               = useState<string | null>(null);
  const [lastAddedId, setLastAddedId]          = useState<string | null>(null);

  const modeGroupId      = useId();
  const existingSelectId = useId();
  const newNameId        = useId();
  const counterId        = useId();

  // ── Ajustar cantidad de temas al cambiar el counter ───────────────────────

  function handleCountChange(count: number) {
    setThemeCount(count);
    if (count > themes.length) {
      const extras = Array.from({ length: count - themes.length }, () =>
        newThemeEntry(),
      );
      onChange([...themes, ...extras]);
    } else if (count < themes.length) {
      onChange(themes.slice(0, count));
    }
  }

  // ── Agregar tema ──────────────────────────────────────────────────────────

  async function handleAddTheme() {
    setAddError(null);

    if (mode === 'existing') {
      const existing = clientTopics.find((t) => t.id === selectedTopicId);
      if (!existing) return;
      const entry = { ...newThemeEntry(existing.name, existing.id, false), progress_pct: existing.progress_pct };
      const next = [...themes, entry];
      onChange(next);
      setThemeCount(next.length);
      setSelectedTopicId('');
      setLastAddedId(entry._localId);
    } else {
      // Crear el topic en el backend primero para obtener su UUID real
      const name = newTopicName.trim() || `Tema ${themes.length + 1}`;
      setIsAdding(true);
      try {
        const created = await createClientTopic(clientId, name);
        const entry = newThemeEntry(created.name, created.id, true);
        const next = [...themes, entry];
        onChange(next);
        setThemeCount(next.length);
        setNewTopicName('');
        setLastAddedId(entry._localId);
      } catch {
        setAddError('No se pudo crear el tema. Intenta de nuevo.');
      } finally {
        setIsAdding(false);
      }
    }
  }

  // ── Eliminar un tema ──────────────────────────────────────────────────────

  async function handleDeleteTheme(localId: string) {
    const theme = themes.find((t) => t._localId === localId);
    if (!theme) return;

    // Eliminar del estado local inmediatamente
    const next = themes.filter((t) => t._localId !== localId);
    onChange(next);
    setThemeCount(next.length);

    // Si el topic fue creado en esta sesión, eliminarlo del backend también
    if (theme._isCreatedLocally && theme.topic_id) {
      try {
        await deleteClientTopic(clientId, theme.topic_id);
      } catch {
        // No revertir — el topic huérfano se limpiará eventualmente
      }
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

  const isAddDisabled =
    disabled ||
    isAdding ||
    tooManyTopics ||
    (mode === 'existing' && !selectedTopicId) ||
    (mode === 'new' && !clientId);

  return (
    <section aria-labelledby="step-topics-heading" className="space-y-6">
      {/* Cabecera */}
      <div>
        <h2 id="step-topics-heading" className="text-base font-semibold text-terra-700">
          Temas trabajados
        </h2>
        <p className="text-sm text-terra-500 mt-0.5">
          Agrega los temas abordados durante la sesión.
        </p>
      </div>

      {/* ── Selector: ¿Tema existente o nuevo? ────────────────────────────── */}
      <div className="bg-terra-50 rounded-lg border border-terra-100 p-4 space-y-4">
        {/* Radio group */}
        <div role="group" aria-labelledby={modeGroupId} className="flex gap-4 flex-wrap">
          <p id={modeGroupId} className="text-sm font-medium text-terra-800 w-full">
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
            <label htmlFor={existingSelectId} className="text-xs font-medium text-terra-800">
              Seleccionar tema
            </label>
            <select
              id={existingSelectId}
              value={selectedTopicId}
              disabled={disabled || tooManyTopics}
              onChange={(e) => setSelectedTopicId(e.target.value)}
              className="min-h-[44px] rounded border border-terra-200 px-2.5 py-1.5 text-sm bg-terra-50 focus:outline-none focus:ring-1 focus:ring-terra-700 disabled:opacity-50"
            >
              <option value="">— Seleccionar tema —</option>
              {clientTopics.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.progress_pct}%)
                </option>
              ))}
            </select>
            {clientTopics.length === 0 && (
              <p className="text-xs text-terra-400 mt-1">
                El paciente no tiene temas registrados aún.
              </p>
            )}
          </div>
        )}

        {/* Input para nombre del tema nuevo */}
        {mode === 'new' && (
          <div className="flex flex-col gap-1">
            <label htmlFor={newNameId} className="text-xs font-medium text-terra-800">
              Nombre del tema
            </label>
            <input
              id={newNameId}
              type="text"
              value={newTopicName}
              disabled={disabled || tooManyTopics || isAdding}
              onChange={(e) => setNewTopicName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !isAddDisabled) {
                  e.preventDefault();
                  void handleAddTheme();
                }
              }}
              placeholder="Ej: Miedo al abandono"
              className="min-h-[44px] rounded border border-terra-200 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-terra-700 disabled:opacity-50"
            />
          </div>
        )}

        {/* Botón agregar */}
        <button
          type="button"
          onClick={() => void handleAddTheme()}
          disabled={isAddDisabled}
          className="inline-flex items-center gap-1.5 rounded-md bg-terra-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-terra-800 focus:outline-none focus:ring-2 focus:ring-terra-700 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          style={{ minHeight: 44 }}
        >
          {isAdding ? (
            <>
              <svg
                aria-hidden="true"
                className="w-4 h-4 animate-spin"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
              Creando…
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
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Agregar tema
            </>
          )}
        </button>

        {tooManyTopics && (
          <p className="text-xs text-amber-600">Máximo 5 temas por sesión.</p>
        )}
        {addError && (
          <p className="text-xs text-red-600">{addError}</p>
        )}
      </div>

      {/* ── Counter: ¿Cuántos temas? ────────────────────────────────────────── */}
      {themes.length > 0 && (
        <div className="flex items-center gap-3">
          <label htmlFor={counterId} className="text-sm font-medium text-terra-800 shrink-0">
            Cantidad de temas:
          </label>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => handleCountChange(Math.max(1, counterValue - 1))}
              disabled={disabled || counterValue <= 1}
              aria-label="Reducir temas"
              className="w-11 h-11 flex items-center justify-center rounded border border-terra-200 bg-terra-50 text-terra-800 hover:bg-terra-50 disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-terra-700 transition-colors"
            >
              −
            </button>
            <output
              id={counterId}
              aria-live="polite"
              className="w-10 text-center text-sm font-semibold text-terra-900 tabular-nums"
            >
              {themes.length}
            </output>
            <button
              type="button"
              onClick={() => handleCountChange(Math.min(5, counterValue + 1))}
              disabled={disabled || counterValue >= 5}
              aria-label="Agregar tema"
              className="w-11 h-11 flex items-center justify-center rounded border border-terra-200 bg-terra-50 text-terra-800 hover:bg-terra-50 disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-terra-700 transition-colors"
            >
              +
            </button>
          </div>
        </div>
      )}

      {/* ── Lista de ThemeCards ───────────────────────────────────────────────── */}
      {themes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center text-sm text-terra-400">
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
              onDelete={() => void handleDeleteTheme(theme._localId)}
              disabled={disabled}
              isNew={theme._localId === lastAddedId}
            />
          ))}
        </div>
      )}

      {/* Footer contador */}
      {themes.length > 0 && (
        <p className="text-xs text-terra-400 text-right">
          {themes.length} {themes.length === 1 ? 'tema' : 'temas'}
        </p>
      )}

      {/* Peticiones LNT (solo Medicina Cuántica) */}
      {showPeticiones && (
        <section className="mt-6 rounded-lg border border-terra-100 bg-terra-50 p-4">
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-terra-700">
            Peticiones LNT
          </label>
          <textarea
            value={peticiones ?? ''}
            onChange={(e) => onPeticionesChange?.(e.target.value)}
            disabled={disabled}
            rows={4}
            placeholder="Peticiones para la sesión de Medicina Cuántica..."
            className="w-full rounded-lg border border-terra-100 bg-[#FAF7F5] px-3 py-2 text-sm placeholder-terra-200 focus:outline-none focus:ring-2 focus:ring-[#C4704A]/30 focus:border-[#C4704A] disabled:opacity-50"
          />
        </section>
      )}
    </section>
  );
}

export default StepTopics;
