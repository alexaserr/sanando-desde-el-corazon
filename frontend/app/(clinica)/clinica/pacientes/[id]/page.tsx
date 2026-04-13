"use client";

import { useState, useEffect, useMemo } from "react";
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
  Trash2,
  AlertCircle,
  AlertTriangle,
  RefreshCw,
  Pencil,
  Check,
} from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { useAuthStore } from "@/store/auth";
import { getClientTopics, completeClientTopic } from "@/lib/api/clinical";
import { Button } from "@/components/ui/button";
import { SortableHeader, toggleSort } from "@/components/ui/sortable-header";
import type { SortConfig } from "@/components/ui/sortable-header";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
  muy_mala: "Muy mala",
  mala: "Mala",
  regular: "Regular",
  buena: "Buena",
  muy_buena: "Muy buena",
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
      <p className="text-xs uppercase tracking-wide text-terra-400 mb-1 font-medium">
        {label}
      </p>
      {value != null ? (
        <p className="text-sm text-terra-900">{value}</p>
      ) : (
        <p className="text-sm text-terra-200 italic">Sin registrar</p>
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
    <div className="bg-terra-50 rounded-xl border border-terra-100 p-6">
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
    return <p className="text-sm text-terra-200 italic">Sin registrar</p>;
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
        className="fixed right-0 top-0 h-full w-full max-w-md bg-terra-50 z-50 shadow-[−4px_0_24px_rgba(61,26,15,0.10)] flex flex-col"
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
              className="bg-terra-50 rounded-lg border border-terra-100 p-5 space-y-3"
            >
              <div className="flex items-start justify-between gap-4">
                <p className="font-medium text-terra-900">{topic.name}</p>
                <button
                  onClick={() => handleComplete(topic.id)}
                  disabled={completing === topic.id}
                  className="shrink-0 text-sm text-terra-700 hover:text-terra-900 border border-terra-200 rounded px-3 py-1 transition-colors disabled:opacity-50"
                >
                  {completing === topic.id ? "Guardando…" : "Marcar completado"}
                </button>
              </div>
              <div className="space-y-1">
                <div className="h-2 rounded-full bg-terra-100 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${progressColor(topic.progress_pct)}`}
                    style={{ width: `${Math.min(100, Math.max(0, topic.progress_pct))}%` }}
                  />
                </div>
                <p className="text-xs text-terra-500">{topic.progress_pct}% completado</p>
              </div>
              <p className="text-xs text-terra-400">Creado el {formatDate(topic.created_at)}</p>
            </div>
          ))}
        </div>
      )}

      {/* Temas completados */}
      {completed.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-terra-500 uppercase tracking-wide">
            Temas completados
          </h3>
          {completed.map((topic) => (
            <div
              key={topic.id}
              className="bg-terra-50 rounded-lg border border-terra-100 p-5 space-y-2"
            >
              <div className="flex items-center justify-between gap-4">
                <p className="font-medium text-terra-900">{topic.name}</p>
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
  const { user } = useAuthStore();
  const isAdmin = user?.role === "admin";
  const [isDeleting, setIsDeleting] = useState(false);

  const [tab, setTab] = useState<Tab>("datos");
  const [client, setClient] = useState<Client | null>(null);
  const [sessions, setSessions] = useState<ClientSessionItem[]>([]);
  const [topics, setTopics] = useState<ClientTopic[]>([]);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionSort, setSessionSort] = useState<SortConfig | null>(null);
  const [topicsLoading, setTopicsLoading] = useState(false);
  const [topicsEndpointMissing, setTopicsEndpointMissing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isMarkingConsent, setIsMarkingConsent] = useState(false);

  // Edición de datos personales
  type PersonalForm = {
    full_name: string;
    email: string;
    phone: string;
    birth_date: string;
    marital_status: MaritalStatus | "";
    profession: string;
    birth_place: string;
    residence_place: string;
  };
  const emptyForm: PersonalForm = {
    full_name: "",
    email: "",
    phone: "",
    birth_date: "",
    marital_status: "",
    profession: "",
    birth_place: "",
    residence_place: "",
  };
  const [isEditingPersonal, setIsEditingPersonal] = useState(false);
  const [personalForm, setPersonalForm] = useState<PersonalForm>(emptyForm);
  const [isSavingPersonal, setIsSavingPersonal] = useState(false);
  const [personalSaveError, setPersonalSaveError] = useState<string | null>(null);
  const [personalSaveOk, setPersonalSaveOk] = useState(false);

  function startEditPersonal() {
    if (!client) return;
    setPersonalForm({
      full_name: client.full_name ?? "",
      email: client.email ?? "",
      phone: client.phone ?? "",
      birth_date: client.birth_date ? client.birth_date.slice(0, 10) : "",
      marital_status: client.marital_status ?? "",
      profession: client.profession ?? "",
      birth_place: client.birth_place ?? "",
      residence_place: client.residence_place ?? "",
    });
    setPersonalSaveError(null);
    setPersonalSaveOk(false);
    setIsEditingPersonal(true);
  }

  function cancelEditPersonal() {
    setIsEditingPersonal(false);
    setPersonalSaveError(null);
  }

  async function handleSavePersonal() {
    if (!client || isSavingPersonal) return;
    setIsSavingPersonal(true);
    setPersonalSaveError(null);
    setPersonalSaveOk(false);
    const payload: Record<string, string | null> = {
      full_name: personalForm.full_name.trim(),
      email: personalForm.email.trim() || null,
      phone: personalForm.phone.trim() || null,
      birth_date: personalForm.birth_date || null,
      marital_status: personalForm.marital_status || null,
      profession: personalForm.profession.trim() || null,
      birth_place: personalForm.birth_place.trim() || null,
      residence_place: personalForm.residence_place.trim() || null,
    };
    try {
      const updated = await apiClient.patch<Client, typeof payload>(
        `/api/v1/clinical/clients/${client.id}`,
        payload,
      );
      setClient(updated);
      setIsEditingPersonal(false);
      setPersonalSaveOk(true);
      setTimeout(() => setPersonalSaveOk(false), 3000);
    } catch (err) {
      setPersonalSaveError(
        err instanceof Error ? err.message : "Error al guardar los cambios.",
      );
    } finally {
      setIsSavingPersonal(false);
    }
  }

  async function handleMarkConsent() {
    if (!client || isMarkingConsent) return;
    setIsMarkingConsent(true);
    try {
      await apiClient.post(`/api/v1/clinical/clients/${client.id}/documents`, {});
      setClient((prev) => prev ? { ...prev, has_consent: true } : prev);
    } catch (err) {
      console.error('Failed to mark consent:', err);
    } finally {
      setIsMarkingConsent(false);
    }
  }

  async function handleDeleteClient() {
    if (!client || isDeleting) return;
    const confirmed = window.confirm(
      "¿Estás seguro de que deseas eliminar a este paciente y todo su historial? Esta acción no se puede deshacer.",
    );
    if (!confirmed) return;
    setIsDeleting(true);
    try {
      await apiClient.delete(`/api/v1/clinical/clients/${client.id}`);
      router.push("/clinica/pacientes");
    } catch (err) {
      console.error("Delete client failed:", err);
      setIsDeleting(false);
    }
  }

  const handleSessionSort = (key: string) => {
    setSessionSort((prev) => toggleSort(prev, key));
  };

  const sortedSessions = useMemo(() => {
    if (!sessionSort) return sessions;
    const { key, dir } = sessionSort;
    return [...sessions].sort((a, b) => {
      const aVal = String((a as unknown as Record<string, unknown>)[key] ?? "");
      const bVal = String((b as unknown as Record<string, unknown>)[key] ?? "");
      const cmp = aVal.localeCompare(bVal, "es-MX");
      return dir === "asc" ? cmp : -cmp;
    });
  }, [sessions, sessionSort]);

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
            <p className="text-sm text-terra-500 mt-0.5">
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
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg border border-terra-100 text-terra-600 hover:bg-terra-50 hover:border-terra-300 transition-colors"
              >
                <Mail className="h-4 w-4" />
              </a>
            )}
            {client.phone && (
              <a
                href={`tel:${client.phone}`}
                title={formatPhone(client.phone)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg border border-terra-100 text-terra-600 hover:bg-terra-50 hover:border-terra-300 transition-colors"
              >
                <Phone className="h-4 w-4" />
              </a>
            )}
            {isAdmin && (
              <button
                onClick={handleDeleteClient}
                disabled={isDeleting}
                className="flex items-center gap-2 px-4 h-10 rounded text-sm font-medium text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Trash2 className="h-4 w-4" />
                {isDeleting ? "Eliminando..." : "Eliminar paciente"}
              </button>
            )}
          </div>
        </div>
      )}

      {/* ─── Alerta de consentimiento pendiente ─── */}
      {!loading && client && !client.has_consent && (
        <div className="bg-amber-50 border-l-4 border-amber-400 rounded-r-lg p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
              <div>
                <p className="text-sm font-medium text-amber-800">
                  Consentimiento pendiente
                </p>
                <p className="text-xs text-amber-600">
                  Requerido por NOM-004-SSA3-2012 antes de la primera sesión.
                </p>
              </div>
            </div>
            <button
              onClick={handleMarkConsent}
              disabled={isMarkingConsent}
              className="shrink-0 flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-medium px-3 py-1.5 rounded-md transition-colors disabled:opacity-50"
            >
              {isMarkingConsent ? 'Guardando...' : 'Marcar como firmado'}
            </button>
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
                <div className="flex items-center justify-between mb-3">
                  <SectionHeader icon={User} title="Información Personal" />
                  {!isEditingPersonal ? (
                    <button
                      onClick={startEditPersonal}
                      className="flex items-center gap-1.5 text-xs font-medium text-terra-700 hover:text-terra-900 border border-terra-200 hover:border-terra-300 rounded px-3 py-1.5 transition-colors -mt-3"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Editar
                    </button>
                  ) : (
                    <div className="flex items-center gap-2 -mt-3">
                      <button
                        onClick={cancelEditPersonal}
                        disabled={isSavingPersonal}
                        className="text-xs font-medium text-terra-500 hover:text-terra-800 rounded px-3 py-1.5 transition-colors disabled:opacity-50"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={handleSavePersonal}
                        disabled={isSavingPersonal}
                        className="flex items-center gap-1.5 text-xs font-medium bg-[#C4704A] hover:bg-terra-500 text-white rounded px-3 py-1.5 transition-colors disabled:opacity-50"
                      >
                        <Check className="h-3.5 w-3.5" />
                        {isSavingPersonal ? "Guardando…" : "Guardar"}
                      </button>
                    </div>
                  )}
                </div>

                {personalSaveError && (
                  <div className="mb-4 border-l-4 border-red-400 bg-red-50 rounded-r p-3 text-sm text-red-700">
                    {personalSaveError}
                  </div>
                )}
                {personalSaveOk && (
                  <div className="mb-4 border-l-4 border-green-400 bg-green-50 rounded-r p-3 text-sm text-green-700">
                    Cambios guardados correctamente.
                  </div>
                )}

                {!isEditingPersonal ? (
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
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-terra-400 mb-1 font-medium">
                        Nombre completo
                      </p>
                      <Input
                        value={personalForm.full_name}
                        onChange={(e) =>
                          setPersonalForm((f) => ({ ...f, full_name: e.target.value }))
                        }
                      />
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-terra-400 mb-1 font-medium">
                        Correo electrónico
                      </p>
                      <Input
                        type="email"
                        value={personalForm.email}
                        onChange={(e) =>
                          setPersonalForm((f) => ({ ...f, email: e.target.value }))
                        }
                      />
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-terra-400 mb-1 font-medium">
                        Teléfono
                      </p>
                      <Input
                        type="tel"
                        value={personalForm.phone}
                        onChange={(e) =>
                          setPersonalForm((f) => ({ ...f, phone: e.target.value }))
                        }
                      />
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-terra-400 mb-1 font-medium">
                        Fecha de nacimiento
                      </p>
                      <Input
                        type="date"
                        value={personalForm.birth_date}
                        onChange={(e) =>
                          setPersonalForm((f) => ({ ...f, birth_date: e.target.value }))
                        }
                      />
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-terra-400 mb-1 font-medium">
                        Estado civil
                      </p>
                      <select
                        value={personalForm.marital_status}
                        onChange={(e) =>
                          setPersonalForm((f) => ({
                            ...f,
                            marital_status: e.target.value as MaritalStatus | "",
                          }))
                        }
                        className="flex w-full rounded-none border-0 border-b border-arcilla bg-marfil px-4 py-3.5 text-[15px] text-foreground focus:border-b-2 focus:border-terra focus:outline-none"
                      >
                        <option value="">Sin registrar</option>
                        {(Object.keys(MARITAL_LABELS) as MaritalStatus[]).map((k) => (
                          <option key={k} value={k}>
                            {MARITAL_LABELS[k]}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-terra-400 mb-1 font-medium">
                        Profesión
                      </p>
                      <Input
                        value={personalForm.profession}
                        onChange={(e) =>
                          setPersonalForm((f) => ({ ...f, profession: e.target.value }))
                        }
                      />
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-terra-400 mb-1 font-medium">
                        Lugar de nacimiento
                      </p>
                      <Input
                        value={personalForm.birth_place}
                        onChange={(e) =>
                          setPersonalForm((f) => ({ ...f, birth_place: e.target.value }))
                        }
                      />
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-wide text-terra-400 mb-1 font-medium">
                        Lugar de residencia
                      </p>
                      <Input
                        value={personalForm.residence_place}
                        onChange={(e) =>
                          setPersonalForm((f) => ({ ...f, residence_place: e.target.value }))
                        }
                      />
                    </div>
                  </div>
                )}
              </Section>

              {/* SECCIÓN 2: Perfil Emocional */}
              <Section>
                <SectionHeader icon={Heart} title="Perfil Emocional" />
                <div className="space-y-5">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-terra-400 mb-2 font-medium">
                      Emociones predominantes
                    </p>
                    <TagList
                      items={client.predominant_emotions}
                      chipClass="bg-terra-50 text-terra-700 border-terra-200"
                    />
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-terra-400 mb-2 font-medium">
                      Motivación de visita
                    </p>
                    <TagList
                      items={client.motivation_visit}
                      chipClass="bg-terra-200/50 text-terra-900 border-terra-500"
                    />
                  </div>
                  {client.motivation_general && (
                    <div>
                      <p className="text-xs uppercase tracking-wide text-terra-400 mb-1 font-medium">
                        Motivación general
                      </p>
                      <p className="text-sm text-terra-900 leading-relaxed">
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
                  <tr className="bg-[#FAF7F5] border-b border-terra-100">
                    <SortableHeader label="Fecha" sortKey="measured_at" currentSort={sessionSort} onSort={handleSessionSort} />
                    <SortableHeader label="Tipo de terapia" sortKey="therapy_type_name" currentSort={sessionSort} onSort={handleSessionSort} className="hidden sm:table-cell" />
                    <th className="px-5 py-3 text-center font-medium text-[#4A3628] text-xs uppercase hidden sm:table-cell" style={{ letterSpacing: "0.1em" }}>
                      Energía
                    </th>
                    <th className="px-5 py-3 text-left font-medium text-[#4A3628] text-xs uppercase" style={{ letterSpacing: "0.1em" }}>
                      Costo
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedSessions.map((session, idx) => (
                    <tr
                      key={session.id}
                      onClick={() => router.push(`/clinica/sesiones/${session.id}`)}
                      className={`border-b border-terra-100/40 cursor-pointer hover:bg-terra-50/40 transition-colors duration-150 text-terra-800 ${
                        idx % 2 === 1 ? "bg-[#F2E8E4]" : "bg-[#FAF7F5]"
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
                            <p className="text-xs uppercase tracking-wide text-terra-400 mb-2 font-medium">
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
                        className="text-sm px-3 py-2 rounded-lg border border-terra-100 bg-terra-50"
                      >
                        <span className="font-medium text-terra-900 capitalize">
                          {m.name}
                        </span>
                        {m.notes && (
                          <span className="text-terra-500 ml-1 text-xs">
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
