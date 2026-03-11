'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Zap } from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import { getChakraColor } from '@/components/clinical/chakra-colors';
import { formatDateTime, formatCurrency } from '@/lib/utils/formatters';

// ─── Tipos locales ────────────────────────────────────────────────────────────

interface EnergyReading {
  id: string;
  dimension_id: string;
  dimension_name: string;
  initial_value: number | null;
  final_value: number | null;
}

interface ChakraReading {
  id: string;
  chakra_position_id: string;
  chakra_name: string;
  chakra_position: number;
  initial_value: number | null;
  final_value: number | null;
}

interface TopicItem {
  id: string;
  source_type: string;
  zone: string | null;
  adult_theme: string | null;
  child_theme: string | null;
  adult_age: number | null;
  child_age: number | null;
  emotions: string | null;
  initial_energy: number | null;
  final_energy: number | null;
}

interface LNTEntry {
  id: string;
  theme_organ: string | null;
  initial_energy: number | null;
  final_energy: number | null;
  healing_energy_body: boolean | null;
  healing_spiritual_body: boolean | null;
  healing_physical_body: boolean | null;
}

interface CleaningEvent {
  id: string;
  layer: string | null;
  quantity: number | null;
  aura_color: string | null;
  cleanings_required: number | null;
  manifestation: string | null;
  materials_used: string | null;
  creation_moment: string | null;
  energy_level: number | null;
  origin: string | null;
  person: string | null;
  work_done: string | null;
  life_area: string | null;
}

interface AffectationItem {
  id: string;
  chakra_position_id: string | null;
  organ_gland: string | null;
  affectation_type: string | null;
  initial_energy: number | null;
  final_energy: number | null;
  adult_age: number | null;
  child_age: number | null;
  adult_theme: string | null;
  child_theme: string | null;
}

interface OrganItem {
  id: string;
  source_type: string;
  name: string | null;
  initial_energy: number | null;
  final_energy: number | null;
  adult_age: number | null;
  child_age: number | null;
  adult_theme: string | null;
  child_theme: string | null;
  emotions: string | null;
}

interface SessionFullDetail {
  id: string;
  client_id: string | null;
  therapist_id: string | null;
  therapy_type_id: string | null;
  therapy_type_name: string | null;
  session_number: number | null;
  measured_at: string;
  general_energy_level: number | null;
  cost: number | null;
  entities_count: number | null;
  implants_count: number | null;
  total_cleanings: number | null;
  bud: string | null;
  bud_chakra: string | null;
  payment_notes: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  energy_readings: EnergyReading[];
  chakra_readings: ChakraReading[];
  topics: TopicItem[];
  lnt_entries: LNTEntry[];
  cleaning_events: CleaningEvent[];
  affectations: AffectationItem[];
  organs: OrganItem[];
}

// ─── Componentes auxiliares ───────────────────────────────────────────────────

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-terra-100 shadow-sm p-6">
      <h2 className="font-display text-lg font-semibold text-terra-900 mb-4">
        {title}
      </h2>
      {children}
    </div>
  );
}

function Delta({
  initial,
  final,
}: {
  initial: number | null;
  final: number | null;
}) {
  if (initial == null || final == null)
    return <span className="text-gray-300">—</span>;
  const delta = Number(final) - Number(initial);
  const sign = delta > 0 ? '+' : '';
  const cls =
    delta > 0
      ? 'text-green-600 font-medium'
      : delta < 0
        ? 'text-red-600 font-medium'
        : 'text-gray-400';
  return (
    <span className={cls}>
      {sign}
      {delta}
    </span>
  );
}

function NumCell({ value }: { value: number | null }) {
  if (value == null) return <span className="text-gray-300">—</span>;
  return <span>{value}</span>;
}

function MetaBadge({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs uppercase tracking-wide text-gray-400 font-medium mb-0.5">
        {label}
      </span>
      <span className="text-sm font-semibold text-terra-900">{value}</span>
    </div>
  );
}

