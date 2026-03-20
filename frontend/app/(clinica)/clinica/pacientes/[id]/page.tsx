"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  User,
  Heart,
  Users,
  FileText,
  Mail,
  Phone,
  Pill,
  Moon,
  Stethoscope,
  PlusCircle,
  X,
  Zap,
  AlertCircle,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { getClientTopics, completeClientTopic } from "@/lib/api/clinical";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate, formatPhone, formatCurrency } from "@/lib/utils/formatters";
import type {
  Client,
  Session,
  SessionDetail,
  ClientSessionItem,
  MaritalStatus,
  SleepQuality,
  ClientTopic,
} from "@/types/api";

type Tab = "datos" | "sesiones" | "temas" | "salud";

const TAB_LABELS: Record<Tab, string> = {
  datos: "Datos Personales",
  sesiones: "Historial de Sesiones",
  temas: "Temas",
  salud: "Salud",
};

const MARITAL_LABELS: Record<MaritalStatus, string> = {
  single: "Soltero/a",
  married: "Casado/a",
  divorced: "Divorciado/a",
  widowed: "Viudo/a",
  common_law: "Unión libre",
  other: "Otro",
};

const SLEEP_LABELS: Record<SleepQuality, string> = {
  bad: "Malo",
  regular: "Regular",
  good: "Bueno",
  excellent: "Excelente",
};

function ordinal(n: number): string {
  return `${n}°`;
}

function SkeletonBlock({ lines = 6 }: { lines?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="h-4 bg-terra-100 rounded animate-pulse"
          style={{ width: `${55 + (i % 4) * 12}%` }}
        />
      ))}
    </div>
  );
}

/** Campo individual con label arriba y valor abajo */
function Field({
  label,
  value,
}: {
  label: string;
  value: string | number | null | undefined;
}) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-gray-400 mb-1 font-medium">
        {label}
      </p>
      {value != null ? (
        <p className="text-sm text-gray-900">{value}</p>
      ) : (
        <p className="text-sm text-gray-300 italic">Sin registrar</p>
      )}
    </div>
  );
}

/** Encabezado de sección con ícono */
function SectionHeader({
  icon: Icon,
  title,
}: {
  icon: React.ElementType;
  title: string;
}) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon className="h-5 w-5 text-terra-400 shrink-0" />
      <h2 className="text-base font-semibold text-terra-900">{title}</h2>
    </div>
  );
}

/** Contenedor de sección */
function Section({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-terra-100 p-6">
      {children}
    </div>
  );
}

/** Tags/chips coloreados */
function TagList({
  items,
  chipClass,
}: {
  items: string[] | null | undefined;
  chipClass: string;
}) {
  if (!items || items.length === 0) {
    return <p className="text-sm text-gray-300 italic">Sin registrar</p>;
  }
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item) => (
        <span
          key={item}
          className={`text-xs font-medium px-3 py-1.5 rounded-full border ${chipClass}`}
        >
          {item}
        </span>
      ))}
    </div>
  );
}

// ─── Session Drawer ───────────────────────────────────────────────────────────

function DrawerField({
  label,
  value,
}: {
  label: string;
  value: string | number | null | undefined;
}) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-terra-400 mb-1 font-medium">
        {label}
      </p>
      {value != null ? (
        <p className="text-sm text-terra-900">{value}</p>
      ) : (
        <p className="text-sm text-terra-300 italic">Sin registrar</p>
      )}
    </div>
  );
}

