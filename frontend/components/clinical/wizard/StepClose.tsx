'use client';

import { useId, useEffect, useState, useCallback } from 'react';
import type {
  CloseData,
  SessionSummary,
  CleaningGroup,
  ProtectionEntry,
  ThemeEntry,
  EnergyReading,
  WizardChakraReading,
  LntEntry,
  AncestorEntry,
  AncestorConciliation,
  LayerEntry,
  ManifestationEntry,
} from './types';

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

const COST_PER_PROTECTION = 1200;

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

// ─── Accordion colapsable ────────────────────────────────────────────────────

function Accordion({
  title,
  children,
  defaultOpen = false,
  badge,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  badge?: string | number;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 bg-[#FAF7F5] hover:bg-[#F5F0EC] transition-colors text-left"
      >
        <span className="text-sm font-semibold text-[#2C2220] flex items-center gap-2">
          {title}
          {badge !== undefined && (
            <span className="inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full bg-[#C4704A] text-white text-xs font-medium">
              {badge}
            </span>
          )}
        </span>
        <svg
          className={`w-4 h-4 text-[#4A3628] transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && <div className="px-4 py-3 bg-white">{children}</div>}
    </div>
  );
}

// ─── Lookup helpers ──────────────────────────────────────────────────────────

interface DimensionLookup {
  id: string;
  name: string;
}

interface ChakraLookup {
  id: string;
  name: string;
}

function findName(list: DimensionLookup[] | ChakraLookup[], id: string): string {
  return list.find((item) => item.id === id)?.name ?? id;
}

// ─── Panel de resumen completo de sesión ─────────────────────────────────────

interface FullSessionSummaryProps {
  themes: ThemeEntry[];
  energyInitial: EnergyReading[];
  energyFinal: EnergyReading[];
  chakraInitial: WizardChakraReading[];
  chakraFinal: WizardChakraReading[];
  lntEntries: LntEntry[];
  cleaningGroups: CleaningGroup[];
  ancestors: AncestorEntry[];
  ancestorConciliation: AncestorConciliation | null;
  generalNotes: string;
  dimensionNames: DimensionLookup[];
  chakraNames: ChakraLookup[];
  protections: ProtectionEntry[];
  hasProtection: boolean;
  protectionCharged: boolean;
}

/** Badge/chip reutilizable para listas de valores. */
function Chip({ children, color = 'gray' }: { children: React.ReactNode; color?: 'gray' | 'blue' | 'purple' | 'amber' | 'green' | 'rose' | 'orange' }) {
  const colorClasses: Record<string, string> = {
    gray:   'bg-gray-100 text-gray-700',
    blue:   'bg-blue-100 text-blue-700',
    purple: 'bg-purple-100 text-purple-700',
    amber:  'bg-amber-100 text-amber-800',
    green:  'bg-green-100 text-green-700',
    rose:   'bg-rose-100 text-rose-700',
    orange: 'bg-orange-100 text-orange-700',
  };
  return (
    <span className={`inline-block px-2 py-0.5 text-xs rounded-full ${colorClasses[color]}`}>
      {children}
    </span>
  );
}

/** Formatea una LayerEntry para mostrar. */
function formatLayer(layer: LayerEntry): string {
  return layer.quantity != null ? `${layer.type}: ${layer.quantity}` : layer.type;
}

/** Formatea una ManifestationEntry para mostrar. */
function formatManifestation(m: ManifestationEntry): string {
  if (m.value == null) return m.name;
  return m.unit === 'percent' ? `${m.name}: ${m.value}%` : `${m.name}: ${m.value}`;
}

const TARGET_TYPE_LABELS: Record<string, string> = {
  patient: 'Paciente',
  family_member: 'Familiar',
  house: 'Casa',
  other: 'Otro',
};

function FullSessionSummary({
  themes,
  energyInitial,
  energyFinal,
  chakraInitial,
  chakraFinal,
  lntEntries,
  cleaningGroups,
  ancestors,
  ancestorConciliation,
  generalNotes,
  dimensionNames,
  chakraNames,
  protections,
  hasProtection,
  protectionCharged,
}: FullSessionSummaryProps) {
  const hasThemes = themes.length > 0;
  const hasEnergy = energyInitial.length > 0 || energyFinal.length > 0;
  const hasChakras = chakraInitial.length > 0 || chakraFinal.length > 0;
  const hasLnt = lntEntries.length > 0;
  const hasCleanings = cleaningGroups.length > 0;
  const hasAncestors = ancestors.length > 0;
  const hasNotes = generalNotes.trim().length > 0;
  const hasProtections = hasProtection && protections.length > 0;

  if (!hasThemes && !hasEnergy && !hasChakras && !hasLnt && !hasCleanings && !hasAncestors && !hasNotes && !hasProtections) {
    return null;
  }

  return (
    <div className="space-y-2">
      <h3 className="text-xs uppercase tracking-[0.1em] font-medium text-[#4A3628]">
        Resumen completo de la sesión
      </h3>

      {/* 1. Temas */}
      {hasThemes && (
        <Accordion title="Temas trabajados" badge={themes.length} defaultOpen>
          <div className="space-y-4">
            {themes.map((theme, idx) => (
              <div key={theme._localId} className="space-y-2">
                <p className="text-sm font-semibold text-[#2C2220]">
                  {idx + 1}. {theme.name || 'Sin nombre'}
                  {theme.is_secondary && theme.secondary_name && (
                    <span className="text-xs font-normal text-gray-500 ml-2">
                      (Secundario: {theme.secondary_name})
                    </span>
                  )}
                </p>

                {/* Interpretación */}
                {theme.interpretacion_tema && (
                  <div className="pl-3 border-l-2 border-[#D4A592]">
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Interpretación</p>
                    <p className="text-sm text-gray-700">{theme.interpretacion_tema}</p>
                  </div>
                )}

                {/* Emociones */}
                {theme.emotions && theme.emotions.length > 0 && (
                  <div className="pl-3">
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Emociones</p>
                    <div className="flex flex-wrap gap-1 mt-0.5">
                      {theme.emotions.map((e) => (
                        <span key={e} className="inline-block px-2 py-0.5 bg-amber-100 text-amber-800 text-xs rounded-full">
                          {e}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Órganos asociados (blockages) */}
                {theme.blockages.some((b) => b.organ_name || b.chakra_position_id) && (
                  <div className="pl-3">
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Órganos / Bloqueos</p>
                    <div className="space-y-1 mt-0.5">
                      {theme.blockages.map((b, bi) => {
                        if (!b.organ_name && !b.chakra_position_id) return null;
                        const chakraName = b.chakra_position_id ? findName(chakraNames, b.chakra_position_id) : null;
                        return (
                          <div key={bi} className="flex items-center gap-2 text-sm text-gray-700">
                            <span className="text-xs text-gray-400">#{bi + 1}</span>
                            {b.organ_name && <span>{b.organ_name}</span>}
                            {chakraName && (
                              <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">
                                {chakraName}
                              </span>
                            )}
                            <span className="text-xs text-gray-400">
                              {b.energy}%{b.final_energy !== undefined ? ` → ${b.final_energy}%` : ''}
                            </span>
                            {b.significado && (
                              <span className="text-xs text-gray-500 italic">({b.significado})</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Resultante */}
                {(theme.resultant.organ_name || theme.resultant.chakra_position_id) && (
                  <div className="pl-3">
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Resultante</p>
                    <div className="flex items-center gap-2 text-sm text-gray-700 mt-0.5">
                      {theme.resultant.organ_name && <span>{theme.resultant.organ_name}</span>}
                      {theme.resultant.chakra_position_id && (
                        <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">
                          {findName(chakraNames, theme.resultant.chakra_position_id)}
                        </span>
                      )}
                      <span className="text-xs text-gray-400">
                        {theme.resultant.energy}%{theme.resultant.final_energy !== undefined ? ` → ${theme.resultant.final_energy}%` : ''}
                      </span>
                    </div>
                  </div>
                )}

                {/* Edades */}
                {(theme.childhood_age != null || theme.adulthood_age != null) && (
                  <div className="pl-3 flex gap-4">
                    {theme.childhood_age != null && (
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wide">Edad infancia</p>
                        <p className="text-sm text-gray-700">{theme.childhood_age} años</p>
                      </div>
                    )}
                    {theme.adulthood_age != null && (
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wide">Edad adultez</p>
                        <p className="text-sm text-gray-700">{theme.adulthood_age} años</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Secundario energía */}
                {theme.is_secondary && (
                  <div className="pl-3">
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Energía secundaria</p>
                    <p className="text-sm text-gray-700">
                      {theme.secondary_energy_initial}% → {theme.secondary_energy_final}%
                    </p>
                  </div>
                )}

                {idx < themes.length - 1 && <hr className="border-gray-100" />}
              </div>
            ))}
          </div>
        </Accordion>
      )}

      {/* 2. Dimensiones energéticas */}
      {hasEnergy && (
        <Accordion title="Dimensiones energéticas" badge={Math.max(energyInitial.length, energyFinal.length)}>
          <div className="space-y-1">
            <div className="grid grid-cols-3 gap-2 text-xs text-gray-400 uppercase tracking-wide pb-1 border-b border-gray-100">
              <span>Dimensión</span>
              <span className="text-center">Inicial</span>
              <span className="text-center">Final</span>
            </div>
            {energyInitial.map((ei) => {
              const ef = energyFinal.find((r) => r.dimension_id === ei.dimension_id);
              const delta = ef ? ef.value - ei.value : null;
              return (
                <div key={ei.dimension_id} className="grid grid-cols-3 gap-2 py-1 text-sm">
                  <span className="text-gray-700">{findName(dimensionNames, ei.dimension_id)}</span>
                  <span className="text-center text-gray-600">{ei.value}%</span>
                  <span className="text-center">
                    {ef ? (
                      <span className={delta !== null && delta > 0 ? 'text-green-600' : delta !== null && delta < 0 ? 'text-red-500' : 'text-gray-600'}>
                        {ef.value}% {delta !== null && delta !== 0 && `(${delta > 0 ? '+' : ''}${delta})`}
                      </span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </Accordion>
      )}

      {/* 3. Chakras */}
      {hasChakras && (
        <Accordion title="Chakras" badge={Math.max(chakraInitial.length, chakraFinal.length)}>
          <div className="space-y-1">
            <div className="grid grid-cols-3 gap-2 text-xs text-gray-400 uppercase tracking-wide pb-1 border-b border-gray-100">
              <span>Chakra</span>
              <span className="text-center">Inicial</span>
              <span className="text-center">Final</span>
            </div>
            {chakraInitial.map((ci) => {
              const cf = chakraFinal.find((r) => r.chakra_position_id === ci.chakra_position_id);
              const delta = cf ? cf.value - ci.value : null;
              return (
                <div key={ci.chakra_position_id} className="grid grid-cols-3 gap-2 py-1 text-sm">
                  <span className="text-gray-700">{ci.name}</span>
                  <span className="text-center text-gray-600">{ci.value}</span>
                  <span className="text-center">
                    {cf ? (
                      <span className={delta !== null && delta > 0 ? 'text-green-600' : delta !== null && delta < 0 ? 'text-red-500' : 'text-gray-600'}>
                        {cf.value} {delta !== null && delta !== 0 && `(${delta > 0 ? '+' : ''}${delta})`}
                      </span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </Accordion>
      )}

      {/* 4. Limpiezas */}
      {hasCleanings && (
        <Accordion title="Limpiezas" badge={cleaningGroups.length}>
          <div className="space-y-4">
            {cleaningGroups.map((g) => (
              <div key={g.id} className="space-y-2 border border-gray-100 rounded-lg p-3">
                {/* Encabezado del grupo */}
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-[#2C2220]">
                    {g.target_name}
                    <span className="ml-2">
                      <Chip color="purple">{TARGET_TYPE_LABELS[g.target_type] ?? g.target_type}</Chip>
                    </span>
                  </p>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-gray-500">
                      {g.cleanings_required} {g.cleanings_required === 1 ? 'limpieza' : 'limpiezas'}
                    </span>
                    {!g.is_charged && (
                      <span className="bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded">Sin cargo</span>
                    )}
                  </div>
                </div>

                {g.mesa_utilizada && (
                  <p className="text-xs text-gray-500">Mesa utilizada: <span className="font-medium text-gray-700">{g.mesa_utilizada}</span></p>
                )}

                {/* Eventos de limpieza */}
                {g.cleaning_events.length > 0 && (
                  <div className="space-y-2 pl-2 border-l-2 border-[#D4A592]">
                    {g.cleaning_events.map((ev, evIdx) => (
                      <div key={ev.id} className="space-y-1.5">
                        <p className="text-xs font-medium text-[#4A3628]">
                          Evento {evIdx + 1}
                        </p>

                        {/* Capas */}
                        {ev.layers.length > 0 ? (
                          <div>
                            <p className="text-xs text-gray-400 uppercase tracking-wide">Capas</p>
                            <div className="flex flex-wrap gap-1 mt-0.5">
                              {ev.layers.map((layer, li) => (
                                <Chip key={li} color={layer.type === 'Sin capas' ? 'gray' : 'amber'}>
                                  {formatLayer(layer)}
                                </Chip>
                              ))}
                            </div>
                          </div>
                        ) : ev.capas > 0 ? (
                          <div>
                            <p className="text-xs text-gray-400 uppercase tracking-wide">Capas</p>
                            <Chip color="amber">{ev.capas}</Chip>
                          </div>
                        ) : null}

                        {/* Manifestaciones */}
                        {ev.manifestations.length > 0 && (
                          <div>
                            <p className="text-xs text-gray-400 uppercase tracking-wide">Manifestaciones</p>
                            <div className="flex flex-wrap gap-1 mt-0.5">
                              {ev.manifestations.map((m, mi) => (
                                <Chip key={mi} color="rose">
                                  {formatManifestation(m)}
                                </Chip>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Trabajo realizado */}
                        {ev.trabajo_realizado && (
                          <div>
                            <p className="text-xs text-gray-400 uppercase tracking-wide">Trabajo realizado</p>
                            <div className="flex flex-wrap gap-1 mt-0.5">
                              {ev.trabajo_realizado.split('|').map((t, ti) => (
                                <Chip key={ti} color="blue">{t.trim()}</Chip>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Materiales */}
                        {ev.materiales && (
                          <div>
                            <p className="text-xs text-gray-400 uppercase tracking-wide">Materiales</p>
                            <div className="flex flex-wrap gap-1 mt-0.5">
                              {ev.materiales.split('|').map((mat, mi) => (
                                <Chip key={mi} color="green">{mat.trim()}</Chip>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Origen */}
                        {ev.origin.length > 0 && (
                          <div>
                            <p className="text-xs text-gray-400 uppercase tracking-wide">Origen</p>
                            <div className="flex flex-wrap gap-1 mt-0.5">
                              {ev.origin.map((o, oi) => (
                                <Chip key={oi} color="orange">{o}</Chip>
                              ))}
                            </div>
                          </div>
                        )}

                        {evIdx < g.cleaning_events.length - 1 && <hr className="border-gray-100" />}
                      </div>
                    ))}
                  </div>
                )}

                {/* Beneficios */}
                {g.benefits && (
                  <div className="pt-1">
                    <p className="text-xs text-gray-400 uppercase tracking-wide">Beneficios</p>
                    <p className="text-sm text-gray-700 mt-0.5">{g.benefits}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Accordion>
      )}

      {/* 5. LNT */}
      {hasLnt && (
        <Accordion title="LNT" badge={lntEntries.length}>
          <div className="space-y-1">
            {lntEntries.map((entry) => (
              <div key={entry._localId} className="flex items-center justify-between py-1 text-sm">
                <span className="text-gray-700">{entry.theme_organ || '—'}</span>
                <div className="flex items-center gap-3">
                  <span className="text-gray-500">
                    {entry.initial_energy}% → {entry.final_energy}%
                  </span>
                  <div className="flex gap-1">
                    {entry.healing_energy_body && (
                      <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">Energético</span>
                    )}
                    {entry.healing_spiritual_body && (
                      <span className="text-xs bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded">Espiritual</span>
                    )}
                    {entry.healing_physical_body && (
                      <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">Físico</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Accordion>
      )}

      {/* 6. Ancestros */}
      {hasAncestors && (
        <Accordion title="Ancestros" badge={ancestors.length}>
          <div className="space-y-3">
            {ancestors.map((a) => (
              <div key={a._localId} className="space-y-1">
                <p className="text-sm font-semibold text-[#2C2220]">
                  {a.member || 'Sin nombre'}
                  {a.lineage && (
                    <span className="text-xs font-normal text-gray-500 ml-2">
                      (Linaje {a.lineage})
                    </span>
                  )}
                </p>
                {a.bond_energy.length > 0 && (
                  <p className="text-xs text-gray-500">
                    Energía del vínculo: {a.bond_energy.join(', ')}
                  </p>
                )}
                {a.ancestor_roles.length > 0 && (
                  <p className="text-xs text-gray-500">
                    Roles ancestro: {a.ancestor_roles.join(', ')}
                  </p>
                )}
                {a.consultant_roles.length > 0 && (
                  <p className="text-xs text-gray-500">
                    Roles consultante: {a.consultant_roles.join(', ')}
                  </p>
                )}
                {a.energy_expressions.length > 0 && (
                  <div className="pl-3">
                    <p className="text-xs text-gray-400">Expresiones energéticas:</p>
                    {a.energy_expressions.map((ex, i) => (
                      <p key={i} className="text-xs text-gray-600">
                        #{ex.number} — {ex.expression}
                      </p>
                    ))}
                  </div>
                )}
                {a.family_traumas.length > 0 && (
                  <div className="pl-3">
                    <p className="text-xs text-gray-400">Traumas familiares:</p>
                    {a.family_traumas.map((ft, i) => (
                      <p key={i} className="text-xs text-gray-600">
                        #{ft.number} — {ft.trauma}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {/* Conciliación */}
            {ancestorConciliation && (
              ancestorConciliation.healing_phrases ||
              ancestorConciliation.conciliation_acts ||
              ancestorConciliation.life_aspects_affected ||
              ancestorConciliation.session_relationship
            ) && (
              <div className="border-t border-gray-100 pt-2 space-y-1">
                <p className="text-xs text-gray-400 uppercase tracking-wide">Conciliación</p>
                {ancestorConciliation.healing_phrases && (
                  <p className="text-xs text-gray-600">
                    <span className="font-medium">Frases sanadoras:</span> {ancestorConciliation.healing_phrases}
                  </p>
                )}
                {ancestorConciliation.conciliation_acts && (
                  <p className="text-xs text-gray-600">
                    <span className="font-medium">Actos de conciliación:</span> {ancestorConciliation.conciliation_acts}
                  </p>
                )}
                {ancestorConciliation.life_aspects_affected && (
                  <p className="text-xs text-gray-600">
                    <span className="font-medium">Áreas de vida:</span> {ancestorConciliation.life_aspects_affected}
                  </p>
                )}
                {ancestorConciliation.session_relationship && (
                  <p className="text-xs text-gray-600">
                    <span className="font-medium">Relación con la sesión:</span> {ancestorConciliation.session_relationship}
                  </p>
                )}
              </div>
            )}
          </div>
        </Accordion>
      )}

      {/* 7. Notas generales */}
      {hasNotes && (
        <Accordion title="Notas generales">
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{generalNotes}</p>
        </Accordion>
      )}

      {/* 8. Protecciones */}
      {hasProtections && (
        <Accordion title="Protecciones" badge={protections.filter((p) => p.selected).length}>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span>Se cobra: {protectionCharged ? 'Sí' : 'No'}</span>
            </div>
            <div className="border border-gray-200 rounded-lg divide-y divide-gray-100">
              {protections.map((p) => (
                <div key={p._localId} className={`flex items-center justify-between px-4 py-2 ${!p.selected ? 'opacity-50' : ''}`}>
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${p.selected ? 'bg-green-500' : 'bg-gray-300'}`} />
                    <span className="text-sm text-gray-700">{p.person_name || 'Sin nombre'}</span>
                  </div>
                  <span className="text-sm text-gray-500">{p.quantity} {p.quantity === 1 ? 'protección' : 'protecciones'}</span>
                </div>
              ))}
            </div>
          </div>
        </Accordion>
      )}
    </div>
  );
}