function SkeletonDetail() {
  return (
    <div className="space-y-6 max-w-4xl animate-pulse">
      <div className="h-4 bg-terra-100 rounded w-32" />
      <div className="h-8 bg-terra-100 rounded w-64" />
      <div className="space-y-3">
        {[80, 60, 70, 50].map((w, i) => (
          <div key={i} className="h-4 bg-terra-100 rounded" style={{ width: `${w}%` }} />
        ))}
      </div>
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function SessionDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [session, setSession] = useState<SessionFullDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .get<SessionFullDetail>(`/api/v1/clinical/sessions/${params.id}`)
      .then(setSession)
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : 'Error al cargar la sesión.'),
      )
      .finally(() => setLoading(false));
  }, [params.id]);

  if (loading) return <div className="max-w-4xl"><SkeletonDetail /></div>;
  if (error)
    return (
      <div className="max-w-4xl space-y-4">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1 text-sm text-terra-700 hover:text-terra-900"
        >
          <ArrowLeft className="h-4 w-4" /> Volver
        </button>
        <p className="text-sm text-red-600">{error}</p>
      </div>
    );
  if (!session) return null;

  const backHref = session.client_id
    ? `/clinica/pacientes/${session.client_id}`
    : '/clinica/sesiones';

  // Solo dimensiones con al menos un valor registrado
  const energyRows = session.energy_readings.filter(
    (r) => r.initial_value != null || r.final_value != null,
  );
  // Chakras ordenados por posición
  const chakraRows = [...session.chakra_readings]
    .filter((r) => r.initial_value != null || r.final_value != null)
    .sort((a, b) => a.chakra_position - b.chakra_position);

  const activeTopics = session.topics.filter((t) => !('deleted_at' in t && t.deleted_at));
  const activeLNT = session.lnt_entries.filter((e) => !('deleted_at' in e && e.deleted_at));
  const activeCleanings = session.cleaning_events.filter((e) => !('deleted_at' in e && e.deleted_at));
  const activeAffectations = session.affectations.filter((e) => !('deleted_at' in e && e.deleted_at));
  const activeOrgans = session.organs.filter((e) => !('deleted_at' in e && e.deleted_at));

  const hasOtros =
    activeLNT.length > 0 ||
    activeCleanings.length > 0 ||
    activeAffectations.length > 0 ||
    activeOrgans.length > 0;

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Volver */}
      <button
        onClick={() => router.push(backHref)}
        className="flex items-center gap-1 text-sm text-terra-700 hover:text-terra-900 transition-colors -ml-1"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver al paciente
      </button>

      {/* ── Encabezado ── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-terra-400 font-medium mb-1">
            Sesión {session.session_number != null ? `#${session.session_number}` : ''}
          </p>
          <h1 className="font-display text-2xl font-bold text-terra-900 leading-tight">
            {formatDateTime(session.measured_at)}
          </h1>
          {session.therapy_type_name && (
            <p className="text-sm text-terra-600 mt-1">{session.therapy_type_name}</p>
          )}
        </div>
        {session.cost != null && (
          <span className="inline-flex items-center h-9 px-4 rounded-full bg-terra-50 border border-terra-200 text-terra-700 font-semibold text-sm">
            {formatCurrency(session.cost)}
          </span>
        )}
      </div>

      {/* ── Sección 1: Resumen general ── */}
      <SectionCard title="Resumen general">
        <div className="flex flex-wrap gap-6 mb-4">
          {session.general_energy_level != null && (
            <div className="flex items-center gap-3 bg-terra-50 rounded-xl px-4 py-3">
              <Zap className="h-5 w-5 text-terra-500 shrink-0" />
              <div>
                <p className="text-xs uppercase tracking-wide text-terra-400 font-medium">
                  Energía general
                </p>
                <p className="text-2xl font-bold text-terra-900 leading-none mt-0.5">
                  {session.general_energy_level}
                </p>
              </div>
            </div>
          )}

          {(session.entities_count != null && session.entities_count > 0) && (
            <MetaBadge label="Entidades" value={session.entities_count} />
          )}
          {(session.implants_count != null && session.implants_count > 0) && (
            <MetaBadge label="Implantes" value={session.implants_count} />
          )}
          {(session.total_cleanings != null && session.total_cleanings > 0) && (
            <MetaBadge label="Limpiezas" value={session.total_cleanings} />
          )}
          {session.bud && (
            <MetaBadge label="Bud" value={session.bud} />
          )}
          {session.bud_chakra && (
            <MetaBadge label="Chakra Bud" value={session.bud_chakra} />
          )}
        </div>

        {session.notes && (
          <div className="mb-3">
            <p className="text-xs uppercase tracking-wide text-gray-400 font-medium mb-2">
              Notas
            </p>
            <div className="bg-amber-50/60 border-l-4 border-amber-300 rounded-r-xl p-4">
              <p className="text-sm text-amber-900 leading-relaxed whitespace-pre-wrap">
                {session.notes}
              </p>
            </div>
          </div>
        )}

        {session.payment_notes && (
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-400 font-medium mb-1">
              Notas de pago
            </p>
            <p className="text-sm text-terra-800">{session.payment_notes}</p>
          </div>
        )}
      </SectionCard>

      {/* ── Sección 2: Dimensiones energéticas ── */}
      {energyRows.length > 0 && (
        <SectionCard title="Dimensiones energéticas">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-terra-100 text-xs uppercase tracking-wide text-terra-500">
                  <th className="text-left py-2 pr-4 font-medium">Dimensión</th>
                  <th className="text-center py-2 px-3 font-medium w-20">Inicial</th>
                  <th className="text-center py-2 px-3 font-medium w-20">Final</th>
                  <th className="text-center py-2 pl-3 font-medium w-20">Delta</th>
                </tr>
              </thead>
              <tbody>
                {energyRows.map((r) => (
                  <tr key={r.id} className="border-b border-terra-50 hover:bg-terra-50/30">
                    <td className="py-2.5 pr-4 text-terra-800 font-medium">{r.dimension_name}</td>
                    <td className="py-2.5 px-3 text-center text-terra-600">
                      <NumCell value={r.initial_value} />
                    </td>
                    <td className="py-2.5 px-3 text-center text-terra-600">
                      <NumCell value={r.final_value} />
                    </td>
                    <td className="py-2.5 pl-3 text-center">
                      <Delta initial={r.initial_value} final={r.final_value} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}

      {/* ── Sección 3: Chakras ── */}
      {chakraRows.length > 0 && (
        <SectionCard title="Chakras">
          <p className="text-xs text-gray-400 mb-3">Escala 0 – 14</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-terra-100 text-xs uppercase tracking-wide text-terra-500">
                  <th className="text-left py-2 pr-4 font-medium">Chakra</th>
                  <th className="text-center py-2 px-3 font-medium w-20">Inicial</th>
                  <th className="text-center py-2 px-3 font-medium w-20">Final</th>
                  <th className="text-center py-2 pl-3 font-medium w-20">Delta</th>
                </tr>
              </thead>
              <tbody>
                {chakraRows.map((r) => {
                  const color = getChakraColor(r.chakra_name);
                  return (
                    <tr key={r.id} className="border-b border-terra-50 hover:bg-terra-50/30">
                      <td className="py-2.5 pr-4">
                        <div className="flex items-center gap-2">
                          <span
                            className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: color }}
                          />
                          <span className="text-terra-800 font-medium">{r.chakra_name}</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-center text-terra-600">
                        <NumCell value={r.initial_value} />
                      </td>
                      <td className="py-2.5 px-3 text-center text-terra-600">
                        <NumCell value={r.final_value} />
                      </td>
                      <td className="py-2.5 pl-3 text-center">
                        <Delta initial={r.initial_value} final={r.final_value} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}

      {/* ── Sección 4: Temas trabajados ── */}
      {activeTopics.length > 0 && (
        <SectionCard title="Temas trabajados">
          <div className="space-y-4">
            {activeTopics.map((t, idx) => (
              <div
                key={t.id}
                className="border border-terra-100 rounded-lg p-4 space-y-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-medium text-terra-500 uppercase tracking-wide">
                    Tema {idx + 1}
                  </span>
                  <span className="text-xs bg-terra-50 text-terra-600 border border-terra-100 rounded-full px-2 py-0.5">
                    {t.source_type}
                  </span>
                </div>

                {t.zone && (
                  <p className="text-sm font-semibold text-terra-900">{t.zone}</p>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  {t.adult_theme && (
                    <div>
                      <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-0.5">
                        Tema adulto
                        {t.adult_age != null ? ` (${t.adult_age} años)` : ''}
                      </p>
                      <p className="text-terra-800">{t.adult_theme}</p>
                    </div>
                  )}
                  {t.child_theme && (
                    <div>
                      <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-0.5">
                        Tema infancia
                        {t.child_age != null ? ` (${t.child_age} años)` : ''}
                      </p>
                      <p className="text-terra-800">{t.child_theme}</p>
                    </div>
                  )}
                  {t.emotions && (
                    <div className="sm:col-span-2">
                      <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-0.5">
                        Emociones
                      </p>
                      <p className="text-terra-800">{t.emotions}</p>
                    </div>
                  )}
                </div>

                {(t.initial_energy != null || t.final_energy != null) && (
                  <div className="flex gap-6 pt-1 border-t border-terra-50">
                    {t.initial_energy != null && (
                      <div>
                        <span className="text-xs text-gray-400">Inicial: </span>
                        <span className="text-sm font-medium text-terra-700">{t.initial_energy}</span>
                      </div>
                    )}
                    {t.final_energy != null && (
                      <div>
                        <span className="text-xs text-gray-400">Final: </span>
                        <span className="text-sm font-medium text-terra-700">{t.final_energy}</span>
                      </div>
                    )}
                    {t.initial_energy != null && t.final_energy != null && (
                      <div>
                        <span className="text-xs text-gray-400">Delta: </span>
                        <Delta initial={t.initial_energy} final={t.final_energy} />
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* ── Sección 5: Otros datos ── */}
      {hasOtros && (
        <SectionCard title="Otros datos">
          <div className="space-y-6">

            {/* LNT */}
            {activeLNT.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-terra-700 mb-3 uppercase tracking-wide">
                  LNT
                </h3>
                <div className="space-y-3">
                  {activeLNT.map((e) => (
                    <div key={e.id} className="border border-terra-100 rounded-lg p-4 text-sm space-y-2">
                      {e.theme_organ && (
                        <p className="font-medium text-terra-900">{e.theme_organ}</p>
                      )}
                      <div className="flex flex-wrap gap-4 text-terra-600">
                        {e.initial_energy != null && <span>Inicial: {e.initial_energy}</span>}
                        {e.final_energy != null && <span>Final: {e.final_energy}</span>}
                      </div>
                      <div className="flex flex-wrap gap-3">
                        {e.healing_energy_body && (
                          <span className="text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded-full px-2 py-0.5">
                            Cuerpo energético
                          </span>
                        )}
                        {e.healing_spiritual_body && (
                          <span className="text-xs bg-purple-50 text-purple-700 border border-purple-200 rounded-full px-2 py-0.5">
                            Cuerpo espiritual
                          </span>
                        )}
                        {e.healing_physical_body && (
                          <span className="text-xs bg-green-50 text-green-700 border border-green-200 rounded-full px-2 py-0.5">
                            Cuerpo físico
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Eventos de limpieza */}
            {activeCleanings.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-terra-700 mb-3 uppercase tracking-wide">
                  Eventos de limpieza
                </h3>
                <div className="space-y-3">
                  {activeCleanings.map((e) => (
                    <div key={e.id} className="border border-terra-100 rounded-lg p-4 text-sm space-y-2">
                      <div className="flex flex-wrap gap-3">
                        {e.layer && <MetaBadge label="Capa" value={e.layer} />}
                        {e.quantity != null && <MetaBadge label="Cantidad" value={e.quantity} />}
                        {e.aura_color && <MetaBadge label="Color de aura" value={e.aura_color} />}
                        {e.cleanings_required != null && (
                          <MetaBadge label="Limpiezas requeridas" value={e.cleanings_required} />
                        )}
                        {e.energy_level != null && (
                          <MetaBadge label="Nivel energético" value={e.energy_level} />
                        )}
                      </div>
                      {e.manifestation && (
                        <p className="text-terra-700">
                          <span className="text-xs text-gray-400 font-medium uppercase tracking-wide mr-1">Manifestación:</span>
                          {e.manifestation}
                        </p>
                      )}
                      {e.origin && (
                        <p className="text-terra-700">
                          <span className="text-xs text-gray-400 font-medium uppercase tracking-wide mr-1">Origen:</span>
                          {e.origin}
                        </p>
                      )}
                      {e.work_done && (
                        <p className="text-terra-700">
                          <span className="text-xs text-gray-400 font-medium uppercase tracking-wide mr-1">Trabajo realizado:</span>
                          {e.work_done}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Afectaciones */}
            {activeAffectations.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-terra-700 mb-3 uppercase tracking-wide">
                  Afectaciones
                </h3>
                <div className="space-y-3">
                  {activeAffectations.map((e) => (
                    <div key={e.id} className="border border-terra-100 rounded-lg p-4 text-sm space-y-2">
                      <div className="flex flex-wrap gap-3">
                        {e.organ_gland && <MetaBadge label="Órgano / glándula" value={e.organ_gland} />}
                        {e.affectation_type && <MetaBadge label="Tipo" value={e.affectation_type} />}
                        {e.initial_energy != null && <MetaBadge label="Inicial" value={e.initial_energy} />}
                        {e.final_energy != null && <MetaBadge label="Final" value={e.final_energy} />}
                      </div>
                      {e.adult_theme && (
                        <p className="text-terra-700">
                          <span className="text-xs text-gray-400 font-medium uppercase tracking-wide mr-1">
                            Adulto{e.adult_age != null ? ` (${e.adult_age}a)` : ''}:
                          </span>
                          {e.adult_theme}
                        </p>
                      )}
                      {e.child_theme && (
                        <p className="text-terra-700">
                          <span className="text-xs text-gray-400 font-medium uppercase tracking-wide mr-1">
                            Infancia{e.child_age != null ? ` (${e.child_age}a)` : ''}:
                          </span>
                          {e.child_theme}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Órganos */}
            {activeOrgans.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-terra-700 mb-3 uppercase tracking-wide">
                  Órganos
                </h3>
                <div className="space-y-3">
                  {activeOrgans.map((e) => (
                    <div key={e.id} className="border border-terra-100 rounded-lg p-4 text-sm space-y-2">
                      <div className="flex flex-wrap gap-3">
                        {e.name && <MetaBadge label="Nombre" value={e.name} />}
                        <MetaBadge label="Tipo" value={e.source_type} />
                        {e.initial_energy != null && <MetaBadge label="Inicial" value={e.initial_energy} />}
                        {e.final_energy != null && <MetaBadge label="Final" value={e.final_energy} />}
                      </div>
                      {e.adult_theme && (
                        <p className="text-terra-700">
                          <span className="text-xs text-gray-400 font-medium uppercase tracking-wide mr-1">
                            Adulto{e.adult_age != null ? ` (${e.adult_age}a)` : ''}:
                          </span>
                          {e.adult_theme}
                        </p>
                      )}
                      {e.child_theme && (
                        <p className="text-terra-700">
                          <span className="text-xs text-gray-400 font-medium uppercase tracking-wide mr-1">
                            Infancia{e.child_age != null ? ` (${e.child_age}a)` : ''}:
                          </span>
                          {e.child_theme}
                        </p>
                      )}
                      {e.emotions && (
                        <p className="text-terra-700">
                          <span className="text-xs text-gray-400 font-medium uppercase tracking-wide mr-1">Emociones:</span>
                          {e.emotions}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </SectionCard>
      )}

      {/* Pie de página */}
      <p className="text-xs text-gray-400 pb-6">
        Sesión creada el {formatDateTime(session.created_at)}
      </p>
    </div>
  );
}