function SessionDrawer({
  session,
  onClose,
}: {
  session: Session | null;
  onClose: () => void;
}) {
  const [detail, setDetail] = useState<SessionDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Cerrar con ESC
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Fetch detalle cuando se abre
  useEffect(() => {
    if (!session) return;
    setDetail(null);
    setDetailLoading(true);
    apiClient
      .get<SessionDetail>(`/api/v1/clinical/sessions/${session.id}`)
      .then((d) => setDetail(d))
      .catch(() => setDetail(null))
      .finally(() => setDetailLoading(false));
  }, [session?.id]);

  // Prevenir scroll del body cuando está abierto
  useEffect(() => {
    if (session) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [session]);

  if (!session) return null;

  // Datos de pantalla: preferir detalle si está disponible
  const src = detail ?? session;
  const sessionDate = formatDate(session.measured_at ?? session.session_date ?? session.created_at);

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-terra-900/30 backdrop-blur-[2px] z-40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel lateral */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Detalle de sesión"
        className="fixed right-0 top-0 h-full w-full max-w-md bg-white z-50 shadow-[−4px_0_24px_rgba(61,26,15,0.10)] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-terra-100">
          <div>
            <p className="text-xs uppercase tracking-wide text-terra-400 font-medium mb-0.5">
              Sesión
            </p>
            <h2 className="font-display text-lg font-bold text-terra-900 leading-tight">
              {sessionDate}
            </h2>
            {session.session_type && (
              <span className="inline-block mt-1 text-xs bg-terra-100 text-terra-600 px-2 py-0.5 rounded-full">
                {session.session_type}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-terra-400 hover:text-terra-700 hover:bg-terra-50 transition-colors"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Contenido */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {detailLoading && (
            <div className="space-y-3">
              {[60, 45, 70, 50].map((w, i) => (
                <div
                  key={i}
                  className="h-4 bg-terra-100 rounded animate-pulse"
                  style={{ width: `${w}%` }}
                />
              ))}
            </div>
          )}

          {!detailLoading && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <DrawerField
                  label="Estado"
                  value={src.status}
                />
                <DrawerField
                  label="Costo"
                  value={src.cost != null ? formatCurrency(src.cost) : null}
                />
              </div>

              {detail?.general_energy_level != null && (
                <div className="flex items-center gap-3 bg-terra-50 rounded-xl px-4 py-3">
                  <Zap className="h-4 w-4 text-terra-500 shrink-0" />
                  <div>
                    <p className="text-xs uppercase tracking-wide text-terra-400 font-medium">
                      Energía general
                    </p>
                    <p className="text-sm font-semibold text-terra-900">
                      {detail.general_energy_level}
                    </p>
                  </div>
                </div>
              )}

              {src.notes && (
                <div>
                  <p className="text-xs uppercase tracking-wide text-terra-400 mb-2 font-medium">
                    Notas
                  </p>
                  <div className="bg-amber-50/60 border-l-4 border-amber-300 rounded-r-xl p-4">
                    <p className="text-sm text-amber-900 leading-relaxed whitespace-pre-wrap">
                      {src.notes}
                    </p>
                  </div>
                </div>
              )}

              {detail?.payment_notes && (
                <DrawerField
                  label="Notas de pago"
                  value={detail.payment_notes}
                />
              )}

              <div className="border-t border-terra-100 pt-4 space-y-3">
                <DrawerField
                  label="Creada el"
                  value={formatDate(session.created_at)}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}

function progressColor(pct: number): string {
  if (pct < 30) return "bg-red-500";
  if (pct < 70) return "bg-amber-400";
  return "bg-green-500";
}

function TopicsTabContent({
  clientId,
  topics,
  onTopicCompleted,
}: {
  clientId: string;
  topics: ClientTopic[];
  onTopicCompleted: (updated: ClientTopic) => void;
}) {
  const [completing, setCompleting] = useState<string | null>(null);

  const active = topics.filter((t) => !t.is_completed);
  const completed = topics.filter((t) => t.is_completed);

  const handleComplete = async (topicId: string) => {
    setCompleting(topicId);
    try {
      const updated = await completeClientTopic(clientId, topicId);
      onTopicCompleted(updated);
    } catch {
      // silenciar — el usuario puede reintentar
    } finally {
      setCompleting(null);
    }
  };

  if (topics.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground text-sm">
          No hay temas registrados para esta clienta. Los temas se crean durante las sesiones.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Temas activos */}
      {active.length > 0 && (
        <div className="space-y-3">
          {active.map((topic) => (
            <div
              key={topic.id}
              className="bg-white rounded-lg border border-gray-100 p-5 space-y-3"
            >
              <div className="flex items-start justify-between gap-4">
                <p className="font-medium text-gray-900">{topic.name}</p>
                <button
                  onClick={() => handleComplete(topic.id)}
                  disabled={completing === topic.id}
                  className="shrink-0 text-sm text-terra-700 hover:text-terra-900 border border-terra-200 rounded px-3 py-1 transition-colors disabled:opacity-50"
                >
                  {completing === topic.id ? "Guardando…" : "Marcar completado"}
                </button>
              </div>
              <div className="space-y-1">
                <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${progressColor(topic.progress_pct)}`}
                    style={{ width: `${Math.min(100, Math.max(0, topic.progress_pct))}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500">{topic.progress_pct}% completado</p>
              </div>
              <p className="text-xs text-gray-400">Creado el {formatDate(topic.created_at)}</p>
            </div>
          ))}
        </div>
      )}

      {/* Temas completados */}
      {completed.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
            Temas completados
          </h3>
          {completed.map((topic) => (
            <div
              key={topic.id}
              className="bg-white rounded-lg border border-gray-100 p-5 space-y-2"
            >
              <div className="flex items-center justify-between gap-4">
                <p className="font-medium text-gray-900">{topic.name}</p>
                <span className="text-xs font-medium bg-green-50 text-green-700 border border-green-200 rounded-full px-3 py-1">
                  Completado
                  {topic.completed_at ? ` · ${formatDate(topic.completed_at)}` : ""}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function PacienteDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const [tab, setTab] = useState<Tab>("datos");
  const [client, setClient] = useState<Client | null>(null);
  const [sessions, setSessions] = useState<ClientSessionItem[]>([]);
  const [topics, setTopics] = useState<ClientTopic[]>([]);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [topicsLoading, setTopicsLoading] = useState(false);
  const [topicsEndpointMissing, setTopicsEndpointMissing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchClient = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await apiClient.get<Client>(
          `/api/v1/clinical/clients/${params.id}`,
        );
        setClient(data);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Error al cargar el cliente.",
        );
      } finally {
        setLoading(false);
      }
    };
    fetchClient();
  }, [params.id]);

  useEffect(() => {
    if (tab !== "sesiones") return;
    const fetchSessions = async () => {
      setSessionsLoading(true);
      try {
        const res = await apiClient.get<{ data: ClientSessionItem[]; total: number }>(
          `/api/v1/clinical/clients/${params.id}/sessions?page=1&per_page=50`,
        );
        setSessions(res.data);
      } catch {
        setSessions([]);
      } finally {
        setSessionsLoading(false);
      }
    };
    fetchSessions();
  }, [tab, params.id]);

  useEffect(() => {
    if (tab !== "temas") return;
    const fetchTopics = async () => {
      setTopicsLoading(true);
      setTopicsEndpointMissing(false);
      try {
        const data = await getClientTopics(params.id);
        setTopics(data);
      } catch (err) {
        // Si el endpoint aún no existe (404), mostrar placeholder
        const msg = err instanceof Error ? err.message : "";
        if (msg.includes("404") || msg.includes("Not Found")) {
          setTopicsEndpointMissing(true);
        }
        setTopics([]);
      } finally {
        setTopicsLoading(false);
      }
    };
    fetchTopics();
  }, [tab, params.id]);

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Botón volver */}
      <div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/clinica/pacientes")}
          className="text-terra-700 hover:text-terra-900 -ml-2"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Volver a pacientes
        </Button>
      </div>

      {/* Breadcrumb */}
      <nav className="text-sm text-muted-foreground flex items-center gap-1">
        <span>Dashboard</span>
        <span>›</span>
        <button
          onClick={() => router.push("/clinica/pacientes")}
          className="hover:text-terra-700 transition-colors"
        >
          Clientes
        </button>
        <span>›</span>
        <span className="text-terra-900 font-medium">
          {loading ? "..." : (client?.full_name ?? "Cliente")}
        </span>
      </nav>

      {error && (
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
      )}

      {/* ─── Header del paciente ─── */}
      {!loading && client && (
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold text-terra-900">
              {client.full_name}
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Cliente desde {formatDate(client.created_at)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() =>
                router.push(`/clinica/sesiones/nueva?client_id=${params.id}`)
              }
              className="flex items-center gap-2 bg-terra-700 hover:bg-terra-500 text-white h-10 px-4 rounded text-sm font-medium transition-colors"
            >
              <PlusCircle className="h-4 w-4" />
              Nueva sesión
            </button>
            {client.email && (
              <a
                href={`mailto:${client.email}`}
                title={client.email}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg border border-gray-200 text-terra-600 hover:bg-terra-50 hover:border-terra-300 transition-colors"
              >
                <Mail className="h-4 w-4" />
              </a>
            )}
            {client.phone && (
              <a
                href={`tel:${client.phone}`}
                title={formatPhone(client.phone)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg border border-gray-200 text-terra-600 hover:bg-terra-50 hover:border-terra-300 transition-colors"
              >
                <Phone className="h-4 w-4" />
              </a>
            )}
          </div>
        </div>
      )}

      {/* ─── Alerta de consentimiento pendiente ─── */}
      {!loading && client && !client.has_consent && (
        <div className="bg-amber-50 border-l-4 border-amber-400 rounded-r-lg p-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-800">
                Consentimiento pendiente
              </p>
              <p className="text-xs text-amber-600">
                Este paciente no tiene consentimiento informado registrado.
                Requerido por NOM-004-SSA3-2012 antes de la primera sesión.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ─── Tabs ─── */}
      <div className="border-b border-border">
        <nav className="flex gap-6" aria-label="Pestañas">
          {(["datos", "sesiones", "temas", "salud"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                tab === t
                  ? "border-terra-700 text-terra-700"
                  : "border-transparent text-muted-foreground hover:text-terra-900"
              }`}
            >
              {TAB_LABELS[t]}
            </button>
          ))}
        </nav>
      </div>

      {/* ─── Tab: Datos Personales ─── */}
      {tab === "datos" && (
        <>
          {loading ? (
            <Card>
              <CardContent className="pt-6">
                <SkeletonBlock lines={12} />
              </CardContent>
            </Card>
          ) : client ? (
            <div className="space-y-6">

              {/* SECCIÓN 1: Información Personal */}
              <Section>
                <SectionHeader icon={User} title="Información Personal" />
                <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                  <Field label="Nombre completo" value={client.full_name} />
                  <Field label="Correo electrónico" value={client.email} />
                  <Field
                    label="Teléfono"
                    value={client.phone ? formatPhone(client.phone) : null}
                  />
                  <Field
                    label="Fecha de nacimiento"
                    value={
                      client.birth_date ? formatDate(client.birth_date) : null
                    }
                  />
                  <Field
                    label="Estado civil"
                    value={
                      client.marital_status
                        ? MARITAL_LABELS[client.marital_status]
                        : null
                    }
                  />
                  <Field label="Profesión" value={client.profession} />
                  <Field
                    label="Lugar de nacimiento"
                    value={client.birth_place}
                  />
                  <Field
                    label="Lugar de residencia"
                    value={client.residence_place}
                  />
                </dl>
              </Section>

              {/* SECCIÓN 2: Perfil Emocional */}
              <Section>
                <SectionHeader icon={Heart} title="Perfil Emocional" />
                <div className="space-y-5">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-gray-400 mb-2 font-medium">
                      Emociones predominantes
                    </p>
                    <TagList
                      items={client.predominant_emotions}
                      chipClass="bg-terra-50 text-terra-700 border-terra-200"
                    />
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-gray-400 mb-2 font-medium">
                      Motivación de visita
                    </p>
                    <TagList
                      items={client.motivation_visit}
                      chipClass="bg-blue-50 text-blue-700 border-blue-200"
                    />
                  </div>
                  {client.motivation_general && (
                    <div>
                      <p className="text-xs uppercase tracking-wide text-gray-400 mb-1 font-medium">
                        Motivación general
                      </p>
                      <p className="text-sm text-gray-900 leading-relaxed">
                        {client.motivation_general}
                      </p>
                    </div>
                  )}
                </div>
              </Section>

              {/* SECCIÓN 3: Sistema Familiar */}
              <Section>
                <SectionHeader icon={Users} title="Sistema Familiar" />
                <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                  <Field
                    label="Número de hijos"
                    value={client.num_children}
                  />
                  <Field
                    label="Número de hermanos"
                    value={client.num_siblings}
                  />
                  <Field
                    label="Orden de nacimiento"
                    value={
                      client.birth_order != null
                        ? `${ordinal(client.birth_order)} hijo/a`
                        : null
                    }
                  />
                  <Field
                    label="Abortos en sistema familiar"
                    value={client.family_abortions}
                  />
                  <div className="md:col-span-2">
                    <Field
                      label="Fallecimientos antes de los 41 años"
                      value={client.deaths_before_41}
                    />
                  </div>
                </dl>
              </Section>

              {/* SECCIÓN 4: Notas (solo si hay contenido) */}
              {client.important_notes && (
                <Section>
                  <SectionHeader icon={FileText} title="Notas" />
                  <div className="bg-amber-50/60 border-l-4 border-amber-300 rounded-r-xl p-4">
                    <p className="text-sm text-amber-900 leading-relaxed">
                      {client.important_notes}
                    </p>
                  </div>
                </Section>
              )}
            </div>
          ) : null}
        </>
      )}

      {/* ─── Tab: Historial de Sesiones ─── */}
      {tab === "sesiones" && (
        <>
          {sessionsLoading ? (
            <Card>
              <CardContent className="pt-6">
                <SkeletonBlock lines={4} />
              </CardContent>
            </Card>
          ) : sessions.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                No hay sesiones registradas para esta cliente.
              </CardContent>
            </Card>
          ) : (
            <div className="rounded-xl border border-terra-100 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-terra-50 border-b border-terra-100 text-terra-600 text-xs uppercase tracking-wider">
                    <th className="px-5 py-3 text-left font-medium">
                      Fecha
                    </th>
                    <th className="px-5 py-3 text-left font-medium hidden sm:table-cell">
                      Tipo de terapia
                    </th>
                    <th className="px-5 py-3 text-center font-medium hidden sm:table-cell">
                      Energía
                    </th>
                    <th className="px-5 py-3 text-left font-medium">
                      Costo
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((session, idx) => (
                    <tr
                      key={session.id}
                      onClick={() => router.push(`/clinica/sesiones/${session.id}`)}
                      className={`border-b border-terra-100/40 cursor-pointer hover:bg-terra-50/40 transition-colors duration-150 text-terra-800 ${
                        idx % 2 === 0 ? "bg-white" : "bg-terra-50/20"
                      }`}
                    >
                      <td className="px-5 py-4 font-medium">
                        {formatDate(session.measured_at)}
                      </td>
                      <td className="px-5 py-4 hidden sm:table-cell">
                        {session.therapy_type_name ? (
                          <span className="bg-terra-50 text-terra-600 text-xs px-2 py-0.5 rounded-full border border-terra-100">
                            {session.therapy_type_name}
                          </span>
                        ) : (
                          <span className="text-terra-300 italic text-xs">
                            Sin registrar
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-center hidden sm:table-cell">
                        {session.general_energy_level != null ? (
                          <span className="text-terra-700 font-medium">
                            {session.general_energy_level}
                          </span>
                        ) : (
                          <span className="text-terra-300 italic text-xs">—</span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-terra-700">
                        {session.cost != null
                          ? formatCurrency(session.cost)
                          : (
                            <span className="text-terra-300 italic text-xs">
                              Sin registrar
                            </span>
                          )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ─── Tab: Temas ─── */}
      {tab === "temas" && (
        <>
          {topicsLoading ? (
            <Card>
              <CardContent className="pt-6">
                <SkeletonBlock lines={4} />
              </CardContent>
            </Card>
          ) : topicsEndpointMissing ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                Próximamente
              </CardContent>
            </Card>
          ) : (
            <TopicsTabContent
              clientId={params.id}
              topics={topics}
              onTopicCompleted={(updated) =>
                setTopics((prev) =>
                  prev.map((t) => (t.id === updated.id ? updated : t)),
                )
              }
            />
          )}
        </>
      )}

      {/* ─── Tab: Salud ─── */}
      {tab === "salud" && (
        <>
          {loading ? (
            <Card>
              <CardContent className="pt-6">
                <SkeletonBlock lines={6} />
              </CardContent>
            </Card>
          ) : client ? (
            <div className="space-y-6">

              {/* Sueño */}
              {client.sleep && (
                <Section>
                  <SectionHeader icon={Moon} title="Sueño" />
                  <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                    <Field
                      label="Horas promedio por noche"
                      value={`${client.sleep.avg_hours} horas`}
                    />
                    <Field
                      label="Calidad del sueño"
                      value={SLEEP_LABELS[client.sleep.quality]}
                    />
                  </dl>
                </Section>
              )}

              {/* Condiciones médicas */}
              {client.conditions.length > 0 && (
                <Section>
                  <SectionHeader
                    icon={Stethoscope}
                    title="Condiciones de salud"
                  />
                  <div className="space-y-3">
                    {(["medical", "recurring_disease"] as const).map(
                      (type) => {
                        const items = client.conditions.filter(
                          (c) => c.condition_type === type,
                        );
                        if (items.length === 0) return null;
                        return (
                          <div key={type}>
                            <p className="text-xs uppercase tracking-wide text-gray-400 mb-2 font-medium">
                              {type === "medical"
                                ? "Diagnósticos médicos"
                                : "Padecimientos recurrentes"}
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {items.map((c) => (
                                <span
                                  key={c.id}
                                  className="text-xs font-medium px-3 py-1.5 rounded-full border bg-red-50 text-red-700 border-red-200"
                                >
                                  {c.description}
                                </span>
                              ))}
                            </div>
                          </div>
                        );
                      },
                    )}
                  </div>
                </Section>
              )}

              {/* Medicamentos */}
              {client.medications.length > 0 && (
                <Section>
                  <SectionHeader icon={Pill} title="Medicamentos" />
                  <div className="flex flex-wrap gap-2">
                    {client.medications.map((m) => (
                      <div
                        key={m.id}
                        className="text-sm px-3 py-2 rounded-lg border border-gray-200 bg-gray-50"
                      >
                        <span className="font-medium text-gray-900 capitalize">
                          {m.name}
                        </span>
                        {m.notes && (
                          <span className="text-gray-500 ml-1 text-xs">
                            ({m.notes})
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </Section>
              )}

              {!client.sleep &&
                client.conditions.length === 0 &&
                client.medications.length === 0 && (
                  <Card>
                    <CardContent className="py-12 text-center text-muted-foreground">
                      Sin información de salud registrada.
                    </CardContent>
                  </Card>
                )}
            </div>
          ) : null}
        </>
      )}

      {/* ─── Session Drawer ─── */}
      <SessionDrawer
        session={selectedSession}
        onClose={() => setSelectedSession(null)}
      />
    </div>
  );
}
