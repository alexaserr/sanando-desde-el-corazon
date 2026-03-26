'use client';

import { useId, useRef, useEffect, useCallback } from 'react';
import { EnergySlider } from '../EnergySlider';
import { getOrgansByChakraPosition } from '@/lib/data/chakra-organs';
import { ORGAN_MEANINGS } from '@/lib/data/organ-meanings';
import type { BlockageData } from './types';
import type { ChakraPosition } from '@/types/api';

/** Strip diacritics for fuzzy matching against ORGAN_MEANINGS keys. */
function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function lookupMeaning(organName: string): string | undefined {
  const key = organName.toLowerCase().trim();
  if (ORGAN_MEANINGS[key]) return ORGAN_MEANINGS[key];
  const plain = stripAccents(key);
  if (ORGAN_MEANINGS[plain]) return ORGAN_MEANINGS[plain];
  return undefined;
}

function AutoResizeTextarea({
  value,
  onChange,
  placeholder,
  disabled,
}: {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  placeholder: string;
  disabled: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const resize = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  useEffect(() => { resize(); }, [value, resize]);

  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      onChange={onChange}
      onInput={resize}
      placeholder={placeholder}
      disabled={disabled}
      className="w-full min-h-[32px] resize-none overflow-hidden rounded border-0 bg-[#FAF7F5] px-3 py-1 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-terra-700 disabled:opacity-50 disabled:cursor-not-allowed"
    />
  );
}

export interface BlockageRowProps {
  label: string;
  chakras: ChakraPosition[];
  value: BlockageData;
  onChange: (value: BlockageData) => void;
  disabled?: boolean;
}

export function BlockageRow({
  label,
  chakras,
  value,
  onChange,
  disabled = false,
}: BlockageRowProps) {
  const chakraSelectId = useId();
  const organSelectId  = useId();

  const selectedChakra = chakras.find((c) => c.id === value.chakra_position_id);
  const organs = selectedChakra ? getOrgansByChakraPosition(selectedChakra.position) : [];

  function handleChakraChange(chakraId: string) {
    onChange({ ...value, chakra_position_id: chakraId, organ_name: '' });
  }

  function handleOrganChange(organName: string) {
    const meaning = organName ? lookupMeaning(organName) : undefined;
    onChange({
      ...value,
      organ_name: organName,
      significado: meaning ?? value.significado ?? '',
    });
  }

  function handleEnergyChange(energy: number) {
    onChange({ ...value, energy });
  }

  function handleSignificadoChange(significado: string) {
    onChange({ ...value, significado });
  }

  function handleInterpretacionChange(interpretacion_tema: string) {
    onChange({ ...value, interpretacion_tema });
  }

  const showTextFields = !!value.chakra_position_id && !!value.organ_name;

  return (
    <div className="flex flex-col gap-2">
    <div className="flex flex-wrap items-center gap-2">
      {/* Label */}
      <span className="shrink-0 text-xs font-normal text-[#4A3628] uppercase tracking-wide select-none w-[72px]">
        {label}
      </span>

      {/* Chakra select */}
      <select
        id={chakraSelectId}
        value={value.chakra_position_id}
        disabled={disabled}
        onChange={(e) => handleChakraChange(e.target.value)}
        aria-label={`Chakra — ${label}`}
        className="min-h-[36px] w-[150px] rounded-none border-0 border-b border-[#D4A592] bg-[#FAF7F5] px-2 py-1 text-sm focus:outline-none focus:ring-0 focus:border-b-2 focus:border-[#C4704A] disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <option value="">— Chakra —</option>
        {chakras
          .slice()
          .sort((a, b) => a.position - b.position)
          .map((c) => (
            <option key={c.id} value={c.id}>
              {c.position}. {c.name}
            </option>
          ))}
      </select>

      {/* Organ select */}
      <select
        id={organSelectId}
        value={value.organ_name}
        disabled={disabled || !value.chakra_position_id}
        onChange={(e) => handleOrganChange(e.target.value)}
        aria-label={`Órgano — ${label}`}
        className="min-h-[36px] w-[180px] rounded-none border-0 border-b border-[#D4A592] bg-[#FAF7F5] px-2 py-1 text-sm focus:outline-none focus:ring-0 focus:border-b-2 focus:border-[#C4704A] disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <option value="">— Órgano —</option>
        {organs.map((o) => (
          <option key={o.id} value={o.organ_name}>
            {o.organ_name}
          </option>
        ))}
      </select>

      {/* Energy slider — flex-1 */}
      <div className="flex-1 min-w-[140px]">
        <EnergySlider
          label={`Energía — ${label}`}
          value={value.energy}
          onChange={handleEnergyChange}
          phase="initial"
          max={14}
          step={0.5}
          disabled={disabled}
          showLabel={false}
        />
      </div>
    </div>

    {showTextFields && (
      <div className="flex flex-col gap-2 pl-[80px]">
        <AutoResizeTextarea
          value={value.significado ?? ''}
          onChange={(e) => handleSignificadoChange(e.target.value)}
          placeholder="Significado"
          disabled={disabled}
        />
        <input
          type="text"
          value={value.interpretacion_tema ?? ''}
          onChange={(e) => handleInterpretacionChange(e.target.value)}
          placeholder="Interpretación al tema"
          disabled={disabled}
          className="flex-1 min-h-[32px] rounded border-0 bg-[#FAF7F5] px-3 py-1 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-terra-700 disabled:opacity-50 disabled:cursor-not-allowed"
        />
      </div>
    )}
    </div>
  );
}

export default BlockageRow;
