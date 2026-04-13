'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Download, Trash2, Zap, ChevronDown, AlertCircle, RefreshCw } from 'lucide-react';
import { apiClient } from '@/lib/api/client';
import { useAuthStore } from '@/store/auth';
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

type ThemeEntryType =
  | 'bloqueo_1'
  | 'bloqueo_2'
  | 'bloqueo_3'
  | 'resultante'
  | 'edad_adulta'
  | 'edad_infancia';

interface ThemeEntryRow {
  id: string;
  client_topic_id: string | null;
  entry_type: ThemeEntryType | string;
  chakra_position_id: string | null;
  organ_name: string | null;
  initial_energy: string | number | null;
  final_energy: string | number | null;
  childhood_age: number | null;
  adulthood_age: number | null;
  childhood_place: string | null;
  childhood_people: string | null;
  childhood_situation: string | null;
  childhood_description: string | null;
  childhood_emotions: string | null;
  adulthood_place: string | null;
  adulthood_people: string | null;
  adulthood_situation: string | null;
  adulthood_description: string | null;
  adulthood_emotions: string | null;
}

interface ClientTopicLite {
  id: string;
  name: string;
  progress_pct: number;
  is_completed: boolean;
}

interface LNTEntry {
  id: string;
  theme_organ: string | null;
  initial_energy: number | null;
  final_energy: number | null;
  healing_energy_body: boolean | null;
  healing_spiritual_body: boolean | null;
  healing_physical_body: boolean | null;
  peticiones: string | null;
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

interface AncestorItem {
  id: string;
  member: string | null;
  lineage: string | null;
  bond_energy: string[] | null;
  ancestor_roles: string[] | null;
  consultant_roles: string[] | null;
  energy_expressions: { number: number; expression: string }[] | null;
  family_traumas: { number: number; trauma: string }[] | null;
}

interface AncestorConciliationItem {
  id: string;
  healing_phrases: string | null;
  conciliation_acts: string | null;
  life_aspects_affected: string | null;
  session_relationship: string | null;
}

interface ProtectionItem {
  id: string;
  recipient_type: string;
  recipient_name: string | null;
  family_member_id: string | null;
  quantity: number;
  cost_per_unit: string | number | null;
}

interface CleaningGroupItem {
  id: string;
  target_name: string;
  cleanings_required: number;
  cost_per_cleaning: number;
  is_charged: boolean;
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
  // Resumen de limpiezas
  capas: number | null;
  limpiezas_requeridas: number | null;
  mesa_utilizada: string | null;
  beneficios: string | null;
  // Protección (flags — el array de protecciones se carga por separado)
  has_protection: boolean | null;
  protection_charged: boolean | null;
  // Grupos de limpieza
  cleaning_groups: CleaningGroupItem[];
  // Costos calculados
  porcentaje_pago: number | null;
  incluye_iva: boolean | null;
  costo_calculado: number | null;
  created_at: string;
  updated_at: string;
  energy_readings: EnergyReading[];
  chakra_readings: ChakraReading[];
  topics: TopicItem[];
  lnt_entries: LNTEntry[];
  cleaning_events: CleaningEvent[];
  affectations: AffectationItem[];
  organs: OrganItem[];
  ancestors: AncestorItem[];
  ancestor_conciliation: AncestorConciliationItem | null;
}

// ─── Componentes auxiliares ───────────────────────────────────────────────────

function CollapsibleCard({
  title,
  defaultOpen = true,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details open={defaultOpen} className="group bg-terra-50 rounded-lg shadow-[0_2px_8px_rgba(44,34,32,0.06)]">
      <summary className="flex items-center justify-between cursor-pointer p-5 select-none">
        <h2 className="font-display text-lg font-semibold text-terra-900">
          {title}
        </h2>
        <ChevronDown className="h-5 w-5 text-terra-400 transition-transform group-open:rotate-180" />
      </summary>
      <div className="px-5 pb-5 pt-0">
        {children}
      </div>
    </details>
  );
}

function Delta({
  initial,
  final: fin,
}: {
  initial: number | null;
  final: number | null;
}) {
  if (initial == null || fin == null)
    return <span className="text-terra-200">—</span>;
  const delta = Number(fin) - Number(initial);
  const sign = delta > 0 ? '+' : '';
  const cls =
    delta > 0
      ? 'text-green-600 font-medium'
      : delta < 0
        ? 'text-red-600 font-medium'
        : 'text-terra-400';
  return (
    <span className={cls}>
      {sign}
      {delta}
    </span>
  );
}

function NumCell({ value }: { value: number | null }) {
  if (value == null) return <span className="text-terra-200">—</span>;
  return <span>{value}</span>;
}

function MetaBadge({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs uppercase tracking-wide text-terra-400 font-medium mb-0.5">
        {label}
      </span>
      <span className="text-sm font-semibold text-terra-900">{value}</span>
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center text-xs bg-terra-50 text-terra-700 border border-terra-200 rounded-full px-2.5 py-0.5">
      {children}
    </span>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs uppercase tracking-wide text-terra-400 font-medium mb-0.5">
      {children}
    </p>
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Pipe-delimited string → comma-separated display */

function notEmpty<T>(arr: T[] | undefined | null): arr is T[] {
  return Array.isArray(arr) && arr.length > 0;
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function SessionDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';
  const [session, setSession] = useState<SessionFullDetail | null>(null);
  const [themeEntries, setThemeEntries] = useState<ThemeEntryRow[]>([]);
  const [protections, setProtections] = useState<ProtectionItem[]>([]);
  const [clientTopics, setClientTopics] = useState<ClientTopicLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleDownloadPdf() {
    if (!session || isDownloading) return;
    setIsDownloading(true);
    try {
      const response = await apiClient.raw(`/api/v1/clinical/sessions/${session.id}/pdf`, {
        method: 'GET',
      });
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sesion_${session.id.slice(0, 8)}_${new Date(session.measured_at).toISOString().slice(0, 10)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('PDF download failed:', err);
    } finally {
      setIsDownloading(false);
    }
  }

  async function handleDeleteSession() {
    if (!session || isDeleting) return;
    const confirmed = window.confirm(
      '¿Estás seguro de que deseas eliminar esta sesión? Esta acción no se puede deshacer.',
    );
    if (!confirmed) return;
    setIsDeleting(true);
    try {
      await apiClient.delete(`/api/v1/clinical/sessions/${session.id}`);
      router.push('/clinica/sesiones');
    } catch (err) {
      console.error('Delete session failed:', err);
      setIsDeleting(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const s = await apiClient.get<SessionFullDetail>(
          `/api/v1/clinical/sessions/${params.id}`,
        );
        if (cancelled) return;
        setSession(s);

        // Cargar sub-recursos en paralelo (no-fatal: si fallan, seguimos con lo que haya)
        const [themeRes, protRes, topicsRes] = await Promise.allSettled([
          apiClient.get<ThemeEntryRow[]>(
            `/api/v1/clinical/sessions/${params.id}/theme-entries`,
          ),
          apiClient.get<{ protections: ProtectionItem[] }>(
            `/api/v1/clinical/sessions/${params.id}/protections`,
          ),
          s.client_id
            ? apiClient.get<ClientTopicLite[]>(
                `/api/v1/clinical/clients/${s.client_id}/topics`,
              )
            : Promise.resolve<ClientTopicLite[]>([]),
        ]);
        if (cancelled) return;
        if (themeRes.status === 'fulfilled' && Array.isArray(themeRes.value)) {
          setThemeEntries(themeRes.value);
        }
        if (
          protRes.status === 'fulfilled' &&
          Array.isArray(protRes.value?.protections)
        ) {
          setProtections(protRes.value.protections);
        }
        if (topicsRes.status === 'fulfilled' && Array.isArray(topicsRes.value)) {
          setClientTopics(topicsRes.value);
        }
      } catch (e: unknown) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Error al cargar la sesión.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
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
        <div className="border-l-4 border-red-400 bg-red-50 rounded-r-xl p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-800">Error al cargar los datos</p>
            <p className="text-sm text-red-600 mt-0.5">{error}</p>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="flex items-center gap-1.5 text-sm font-medium text-red-700 hover:text-red-900 transition-colors shrink-0"
          >
            <RefreshCw className="h-4 w-4" />
            Reintentar
          </button>
        </div>
      </div>
    );
  if (!session) return null;

  const backHref = session.client_id
    ? `/clinica/pacientes/${session.client_id}`
    : '/clinica/sesiones';

  // Filtrar datos activos (sin soft-delete)
  const energyRows = session.energy_readings.filter(
    (r) => r.initial_value != null || r.final_value != null,
  );
  const chakraRows = [...session.chakra_readings]
    .filter((r) => r.initial_value != null || r.final_value != null)
    .sort((a, b) => a.chakra_position - b.chakra_position);
  const activeTopics = session.topics.filter((t) => !('deleted_at' in t && (t as Record<string, unknown>).deleted_at));
  const activeLNT = session.lnt_entries.filter((e) => !('deleted_at' in e && (e as Record<string, unknown>).deleted_at));
  const activeCleanings = session.cleaning_events.filter((e) => !('deleted_at' in e && (e as Record<string, unknown>).deleted_at));
  const activeAffectations = session.affectations.filter((e) => !('deleted_at' in e && (e as Record<string, unknown>).deleted_at));
  const activeOrgans = session.organs.filter((e) => !('deleted_at' in e && (e as Record<string, unknown>).deleted_at));
  const activeAncestors = session.ancestors.filter((e) => !('deleted_at' in e && (e as Record<string, unknown>).deleted_at));

  // Determinar si hay datos de limpieza (summary o eventos)
  const hasCleaningData =
    activeCleanings.length > 0 ||
    (session.capas != null && session.capas > 0) ||
    (session.limpiezas_requeridas != null && session.limpiezas_requeridas > 0) ||
    !!session.mesa_utilizada ||
    !!session.beneficios;

  const hasAncestorData = activeAncestors.length > 0 || session.ancestor_conciliation != null;

  const hasProtectionData = protections.length > 0;

  // Mapeo chakra_position_id → { name, position } (para el nuevo render de temas)
  const chakraById = new Map<string, { name: string; position: number }>();
  for (const r of session.chakra_readings) {
    if (r.chakra_position_id) {
      chakraById.set(r.chakra_position_id, {
        name: r.chakra_name,
        position: r.chakra_position,
      });
    }
  }

  const toNum = (v: string | number | null): number | null => {
    if (v == null) return null;
    const n = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(n) ? n : null;
  };

  // Agrupar theme-entries por client_topic_id
  const themeGroups = (() => {
    const map = new Map<string, ThemeEntryRow[]>();
    for (const e of themeEntries) {
      const key = e.client_topic_id ?? '__sin_tema__';
      const arr = map.get(key) ?? [];
      arr.push(e);
      map.set(key, arr);
    }
    return Array.from(map.entries()).map(([topicId, entries]) => {
      const topic = clientTopics.find((t) => t.id === topicId);
      return { topicId, topicName: topic?.name ?? 'Tema sin asignar', progress: topic?.progress_pct ?? null, entries };
    });
  })();

  // Grupos de limpieza (puede venir vacío si el backend aún no los soporta)
  const cleaningGroupsData = Array.isArray(session.cleaning_groups) ? session.cleaning_groups : [];

  // ¿Tiene mediciones finales? Si no, es sesión de limpieza (solo mostrar iniciales)
  const hasFinalEnergy = energyRows.some((r) => r.final_value != null);
  const hasFinalChakra = chakraRows.some((r) => r.final_value != null);

  return (
    <div className="space-y-5 max-w-4xl">
      {/* Volver + Descargar PDF */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.push(backHref)}
          className="flex items-center gap-1 h-9 text-sm text-terra-700 hover:text-terra-900 transition-colors -ml-1"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver al paciente
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={handleDownloadPdf}
            disabled={isDownloading}
            className="flex items-center gap-2 rounded-md bg-[#C4704A] px-4 h-9 text-sm font-medium text-white hover:bg-[#B5613B] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download size={16} strokeWidth={1.5} />
            {isDownloading ? 'Descargando...' : 'Descargar PDF'}
          </button>
          {isAdmin && (
            <button
              onClick={handleDeleteSession}
              disabled={isDeleting}
              className="flex items-center gap-2 rounded-md px-4 h-9 text-sm font-medium text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Trash2 size={16} strokeWidth={1.5} />
              {isDeleting ? 'Eliminando...' : 'Eliminar sesión'}
            </button>
          )}
        </div>
      </div>

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

      {/* ── 1. Datos generales ── */}
      <CollapsibleCard title="Datos generales">
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
            <MetaBadge label="Limpiezas totales" value={session.total_cleanings} />
          )}
          {session.bud && <MetaBadge label="Bud" value={session.bud} />}
          {session.bud_chakra && <MetaBadge label="Chakra Bud" value={session.bud_chakra} />}
        </div>

        {/* Toggles: Entidades / Bajo astral / Implantes */}
        {(session.entities_count != null || session.capas != null || session.implants_count != null) && (
          <div className="flex flex-wrap gap-4 mb-4">
            <div className="flex items-center gap-2 text-sm">
              <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${session.entities_count != null && session.entities_count > 0 ? 'bg-green-500' : 'bg-terra-200'}`} />
              <span className="text-terra-700">Entidades:</span>
              <span className="font-medium text-terra-900">
                {session.entities_count != null && session.entities_count > 0
                  ? `Sí (${session.entities_count})`
                  : 'No'}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${session.capas != null && session.capas > 0 ? 'bg-green-500' : 'bg-terra-200'}`} />
              <span className="text-terra-700">Trabajos de bajo astral:</span>
              <span className="font-medium text-terra-900">
                {session.capas != null && session.capas > 0 ? 'Sí' : 'No'}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${session.implants_count != null && session.implants_count > 0 ? 'bg-green-500' : 'bg-terra-200'}`} />
              <span className="text-terra-700">Implantes:</span>
              <span className="font-medium text-terra-900">
                {session.implants_count != null && session.implants_count > 0 ? 'Sí' : 'No'}
              </span>
            </div>
          </div>
        )}

        {session.notes && (
          <div className="mb-3">
            <FieldLabel>Notas</FieldLabel>
            <div className="bg-amber-50/60 border-l-4 border-amber-300 rounded-r-xl p-4 mt-1">
              <p className="text-sm text-amber-900 leading-relaxed whitespace-pre-wrap">
                {session.notes}
              </p>
            </div>
          </div>
        )}
      </CollapsibleCard>

      {/* ── 2. Dimensiones energéticas ── */}
      {energyRows.length > 0 && (
        <CollapsibleCard title={hasFinalEnergy ? 'Dimensiones energéticas' : 'Mediciones energéticas iniciales'}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-terra-100 text-xs uppercase tracking-wide text-terra-500">
                  <th className="text-left py-2 pr-4 font-medium">Dimensión</th>
                  <th className="text-center py-2 px-3 font-medium w-20">Inicial</th>
                  {hasFinalEnergy && (
                    <>
                      <th className="text-center py-2 px-3 font-medium w-20">Final</th>
                      <th className="text-center py-2 pl-3 font-medium w-20">Delta</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {energyRows.map((r) => (
                  <tr key={r.id} className="border-b border-terra-50 hover:bg-terra-50/30">
                    <td className="py-2.5 pr-4 text-terra-800 font-medium">{r.dimension_name}</td>
                    <td className="py-2.5 px-3 text-center text-terra-600">
                      <NumCell value={r.initial_value} />
                    </td>
                    {hasFinalEnergy && (
                      <>
                        <td className="py-2.5 px-3 text-center text-terra-600">
                          <NumCell value={r.final_value} />
                        </td>
                        <td className="py-2.5 pl-3 text-center">
                          <Delta initial={r.initial_value} final={r.final_value} />
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CollapsibleCard>
      )}

      {/* ── 3. Chakras ── */}
      {chakraRows.length > 0 && (
        <CollapsibleCard title={hasFinalChakra ? 'Chakras' : 'Chakras — mediciones iniciales'}>
          <p className="text-xs text-terra-400 mb-3">Escala 0 – 14</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-terra-100 text-xs uppercase tracking-wide text-terra-500">
                  <th className="text-left py-2 pr-4 font-medium">Chakra</th>
                  <th className="text-center py-2 px-3 font-medium w-20">Inicial</th>
                  {hasFinalChakra && (
                    <>
                      <th className="text-center py-2 px-3 font-medium w-20">Final</th>
                      <th className="text-center py-2 pl-3 font-medium w-20">Delta</th>
                    </>
                  )}
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
                      {hasFinalChakra && (
                        <>
                          <td className="py-2.5 px-3 text-center text-terra-600">
                            <NumCell value={r.final_value} />
                          </td>
                          <td className="py-2.5 pl-3 text-center">
                            <Delta initial={r.initial_value} final={r.final_value} />
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CollapsibleCard>
      )}

      {/* ── 4. Temas y Bloqueos (theme-entries) ── */}
      {themeGroups.length > 0 && (
        <CollapsibleCard title={`Temas y Bloqueos (${themeGroups.length})`}>
          <div className="space-y-5">
            {themeGroups.map(({ topicId, topicName, progress, entries }) => {
              const bloqueos = entries.filter((e) =>
                ['bloqueo_1', 'bloqueo_2', 'bloqueo_3', 'resultante'].includes(e.entry_type),
              );
              const adulta = entries.find((e) => e.entry_type === 'edad_adulta');
              const infancia = entries.find((e) => e.entry_type === 'edad_infancia');
              return (
                <div
                  key={topicId}
                  className="border border-terra-100 rounded-lg p-4 space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-terra-500 font-medium">
                        Tema
                      </p>
                      <h3 className="text-base font-semibold text-terra-900">
                        {topicName}
                      </h3>
                    </div>
                    {progress != null && (
                      <span className="inline-flex items-center text-xs bg-[#B7BFB3] text-white rounded-full px-2.5 py-0.5">
                        {progress}%
                      </span>
                    )}
                  </div>

                  {(adulta?.adulthood_age != null ||
                    infancia?.childhood_age != null ||
                    adulta?.adulthood_situation ||
                    infancia?.childhood_situation ||
                    adulta?.adulthood_emotions ||
                    infancia?.childhood_emotions) && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                      {(adulta?.adulthood_age != null || adulta?.adulthood_situation || adulta?.adulthood_emotions || adulta?.adulthood_description) && (
                        <div className="bg-terra-50/50 rounded-md p-3 space-y-1">
                          <FieldLabel>
                            Edad adulta{adulta?.adulthood_age != null ? ` (${adulta.adulthood_age} años)` : ''}
                          </FieldLabel>
                          {adulta?.adulthood_place && <p className="text-terra-700 text-xs"><span className="text-terra-400">Lugar:</span> {adulta.adulthood_place}</p>}
                          {adulta?.adulthood_people && <p className="text-terra-700 text-xs"><span className="text-terra-400">Personas:</span> {adulta.adulthood_people}</p>}
                          {adulta?.adulthood_situation && <p className="text-terra-800 text-sm">{adulta.adulthood_situation}</p>}
                          {adulta?.adulthood_description && <p className="text-terra-700 text-xs whitespace-pre-wrap">{adulta.adulthood_description}</p>}
                          {adulta?.adulthood_emotions && <p className="text-terra-600 text-xs italic">{adulta.adulthood_emotions}</p>}
                        </div>
                      )}
                      {(infancia?.childhood_age != null || infancia?.childhood_situation || infancia?.childhood_emotions || infancia?.childhood_description) && (
                        <div className="bg-terra-50/50 rounded-md p-3 space-y-1">
                          <FieldLabel>
                            Infancia{infancia?.childhood_age != null ? ` (${infancia.childhood_age} años)` : ''}
                          </FieldLabel>
                          {infancia?.childhood_place && <p className="text-terra-700 text-xs"><span className="text-terra-400">Lugar:</span> {infancia.childhood_place}</p>}
                          {infancia?.childhood_people && <p className="text-terra-700 text-xs"><span className="text-terra-400">Personas:</span> {infancia.childhood_people}</p>}
                          {infancia?.childhood_situation && <p className="text-terra-800 text-sm">{infancia.childhood_situation}</p>}
                          {infancia?.childhood_description && <p className="text-terra-700 text-xs whitespace-pre-wrap">{infancia.childhood_description}</p>}
                          {infancia?.childhood_emotions && <p className="text-terra-600 text-xs italic">{infancia.childhood_emotions}</p>}
                        </div>
                      )}
                    </div>
                  )}

                  {bloqueos.length > 0 && (
                    <div>
                      <FieldLabel>Bloqueos</FieldLabel>
                      <div className="overflow-x-auto mt-1">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-[#F2E8E4] text-xs uppercase tracking-wide text-[#4A3628]">
                              <th className="text-left py-2 px-3 font-medium">Tipo</th>
                              <th className="text-left py-2 px-3 font-medium">Chakra</th>
                              <th className="text-left py-2 px-3 font-medium">Órgano</th>
                              <th className="text-center py-2 px-3 font-medium w-16">Inicial</th>
                              <th className="text-center py-2 px-3 font-medium w-16">Final</th>
                              <th className="text-center py-2 px-3 font-medium w-16">Δ</th>
                            </tr>
                          </thead>
                          <tbody>
                            {bloqueos.map((b) => {
                              const chakra = b.chakra_position_id ? chakraById.get(b.chakra_position_id) : null;
                              const color = chakra ? getChakraColor(chakra.name) : undefined;
                              const ini = toNum(b.initial_energy);
                              const fin = toNum(b.final_energy);
                              const label =
                                b.entry_type === 'bloqueo_1' ? 'Bloqueo 1'
                                : b.entry_type === 'bloqueo_2' ? 'Bloqueo 2'
                                : b.entry_type === 'bloqueo_3' ? 'Bloqueo 3'
                                : b.entry_type === 'resultante' ? 'Resultante'
                                : b.entry_type;
                              return (
                                <tr key={b.id} className="border-b border-[#D4A592]/30">
                                  <td className="py-2 px-3 text-[#2C2220] font-medium">{label}</td>
                                  <td className="py-2 px-3">
                                    {chakra ? (
                                      <div className="flex items-center gap-2">
                                        <span className="inline-block w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                                        <span className="text-[#2C2220]">{chakra.name}</span>
                                      </div>
                                    ) : (
                                      <span className="text-terra-200">—</span>
                                    )}
                                  </td>
                                  <td className="py-2 px-3 text-[#2C2220]">{b.organ_name ?? <span className="text-terra-200">—</span>}</td>
                                  <td className="py-2 px-3 text-center text-terra-600">
                                    <NumCell value={ini} />
                                  </td>
                                  <td className="py-2 px-3 text-center text-terra-600">
                                    <NumCell value={fin} />
                                  </td>
                                  <td className="py-2 px-3 text-center">
                                    <Delta initial={ini} final={fin} />
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CollapsibleCard>
      )}

      {/* ── 4b. Temas legacy (session_topics antigua) ── */}
      {activeTopics.length > 0 && (
        <CollapsibleCard title="Temas trabajados (legacy)">
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
                      <FieldLabel>
                        Tema adulto{t.adult_age != null ? ` (${t.adult_age} años)` : ''}
                      </FieldLabel>
                      <p className="text-terra-800">{t.adult_theme}</p>
                    </div>
                  )}
                  {t.child_theme && (
                    <div>
                      <FieldLabel>
                        Tema infancia{t.child_age != null ? ` (${t.child_age} años)` : ''}
                      </FieldLabel>
                      <p className="text-terra-800">{t.child_theme}</p>
                    </div>
                  )}
                  {t.emotions && (
                    <div className="sm:col-span-2">
                      <FieldLabel>Emociones</FieldLabel>
                      <p className="text-terra-800">{t.emotions}</p>
                    </div>
                  )}
                </div>

                {(t.initial_energy != null || t.final_energy != null) && (
                  <div className="flex gap-6 pt-1 border-t border-terra-50">
                    {t.initial_energy != null && (
                      <div>
                        <span className="text-xs text-terra-400">Inicial: </span>
                        <span className="text-sm font-medium text-terra-700">{t.initial_energy}</span>
                      </div>
                    )}
                    {t.final_energy != null && (
                      <div>
                        <span className="text-xs text-terra-400">Final: </span>
                        <span className="text-sm font-medium text-terra-700">{t.final_energy}</span>
                      </div>
                    )}
                    {t.initial_energy != null && t.final_energy != null && (
                      <div>
                        <span className="text-xs text-terra-400">Delta: </span>
                        <Delta initial={t.initial_energy} final={t.final_energy} />
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </CollapsibleCard>
      )}

      {/* ── 5. LNT ── */}
      {activeLNT.length > 0 && (
        <CollapsibleCard title="LNT — Liberación Neuromuscular y Tisular">
          <div className="space-y-3">
            {activeLNT.map((e) => (
              <div key={e.id} className="border border-terra-100 rounded-lg p-4 text-sm space-y-2">
                {e.theme_organ && (
                  <p className="font-medium text-terra-900">{e.theme_organ}</p>
                )}
                <div className="flex flex-wrap gap-4 text-terra-600">
                  {e.initial_energy != null && <span>Inicial: {e.initial_energy}</span>}
                  {e.final_energy != null && <span>Final: {e.final_energy}</span>}
                  {e.initial_energy != null && e.final_energy != null && (
                    <span>
                      Delta: <Delta initial={e.initial_energy} final={e.final_energy} />
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {e.healing_energy_body && (
                    <span className="text-xs bg-terra-200/50 text-terra-900 border border-terra-500 rounded-full px-2 py-0.5">
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
                {e.peticiones && (
                  <div className="mt-1">
                    <FieldLabel>Peticiones</FieldLabel>
                    <p className="text-terra-800 whitespace-pre-wrap">{e.peticiones}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CollapsibleCard>
      )}

      {/* ── 6. Reporte de Limpieza ── */}
      {hasCleaningData && (
        <CollapsibleCard title="Reporte de Limpieza">
          {/* Resumen de limpieza */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
            {session.capas != null && session.capas > 0 && (
              <div className="bg-terra-50 rounded-lg p-3">
                <p className="text-xs uppercase tracking-wide text-terra-500 font-medium">Capas</p>
                <p className="text-xl font-bold text-terra-900">{session.capas}</p>
              </div>
            )}
            {session.limpiezas_requeridas != null && session.limpiezas_requeridas > 0 && (
              <div className="bg-terra-50 rounded-lg p-3">
                <p className="text-xs uppercase tracking-wide text-terra-500 font-medium">Limpiezas requeridas</p>
                <p className="text-xl font-bold text-terra-900">{session.limpiezas_requeridas}</p>
              </div>
            )}
          </div>

          {session.mesa_utilizada && (
            <div className="mb-4">
              <FieldLabel>Mesa utilizada</FieldLabel>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {session.mesa_utilizada.split('|').map((m) => m.trim()).filter(Boolean).map((m) => (
                  <Chip key={m}>{m}</Chip>
                ))}
              </div>
            </div>
          )}

          {session.beneficios && (
            <div className="mb-4">
              <FieldLabel>Beneficios</FieldLabel>
              <p className="text-sm text-terra-800 whitespace-pre-wrap mt-1">{session.beneficios}</p>
            </div>
          )}

          {/* Eventos de limpieza — agrupados por persona */}
          {activeCleanings.length > 0 ? (() => {
            // Agrupar por persona (o "Sin persona" si no tiene)
            const groupedByPerson = activeCleanings.reduce<Record<string, typeof activeCleanings>>((acc, ev) => {
              const key = ev.person || 'Paciente';
              if (!acc[key]) acc[key] = [];
              acc[key].push(ev);
              return acc;
            }, {});
            const personKeys = Object.keys(groupedByPerson);

            return (
              <div className="space-y-4">
                {personKeys.map((personName, gIdx) => {
                  const events = groupedByPerson[personName];
                  return (
                    <div key={personName} className="border border-terra-100 rounded-lg overflow-hidden">
                      {/* Header del grupo */}
                      <div className="bg-terra-50 px-4 py-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-terra-900">
                            Grupo {gIdx + 1}: {personName}
                          </span>
                        </div>
                        <span className="text-xs text-terra-500">
                          {events.length} {events.length === 1 ? 'evento' : 'eventos'}
                        </span>
                      </div>

                      {/* Eventos del grupo */}
                      <div className="divide-y divide-terra-50">
                        {events.map((ev, idx) => (
                          <div key={ev.id} className="px-4 py-3 space-y-2 border-l-4 border-[#D4A592]">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium text-terra-500">Evento {idx + 1}</span>
                              {ev.energy_level != null && (
                                <span className="text-xs text-terra-400">— Energía: {ev.energy_level}</span>
                              )}
                            </div>

                            {/* Capas */}
                            {ev.layer && (
                              <div>
                                <span className="text-xs text-terra-500 mr-1.5">Capas:</span>
                                <span className="inline-flex items-center text-xs bg-amber-50 text-amber-800 border border-amber-200 rounded-full px-2.5 py-0.5">
                                  {ev.layer}{ev.quantity != null ? ` ×${ev.quantity}` : ''}
                                </span>
                              </div>
                            )}

                            {/* Manifestación */}
                            {ev.manifestation && (
                              <div>
                                <span className="text-xs text-terra-500 mr-1.5">Manifestación:</span>
                                <div className="inline-flex flex-wrap gap-1">
                                  {ev.manifestation.split('|').map((m) => m.trim()).filter(Boolean).map((m, mi) => (
                                    <span key={mi} className="inline-flex items-center text-xs bg-rose-50 text-rose-700 border border-rose-200 rounded-full px-2.5 py-0.5">
                                      {m}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Trabajo realizado */}
                            {ev.work_done && (
                              <div>
                                <span className="text-xs text-terra-500 mr-1.5">Trabajo realizado:</span>
                                <div className="inline-flex flex-wrap gap-1">
                                  {ev.work_done.split('|').map((w) => w.trim()).filter(Boolean).map((w, wi) => (
                                    <span key={wi} className="inline-flex items-center text-xs bg-terra-200/50 text-terra-900 border border-terra-500 rounded-full px-2.5 py-0.5">
                                      {w}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Materiales */}
                            {ev.materials_used && (
                              <div>
                                <span className="text-xs text-terra-500 mr-1.5">Materiales:</span>
                                <div className="inline-flex flex-wrap gap-1">
                                  {ev.materials_used.split('|').map((m) => m.trim()).filter(Boolean).map((m, mi) => (
                                    <span key={mi} className="inline-flex items-center text-xs bg-green-50 text-green-700 border border-green-200 rounded-full px-2.5 py-0.5">
                                      {m}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Origen */}
                            {ev.origin && (
                              <div>
                                <span className="text-xs text-terra-500 mr-1.5">Origen:</span>
                                <div className="inline-flex flex-wrap gap-1">
                                  {ev.origin.split('|').map((o) => o.trim()).filter(Boolean).map((o, oi) => (
                                    <span key={oi} className="inline-flex items-center text-xs bg-orange-50 text-orange-700 border border-orange-200 rounded-full px-2.5 py-0.5">
                                      {o}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Área de vida */}
                            {ev.life_area && (
                              <div>
                                <span className="text-xs text-terra-500 mr-1.5">Área de vida:</span>
                                <span className="text-sm text-terra-700">{ev.life_area}</span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })() : (
            <p className="text-sm text-terra-400 italic">Sin eventos de limpieza registrados</p>
          )}

          {/* Resumen de costos de limpieza */}
          {cleaningGroupsData.length > 0 && (
            <div className="mt-4 pt-4 border-t border-terra-100">
              <FieldLabel>Costos de limpieza</FieldLabel>
              <div className="space-y-1 mt-2">
                {cleaningGroupsData.map((g) => {
                  const groupCost = g.cleanings_required * g.cost_per_cleaning;
                  return (
                    <div
                      key={g.id}
                      className={`flex items-center justify-between py-1 text-sm ${
                        g.is_charged ? 'text-terra-800' : 'text-terra-400 line-through'
                      }`}
                    >
                      <span>
                        {g.target_name} — {g.cleanings_required} limp. × {formatCurrency(g.cost_per_cleaning)}
                      </span>
                      <span className="font-medium">{formatCurrency(groupCost)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CollapsibleCard>
      )}

      {/* ── 7. Constelación de Ancestros ── */}
      {hasAncestorData && (
        <CollapsibleCard title="Constelación de Ancestros">
          {activeAncestors.length > 0 && (
            <div className="space-y-4 mb-4">
              {activeAncestors.map((a, idx) => (
                <div key={a.id} className="border border-terra-100 rounded-lg p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-medium text-terra-500 uppercase tracking-wide">
                      Ancestro {idx + 1}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    {a.member && (
                      <div>
                        <FieldLabel>Miembro</FieldLabel>
                        <p className="text-terra-800 font-medium">{a.member}</p>
                      </div>
                    )}
                    {a.lineage && (
                      <div>
                        <FieldLabel>Linaje</FieldLabel>
                        <p className="text-terra-800">{a.lineage}</p>
                      </div>
                    )}
                  </div>

                  {notEmpty(a.bond_energy) && (
                    <div>
                      <FieldLabel>Energía del vínculo</FieldLabel>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {a.bond_energy.map((b) => <Chip key={b}>{b}</Chip>)}
                      </div>
                    </div>
                  )}

                  {notEmpty(a.ancestor_roles) && (
                    <div>
                      <FieldLabel>Roles del ancestro</FieldLabel>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {a.ancestor_roles.map((r) => <Chip key={r}>{r}</Chip>)}
                      </div>
                    </div>
                  )}

                  {notEmpty(a.consultant_roles) && (
                    <div>
                      <FieldLabel>Roles del consultante</FieldLabel>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {a.consultant_roles.map((r) => <Chip key={r}>{r}</Chip>)}
                      </div>
                    </div>
                  )}

                  {notEmpty(a.energy_expressions) && (
                    <div>
                      <FieldLabel>Expresiones de la energía</FieldLabel>
                      <div className="space-y-1 mt-1">
                        {a.energy_expressions.map((ee, i) => (
                          <p key={i} className="text-sm text-terra-800">
                            <span className="text-terra-500 font-medium">{ee.number}.</span> {ee.expression}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}

                  {notEmpty(a.family_traumas) && (
                    <div>
                      <FieldLabel>Traumas familiares</FieldLabel>
                      <div className="space-y-1 mt-1">
                        {a.family_traumas.map((ft, i) => (
                          <p key={i} className="text-sm text-terra-800">
                            <span className="text-terra-500 font-medium">{ft.number}.</span> {ft.trauma}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Conciliación */}
          {session.ancestor_conciliation && (
            <div className="border-t border-terra-100 pt-4">
              <h3 className="text-sm font-semibold text-terra-700 mb-3 uppercase tracking-wide">
                Conciliación
              </h3>
              <div className="space-y-3 text-sm">
                {session.ancestor_conciliation.healing_phrases && (
                  <div>
                    <FieldLabel>Frases sanadoras</FieldLabel>
                    <p className="text-terra-800 whitespace-pre-wrap">
                      {session.ancestor_conciliation.healing_phrases}
                    </p>
                  </div>
                )}
                {session.ancestor_conciliation.conciliation_acts && (
                  <div>
                    <FieldLabel>Actos de conciliación</FieldLabel>
                    <p className="text-terra-800 whitespace-pre-wrap">
                      {session.ancestor_conciliation.conciliation_acts}
                    </p>
                  </div>
                )}
                {session.ancestor_conciliation.life_aspects_affected && (
                  <div>
                    <FieldLabel>Aspectos de vida afectados</FieldLabel>
                    <p className="text-terra-800 whitespace-pre-wrap">
                      {session.ancestor_conciliation.life_aspects_affected}
                    </p>
                  </div>
                )}
                {session.ancestor_conciliation.session_relationship && (
                  <div>
                    <FieldLabel>Relación con la sesión</FieldLabel>
                    <p className="text-terra-800 whitespace-pre-wrap">
                      {session.ancestor_conciliation.session_relationship}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </CollapsibleCard>
      )}

      {/* ── 8. Otros datos (Afectaciones / Órganos) ── */}
      {(activeAffectations.length > 0 || activeOrgans.length > 0) && (
        <CollapsibleCard title="Otros datos">
          <div className="space-y-6">
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
                          <span className="text-xs text-terra-400 font-medium uppercase tracking-wide mr-1">
                            Adulto{e.adult_age != null ? ` (${e.adult_age}a)` : ''}:
                          </span>
                          {e.adult_theme}
                        </p>
                      )}
                      {e.child_theme && (
                        <p className="text-terra-700">
                          <span className="text-xs text-terra-400 font-medium uppercase tracking-wide mr-1">
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
                          <span className="text-xs text-terra-400 font-medium uppercase tracking-wide mr-1">
                            Adulto{e.adult_age != null ? ` (${e.adult_age}a)` : ''}:
                          </span>
                          {e.adult_theme}
                        </p>
                      )}
                      {e.child_theme && (
                        <p className="text-terra-700">
                          <span className="text-xs text-terra-400 font-medium uppercase tracking-wide mr-1">
                            Infancia{e.child_age != null ? ` (${e.child_age}a)` : ''}:
                          </span>
                          {e.child_theme}
                        </p>
                      )}
                      {e.emotions && (
                        <p className="text-terra-700">
                          <span className="text-xs text-terra-400 font-medium uppercase tracking-wide mr-1">Emociones:</span>
                          {e.emotions}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CollapsibleCard>
      )}

      {/* ── 9. Protecciones ── */}
      {hasProtectionData && (
        <CollapsibleCard title={`Protecciones (${protections.length})`} defaultOpen={false}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#F2E8E4] text-xs uppercase tracking-wide text-[#4A3628]">
                  <th className="text-left py-2 px-3 font-medium">Persona</th>
                  <th className="text-center py-2 px-3 font-medium w-20">Cantidad</th>
                  <th className="text-right py-2 px-3 font-medium w-28">Costo unit.</th>
                  <th className="text-right py-2 px-3 font-medium w-28">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {protections.map((p) => {
                  const unit = toNum(p.cost_per_unit);
                  const sub = unit != null ? unit * p.quantity : null;
                  return (
                    <tr key={p.id} className="border-b border-[#D4A592]/30">
                      <td className="py-2 px-3 text-[#2C2220]">
                        {p.recipient_name ?? p.recipient_type}
                      </td>
                      <td className="py-2 px-3 text-center text-[#2C2220]">{p.quantity}</td>
                      <td className="py-2 px-3 text-right text-terra-700">
                        {unit != null ? formatCurrency(unit) : <span className="text-terra-200">—</span>}
                      </td>
                      <td className="py-2 px-3 text-right font-medium text-[#2C2220]">
                        {sub != null ? formatCurrency(sub) : <span className="text-terra-200">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-sm text-terra-600 mt-3">
            {session.protection_charged ? 'Se cobró protección' : 'No se cobró protección'}
          </p>
        </CollapsibleCard>
      )}

      {/* ── 10. Cierre / Pago ── */}
      {(session.cost != null || session.payment_notes || session.costo_calculado != null) && (
        <CollapsibleCard title="Cierre y pago">
          <div className="space-y-3">
            {/* Terapia base */}
            {session.therapy_type_name && (
              <div className="flex items-center justify-between py-1 text-sm">
                <span className="text-terra-600">Terapia base</span>
                <span className="font-medium text-terra-800">
                  {session.therapy_type_name}
                </span>
              </div>
            )}

            {/* Limpiezas cobradas — desglose por grupo */}
            {cleaningGroupsData.length > 0 && (
              <div className="space-y-1">
                <FieldLabel>Limpiezas</FieldLabel>
                {cleaningGroupsData.map((g) => {
                  const groupCost = g.cleanings_required * g.cost_per_cleaning;
                  return (
                    <div
                      key={g.id}
                      className={`flex items-center justify-between py-1 text-sm ${
                        g.is_charged ? 'text-[#2C2220]' : 'text-[#B7BFB3] line-through'
                      }`}
                    >
                      <span>
                        {g.is_charged ? '☑' : '☐'} {g.target_name} ({g.cleanings_required} × {formatCurrency(g.cost_per_cleaning)})
                      </span>
                      <span className="font-medium">{formatCurrency(groupCost)}</span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Protecciones */}
            {hasProtectionData && session.protection_charged && (
              <div className="space-y-1">
                <FieldLabel>Protecciones</FieldLabel>
                {protections.map((p) => {
                  const unit = toNum(p.cost_per_unit) ?? 0;
                  const sub = unit * p.quantity;
                  return (
                    <div key={p.id} className="flex items-center justify-between py-1 text-sm text-[#2C2220]">
                      <span>{p.recipient_name ?? p.recipient_type} ({p.quantity} × {formatCurrency(unit)})</span>
                      <span className="font-medium">{formatCurrency(sub)}</span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Porcentaje de pago */}
            {session.porcentaje_pago != null && session.porcentaje_pago !== 100 && (
              <div className="flex items-center justify-between py-1 text-sm text-terra-600">
                <span>Porcentaje de pago</span>
                <span className="font-medium">{session.porcentaje_pago}%</span>
              </div>
            )}

            {/* IVA */}
            {session.incluye_iva && (
              <div className="flex items-center justify-between py-1 text-sm text-terra-600">
                <span>IVA</span>
                <span className="font-medium">Incluido</span>
              </div>
            )}

            {/* Total calculado */}
            {session.costo_calculado != null && (
              <div className="flex items-center justify-between py-1 text-sm text-terra-600 border-t border-terra-50">
                <span>Subtotal calculado</span>
                <span className="font-medium">{formatCurrency(session.costo_calculado)}</span>
              </div>
            )}

            {/* Total final */}
            {session.cost != null && (
              <div className="flex items-center justify-between pt-3 border-t border-[#D4A592]">
                <span className="text-lg font-semibold text-[#2C2220]">Total</span>
                <span className="text-lg font-semibold text-[#2C2220]">
                  {formatCurrency(session.cost)}
                </span>
              </div>
            )}
          </div>

          {session.payment_notes && (
            <div className="mt-3">
              <FieldLabel>Notas de pago</FieldLabel>
              <p className="text-sm text-terra-800 whitespace-pre-wrap mt-1">
                {session.payment_notes}
              </p>
            </div>
          )}
        </CollapsibleCard>
      )}

      {/* Pie de página */}
      <p className="text-xs text-terra-400 pb-6">
        Sesión creada el {formatDateTime(session.created_at)}
      </p>
    </div>
  );
}
