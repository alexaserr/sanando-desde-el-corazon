'use client';

import { useCallback, useEffect, useRef } from 'react';
import { Plus } from 'lucide-react';
import { CleaningGroupCard } from './CleaningGroupCard';
import type { CleaningGroup, ManifestationEntry } from './types';

// ─── Shared styles ───────────────────────────────────────────────────────────

const LABEL_STYLE = { fontFamily: 'Lato, sans-serif' } as const;

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function newCleaningGroup(
  targetType: CleaningGroup['target_type'],
  targetName: string,
): CleaningGroup {
  return {
    id: crypto.randomUUID(),
    target_type: targetType,
    target_name: targetName,
    layers: [],
    events: [],
    cleanings_required: 0,
    mesa_utilizada: [],
    beneficios: '',
    is_charged: true,
    cost_per_cleaning: 1300,
  };
}

function newAutoManifestation(name: string, value: number): ManifestationEntry {
  return {
    id: crypto.randomUUID(),
    name,
    value,
    unit: 'numero',
    work_done: '',
    materials: [],
    origins: [],
    is_auto_injected: true,
    expanded: false,
  };
}

// ─── Props ───────────────────────────────────────────────────────────────────

export interface StepCleaningProps {
  groups: CleaningGroup[];
  onGroupsChange: (groups: CleaningGroup[]) => void;
  patientName: string;
  disabled?: boolean;
  /** Datos del paso 1 para auto-inyección de manifestaciones. */
  generalData?: {
    has_entities: boolean | null;
    entities_count: number;
    has_implants: boolean | null;
  };
}

// ─── StepCleaning ────────────────────────────────────────────────────────────

export function StepCleaning({
  groups,
  onGroupsChange,
  patientName,
  disabled = false,
  generalData,
}: StepCleaningProps) {
  // Keep patient group name in sync
  const prevNameRef = useRef(patientName);
  useEffect(() => {
    if (patientName !== prevNameRef.current && groups.length > 0 && groups[0].target_type === 'paciente') {
      prevNameRef.current = patientName;
      onGroupsChange(
        groups.map((g, i) => (i === 0 ? { ...g, target_name: patientName } : g)),
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientName]);

  // Auto-inject manifestations from generalData on first patient group
  const injectedRef = useRef(false);
  useEffect(() => {
    if (injectedRef.current || !generalData || groups.length === 0) return;
    const patientGroup = groups[0];
    if (patientGroup.target_type !== 'paciente') return;

    // Only inject if patient group has no events yet
    if (patientGroup.events.length > 0) {
      injectedRef.current = true;
      return;
    }

    const autoEvents: ManifestationEntry[] = [];
    if (generalData.has_entities && generalData.entities_count > 0) {
      autoEvents.push(newAutoManifestation('Entidad', generalData.entities_count));
    }
    if (generalData.has_implants) {
      autoEvents.push(newAutoManifestation('Implante', 1));
    }

    if (autoEvents.length > 0) {
      injectedRef.current = true;
      onGroupsChange(
        groups.map((g, i) =>
          i === 0 ? { ...g, events: [...g.events, ...autoEvents] } : g,
        ),
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generalData, groups.length]);

  const updateGroup = useCallback(
    (groupId: string, patch: Partial<CleaningGroup>) => {
      onGroupsChange(
        groups.map((g) => (g.id === groupId ? { ...g, ...patch } : g)),
      );
    },
    [groups, onGroupsChange],
  );

  const deleteGroup = useCallback(
    (groupId: string) => {
      onGroupsChange(groups.filter((g) => g.id !== groupId));
    },
    [groups, onGroupsChange],
  );

  const addGroup = useCallback(() => {
    onGroupsChange([...groups, newCleaningGroup('familiar', '')]);
  }, [groups, onGroupsChange]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2
          className="text-lg font-bold text-terra-900"
          style={LABEL_STYLE}
        >
          Reporte de Limpieza
        </h2>
        <p className="mt-0.5 text-sm text-gray-500">
          Registra la limpieza del paciente y de personas o lugares adicionales.
        </p>
      </div>

      {/* Group cards */}
      {groups.map((group, idx) => (
        <CleaningGroupCard
          key={group.id}
          group={group}
          index={idx}
          isPatientGroup={idx === 0 && group.target_type === 'paciente'}
          disabled={disabled}
          onUpdate={(patch) => updateGroup(group.id, patch)}
          onDelete={() => deleteGroup(group.id)}
        />
      ))}

      {/* Add new group */}
      <button
        type="button"
        onClick={addGroup}
        disabled={disabled}
        className="flex items-center gap-2 rounded-lg border-2 border-dashed border-[#C4704A] px-5 py-3 text-sm font-semibold text-[#C4704A] hover:bg-[#C4704A]/5 focus:outline-none focus:ring-2 focus:ring-[#C4704A] disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
      >
        <Plus size={16} />
        Nueva Limpieza
      </button>
    </div>
  );
}

export default StepCleaning;