// ─── Toggle reutilizable ──────────────────────────────────────────────────────

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[#2C2220] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
        checked ? 'bg-[#2C2220]' : 'bg-gray-200'
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition-transform duration-200 ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

// ─── Helpers de formato ──────────────────────────────────────────────────────

function formatMXN(amount: number): string {
  return amount.toLocaleString('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

let _nextId = 0;
function localId(): string {
  return `prot_${++_nextId}_${Date.now()}`;
}

// ─── Props ───────────────────────────────────────────────────────────────────

export interface StepCloseProps {
  value: CloseData;
  onChange: (field: keyof CloseData, val: string) => void;
  summary: SessionSummary;
  onCloseSession: () => void;
  disabled?: boolean;
  isClosing?: boolean;
  isCleaningSession?: boolean;
  limpiezasRequeridas?: number;
  /** Grupos de limpieza por persona (de StepCleaning o API). */
  cleaningGroups?: CleaningGroup[];
  /** Callback para actualizar cleaningGroups (toggle is_charged). */
  onCleaningGroupsChange?: (groups: CleaningGroup[]) => void;
  /** Estado de protecciones — controlado desde el padre. */
  protections?: ProtectionEntry[];
  onProtectionsChange?: (protections: ProtectionEntry[]) => void;
  hasProtection?: boolean;
  onHasProtectionChange?: (v: boolean) => void;
  protectionCharged?: boolean;
  onProtectionChargedChange?: (v: boolean) => void;
  /** Datos completos para el resumen de sesión */
  themes?: ThemeEntry[];
  energyInitial?: EnergyReading[];
  energyFinal?: EnergyReading[];
  chakraInitial?: WizardChakraReading[];
  chakraFinal?: WizardChakraReading[];
  lntEntries?: LntEntry[];
  ancestors?: AncestorEntry[];
  ancestorConciliation?: AncestorConciliation | null;
  generalNotes?: string;
  dimensionNames?: { id: string; name: string }[];
  chakraNames?: { id: string; name: string }[];
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
  cleaningGroups = [],
  onCleaningGroupsChange,
  protections: externalProtections,
  onProtectionsChange,
  hasProtection: externalHasProtection,
  onHasProtectionChange,
  protectionCharged: externalProtectionCharged,
  onProtectionChargedChange,
  themes: propThemes = [],
  energyInitial: propEnergyInitial = [],
  energyFinal: propEnergyFinal = [],
  chakraInitial: propChakraInitial = [],
  chakraFinal: propChakraFinal = [],
  lntEntries: propLntEntries = [],
  ancestors: propAncestors = [],
  ancestorConciliation: propAncestorConciliation = null,
  generalNotes: propGeneralNotes = '',
  dimensionNames: propDimensionNames = [],
  chakraNames: propChakraNames = [],
}: StepCloseProps) {
  const paymentNotesId = useId();

  // ─── Estado del cálculo ────────────────────────────────────────────────────
  const [porcentajePago, setPorcentajePago] = useState(100);
  const [incluyeIva, setIncluyeIva]         = useState(false);

  // ─── Protección — estado interno con fallback a props externas ─────────────
  const [internalHasProtection, setInternalHasProtection] = useState(false);
  const [internalProtectionCharged, setInternalProtectionCharged] = useState(false);
  const [internalProtections, setInternalProtections] = useState<ProtectionEntry[]>([]);

  const hasProtection = externalHasProtection ?? internalHasProtection;
  const setHasProtection = onHasProtectionChange ?? setInternalHasProtection;
  const protectionCharged = externalProtectionCharged ?? internalProtectionCharged;
  const setProtectionCharged = onProtectionChargedChange ?? setInternalProtectionCharged;
  const protections = externalProtections ?? internalProtections;
  const setProtections = onProtectionsChange ?? setInternalProtections;

  const addProtection = useCallback(() => {
    setProtections([
      ...protections,
      { _localId: localId(), person_name: '', quantity: 1, selected: true },
    ]);
  }, [protections, setProtections]);

  const updateProtection = useCallback(
    (id: string, patch: Partial<ProtectionEntry>) => {
      setProtections(
        protections.map((p) => (p._localId === id ? { ...p, ...patch } : p)),
      );
    },
    [protections, setProtections],
  );

  const removeProtection = useCallback(
    (id: string) => {
      setProtections(protections.filter((p) => p._localId !== id));
    },
    [protections, setProtections],
  );

  // Inicializar con "Paciente" al activar protección por primera vez
  useEffect(() => {
    if (hasProtection && protections.length === 0) {
      setProtections([
        { _localId: localId(), person_name: 'Paciente', quantity: 1, selected: true },
      ]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasProtection]);

  // ─── Toggle is_charged en grupos de limpieza ───────────────────────────────
  const toggleCleaningCharged = useCallback(
    (groupId: string, charged: boolean) => {
      if (!onCleaningGroupsChange) return;
      onCleaningGroupsChange(
        cleaningGroups.map((g) =>
          g.id === groupId ? { ...g, is_charged: charged } : g,
        ),
      );
    },
    [cleaningGroups, onCleaningGroupsChange],
  );

  // ─── Cálculo de costos ─────────────────────────────────────────────────────

  const therapyBasePrice = PRICE_CATALOG[summary.therapyTypeName] ?? 0;

  // Limpiezas — usar cleaningGroups si están disponibles, si no limpiezasRequeridas legacy
  const hasGroups = cleaningGroups.length > 0;
  const cleaningCostCharged = hasGroups
    ? cleaningGroups
        .filter((g) => g.is_charged)
        .reduce((sum, g) => sum + g.cleanings_required * g.cost_per_cleaning, 0)
    : limpiezasRequeridas * 1300;
  const protectionCostTotal = protections
    .filter((p) => p.selected)
    .reduce((sum, p) => sum + p.quantity * COST_PER_PROTECTION, 0);
  const protectionCostApplied = protectionCharged ? protectionCostTotal : 0;

  const costoBase     = therapyBasePrice + cleaningCostCharged + protectionCostApplied;
  const costoAjustado = costoBase * (porcentajePago / 100);
  const costoFinal    = incluyeIva ? costoAjustado * 1.16 : costoAjustado;

  // Sincronizar costo final con el campo cost del formulario
  useEffect(() => {
    onChange('cost', String(Math.round(costoFinal * 100) / 100));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [costoFinal]);

  const isDisabled = disabled || isClosing;

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

      {/* Resumen completo de sesión */}
      <FullSessionSummary
        themes={propThemes}
        energyInitial={propEnergyInitial}
        energyFinal={propEnergyFinal}
        chakraInitial={propChakraInitial}
        chakraFinal={propChakraFinal}
        lntEntries={propLntEntries}
        cleaningGroups={cleaningGroups ?? []}
        ancestors={propAncestors}
        ancestorConciliation={propAncestorConciliation}
        generalNotes={propGeneralNotes}
        dimensionNames={propDimensionNames}
        chakraNames={propChakraNames}
        protections={protections}
        hasProtection={hasProtection}
        protectionCharged={protectionCharged}
      />

      {/* ── Protección ── */}
      <div className="bg-[#FAF7F5] shadow-[0_2px_8px_rgba(44,34,32,0.06)] rounded-lg p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs uppercase tracking-[0.1em] font-medium text-[#4A3628]">
            Protección
          </h3>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">¿Agregó protección?</span>
            <Toggle
              checked={hasProtection}
              onChange={setHasProtection}
              disabled={isDisabled}
            />
          </div>
        </div>

        {hasProtection && (
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-[0.1em] font-medium text-[#4A3628]">
              ¿A quiénes se agregaron?
            </p>

            <div className="border border-gray-200 rounded-lg divide-y divide-gray-100">
              {protections.map((p) => (
                <div key={p._localId} className="flex items-center gap-3 px-4 py-2.5">
                  {/* Checkbox de selección */}
                  <input
                    type="checkbox"
                    checked={p.selected}
                    disabled={isDisabled}
                    onChange={(e) =>
                      updateProtection(p._localId, { selected: e.target.checked })
                    }
                    className="h-4 w-4 rounded border-gray-300 text-[#2C2220] focus:ring-[#2C2220]"
                  />

                  {/* Nombre */}
                  <input
                    type="text"
                    value={p.person_name}
                    disabled={isDisabled}
                    onChange={(e) =>
                      updateProtection(p._localId, { person_name: e.target.value })
                    }
                    placeholder="Nombre de la persona"
                    className="flex-1 rounded-none border-0 border-b border-[#D4A592] bg-transparent px-1 py-1 text-sm focus:outline-none focus:ring-0 focus:border-b-2 focus:border-[#C4704A] disabled:opacity-50"
                  />

                  {/* Cantidad */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-gray-400">Cantidad:</span>
                    <input
                      type="number"
                      min={1}
                      value={p.quantity}
                      disabled={isDisabled}
                      onChange={(e) =>
                        updateProtection(p._localId, {
                          quantity: Math.max(1, parseInt(e.target.value) || 1),
                        })
                      }
                      className="w-16 rounded-none border-0 border-b border-[#D4A592] bg-transparent px-1 py-1 text-sm text-center focus:outline-none focus:ring-0 focus:border-b-2 focus:border-[#C4704A] disabled:opacity-50"
                    />
                  </div>

                  {/* Eliminar */}
                  <button
                    type="button"
                    disabled={isDisabled}
                    onClick={() => removeProtection(p._localId)}
                    className="text-gray-400 hover:text-red-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-label="Eliminar protección"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>

            {/* Agregar persona */}
            <button
              type="button"
              disabled={isDisabled}
              onClick={addProtection}
              className="flex items-center gap-1.5 text-sm text-[#C4704A] hover:text-[#B5613B] font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Agregar persona
            </button>

            {/* ¿Se cobra protección? */}
            <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
              <span className="text-sm text-gray-500">¿Se cobra protección?</span>
              <Toggle
                checked={protectionCharged}
                onChange={setProtectionCharged}
                disabled={isDisabled}
              />
            </div>
          </div>
        )}
      </div>

      {/* ── Resumen de Costos ── */}
      <div className="bg-[#FAF7F5] shadow-[0_2px_8px_rgba(44,34,32,0.06)] rounded-lg p-5 space-y-4">
        <h3 className="text-xs uppercase tracking-[0.1em] font-medium text-[#4A3628]">
          Resumen de Costos
        </h3>

        {/* Terapia base */}
        <div className="flex items-center justify-between py-1">
          <span className="text-sm text-[#2C2220]">Terapia base</span>
          <span className="text-sm font-medium text-[#2C2220]">{formatMXN(therapyBasePrice)}</span>
        </div>

        {/* Limpiezas */}
        {isCleaningSession && (
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.1em] font-medium text-[#4A3628] pb-1">
              Limpiezas
            </p>
            {hasGroups ? (
              <>
                <div className="border border-gray-200 rounded-lg divide-y divide-gray-100">
                  {cleaningGroups.map((g) => {
                    const groupCost = g.cleanings_required * g.cost_per_cleaning;
                    const charged = g.is_charged;
                    return (
                      <div
                        key={g.id}
                        className={`flex items-center gap-3 px-4 py-2.5 transition-colors ${
                          !charged ? 'bg-gray-50' : ''
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={charged}
                          disabled={isDisabled || !onCleaningGroupsChange}
                          onChange={(e) => toggleCleaningCharged(g.id, e.target.checked)}
                          className="h-4 w-4 rounded border-gray-300 text-[#2C2220] focus:ring-[#2C2220]"
                        />
                        <div className="flex-1 min-w-0">
                          <span className={`text-sm ${charged ? 'text-[#2C2220]' : 'text-gray-400'}`}>
                            {g.target_name}
                          </span>
                          <span className={`text-xs ml-1.5 ${charged ? 'text-gray-500' : 'text-gray-400'}`}>
                            — {g.cleanings_required} {g.cleanings_required === 1 ? 'limpieza' : 'limpiezas'}
                          </span>
                          {!charged && (
                            <span className="ml-2 inline-block text-xs bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded">
                              Sin cargo
                            </span>
                          )}
                        </div>
                        <span className={`text-sm font-medium whitespace-nowrap ${
                          charged ? 'text-[#2C2220]' : 'text-gray-400 line-through'
                        }`}>
                          {formatMXN(groupCost)}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Total limpiezas seleccionadas */}
                {(() => {
                  const selectedGroups = cleaningGroups.filter((g) => g.is_charged);
                  const totalCleanings = selectedGroups.reduce((s, g) => s + g.cleanings_required, 0);
                  return (
                    <div className="flex items-center justify-between pt-1 text-xs text-gray-500">
                      <span>
                        Total seleccionadas: {totalCleanings} {totalCleanings === 1 ? 'limpieza' : 'limpiezas'}
                        {selectedGroups.length < cleaningGroups.length && (
                          <span className="text-gray-400 ml-1">
                            ({cleaningGroups.length - selectedGroups.length} sin cargo)
                          </span>
                        )}
                      </span>
                      <span className="font-medium text-[#2C2220] text-sm">{formatMXN(cleaningCostCharged)}</span>
                    </div>
                  );
                })()}
              </>
            ) : (
              <div className="flex items-center justify-between py-1 text-[#2C2220]">
                <span className="text-sm">
                  Paciente ({limpiezasRequeridas} {limpiezasRequeridas === 1 ? 'limpieza' : 'limpiezas'})
                </span>
                <span className="text-sm font-medium">{formatMXN(cleaningCostCharged)}</span>
              </div>
            )}
          </div>
        )}

        {/* Protecciones */}
        {hasProtection && protectionCharged && protections.some((p) => p.selected) && (
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.1em] font-medium text-[#4A3628] pb-1">
              Protecciones
            </p>
            {protections
              .filter((p) => p.selected)
              .map((p) => (
                <div
                  key={p._localId}
                  className="flex items-center justify-between py-1 text-[#2C2220]"
                >
                  <span className="text-sm">
                    {p.person_name || 'Sin nombre'} ({p.quantity})
                  </span>
                  <span className="text-sm font-medium">
                    {formatMXN(p.quantity * COST_PER_PROTECTION)}
                  </span>
                </div>
              ))}
          </div>
        )}

        {/* Separador + Subtotal */}
        <div className="border-t border-[#D4A592] pt-3 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-[#2C2220]">Subtotal</span>
            <span className="text-sm font-semibold text-[#2C2220]">{formatMXN(costoBase)}</span>
          </div>

          {/* Porcentaje que puede pagar — slider */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">× Porcentaje pago</span>
              <span className="text-sm font-semibold text-[#2C2220]">{porcentajePago}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={porcentajePago}
              disabled={isDisabled}
              onChange={(e) => setPorcentajePago(Number(e.target.value))}
              className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-[#2C2220] disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: `linear-gradient(to right, #2C2220 0%, #C4704A ${porcentajePago}%, #e5e7eb ${porcentajePago}%)`,
              }}
            />
          </div>

          {/* +IVA toggle */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">× IVA</span>
            <Toggle
              checked={incluyeIva}
              onChange={setIncluyeIva}
              disabled={isDisabled}
            />
          </div>
        </div>

        {/* TOTAL */}
        <div className="flex items-center justify-between pt-3 border-t border-[#D4A592]">
          <span className="text-lg font-semibold text-[#2C2220]">TOTAL</span>
          <span className="text-lg font-semibold text-[#2C2220]">{formatMXN(costoFinal)}</span>
        </div>
      </div>

      {/* Notas de pago */}
      <div className="flex flex-col gap-1">
        <label htmlFor={paymentNotesId} className="text-xs uppercase tracking-[0.1em] font-normal text-[#4A3628]">
          Notas de pago
        </label>
        <input
          id={paymentNotesId}
          type="text"
          value={value.payment_notes}
          disabled={isDisabled}
          onChange={(e) => onChange('payment_notes', e.target.value)}
          placeholder="Método de pago, referencia…"
          className="rounded-none border-0 border-b border-[#D4A592] bg-[#FAF7F5] px-3 py-2 text-sm focus:outline-none focus:ring-0 focus:border-b-2 focus:border-[#C4704A] disabled:opacity-50 disabled:cursor-not-allowed"
        />
      </div>

      {/* Hidden cost field — always auto-calculated now */}
      <input type="hidden" name="cost" value={value.cost} />

      {/* Botón de cierre */}
      <div className="pt-2">
        <button
          type="button"
          onClick={onCloseSession}
          disabled={isDisabled}
          className="w-full flex items-center justify-center gap-2 rounded-md bg-[#1E5631] px-4 py-3 text-sm font-semibold text-white hover:bg-[#174926] focus:outline-none focus:ring-2 focus:ring-[#1E5631] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
