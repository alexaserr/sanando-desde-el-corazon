'use client';

import { useId } from 'react';
import { EnergySlider } from '../EnergySlider';
import { getOrgansByChakraPosition } from '@/lib/data/chakra-organs';
import type { BlockageData } from './types';
import type { ChakraPosition } from '@/types/api';

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

  // Encontrar la posición del chakra seleccionado para filtrar órganos
  const selectedChakra = chakras.find((c) => c.id === value.chakra_position_id);
  const organs = selectedChakra ? getOrgansByChakraPosition(selectedChakra.position) : [];

  function handleChakraChange(chakraId: string) {
    // Resetear órgano al cambiar chakra
    onChange({ ...value, chakra_position_id: chakraId, organ_name: '' });
  }

  function handleOrganChange(organName: string) {
    onChange({ ...value, organ_name: organName });
  }

  function handleEnergyChange(energy: number) {
    onChange({ ...value, energy });
  }

  return (
    <div className="space-y-2">
      {/* Label de fila */}
      <p className="text-xs font-semibold text-terra-700 uppercase tracking-wide select-none">
        {label}
      </p>

      {/* Selectores en grid responsive */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {/* Chakra */}
        <div className="flex flex-col gap-1">
          <label htmlFor={chakraSelectId} className="text-xs font-medium text-gray-600">
            Chakra
          </label>
          <select
            id={chakraSelectId}
            value={value.chakra_position_id}
            disabled={disabled}
            onChange={(e) => handleChakraChange(e.target.value)}
            className="min-h-[44px] rounded border border-gray-300 px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-terra-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <option value="">— Seleccionar —</option>
            {chakras
              .slice()
              .sort((a, b) => a.position - b.position)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.position}. {c.name}
                </option>
              ))}
          </select>
        </div>

        {/* Órgano — filtrado por chakra */}
        <div className="flex flex-col gap-1">
          <label htmlFor={organSelectId} className="text-xs font-medium text-gray-600">
            Órgano / Sistema
          </label>
          <select
            id={organSelectId}
            value={value.organ_name}
            disabled={disabled || !value.chakra_position_id}
            onChange={(e) => handleOrganChange(e.target.value)}
            className="min-h-[44px] rounded border border-gray-300 px-2.5 py-1.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-terra-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <option value="">— Seleccionar —</option>
            {organs.map((o) => (
              <option key={o.id} value={o.organ_name}>
                {o.organ_name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Slider de energía 0-100 */}
      <EnergySlider
        label="Energía del órgano"
        value={value.energy}
        onChange={handleEnergyChange}
        phase="initial"
        max={100}
        disabled={disabled}
        showLabel={false}
      />
    </div>
  );
}

export default BlockageRow;
