'use client';

import { AncestorsPanel } from './AncestorsPanel';
import type { AncestorEntry, AncestorConciliation } from './types';

export interface StepAncestorsProps {
  ancestors: AncestorEntry[];
  onAncestorsChange: (ancestors: AncestorEntry[]) => void;
  conciliation: AncestorConciliation;
  onConciliationChange: (conciliation: AncestorConciliation) => void;
  disabled?: boolean;
}

export function StepAncestors({
  ancestors,
  onAncestorsChange,
  conciliation,
  onConciliationChange,
  disabled = false,
}: StepAncestorsProps) {
  return (
    <section aria-labelledby="step-ancestors-heading" className="space-y-5">
      <div>
        <h2 id="step-ancestors-heading" className="text-base font-semibold text-[#2C2220]">
          Reporte de Ancestros
        </h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Registra los ancestros identificados durante la sesión y la conciliación correspondiente.
        </p>
      </div>

      <AncestorsPanel
        ancestors={ancestors}
        onAncestorsChange={onAncestorsChange}
        conciliation={conciliation}
        onConciliationChange={onConciliationChange}
        disabled={disabled}
      />
    </section>
  );
}

export default StepAncestors;
