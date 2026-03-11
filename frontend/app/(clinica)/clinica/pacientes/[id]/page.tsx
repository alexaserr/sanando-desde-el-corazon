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
} from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate, formatPhone, formatCurrency } from "@/lib/utils/formatters";
import type {
  Client,
  Session,
  PaginatedResponse,
  MaritalStatus,
  SleepQuality,
} from "@/types/api";

type Tab = "datos" | "sesiones" | "salud";

const TAB_LABELS: Record<Tab, string> = {
  datos: "Datos Personales",
  sesiones: "Historial de Sesiones",
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
          className="h-4 bg-terra-200 rounded animate-pulse"
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
      <Icon className="h-5 w-5 text-terra-500 shrink-0" />
      <h2 className="text-base font-semibold text-terra-900">{title}</h2>
    </div>
  );
}

/** Contenedor de sección */
function Section({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-lg border border-gray-100 p-5">
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

export default function PacienteDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const [tab, setTab] = useState<Tab>("datos");
  const [client, setClient] = useState<Client | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [sessionsLoading, setSessionsLoading] = useState(false);
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
        const data = await apiClient.get<PaginatedResponse<Session>>(
          `/api/v1/clinical/clients/${params.id}/sessions?page=1&size=50`,
        );
        setSessions(data.items);
      } catch {
        setSessions([]);
      } finally {
        setSessionsLoading(false);
      }
    };
    fetchSessions();
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

      {error && <p className="text-sm text-destructive">{error}</p>}

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

      {/* ─── Tabs ─── */}
      <div className="border-b border-border">
        <nav className="flex gap-6" aria-label="Pestañas">
          {(["datos", "sesiones", "salud"] as Tab[]).map((t) => (
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
                  <div className="bg-amber-50 border-l-4 border-amber-400 rounded-r-lg p-4">
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
            <div className="rounded-lg border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-terra-50 border-b border-gray-200 text-terra-900">
                    <th className="px-4 py-3 text-left font-semibold">
                      Fecha
                    </th>
                    <th className="px-4 py-3 text-left font-semibold hidden sm:table-cell">
                      Tipo de terapia
                    </th>
                    <th className="px-4 py-3 text-left font-semibold hidden sm:table-cell">
                      Estado
                    </th>
                    <th className="px-4 py-3 text-left font-semibold">
                      Costo
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((session, idx) => (
                    <tr
                      key={session.id}
                      className={`border-b border-gray-100 cursor-pointer hover:bg-terra-50/50 transition-colors text-gray-900 ${
                        idx % 2 === 0 ? "bg-white" : "bg-gray-50/30"
                      }`}
                    >
                      <td className="px-4 py-3 font-medium">
                        {formatDate(session.measured_at ?? session.created_at)}
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        {session.session_type ? (
                          <span className="bg-gray-100 text-gray-700 text-xs px-2 py-0.5 rounded">
                            {session.session_type}
                          </span>
                        ) : (
                          <span className="text-gray-300 italic text-xs">
                            Sin registrar
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">
                        {session.status ?? (
                          <span className="text-gray-300 italic text-xs">
                            Sin registrar
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {session.cost != null
                          ? formatCurrency(session.cost)
                          : (
                            <span className="text-gray-300 italic text-xs">
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
    </div>
  );
}
