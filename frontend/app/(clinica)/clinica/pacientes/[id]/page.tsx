"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate, formatPhone, formatCurrency } from "@/lib/utils/formatters";
import type { Client, Session, PaginatedResponse, MaritalStatus } from "@/types/api";

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

function Field({
  label,
  value,
}: {
  label: string;
  value: string | number | null | undefined;
}) {
  return (
    <div>
      <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        {label}
      </dt>
      <dd className="mt-1 text-sm text-terra-900">{value ?? <span className="text-gray-400">—</span>}</dd>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-display text-lg text-terra-900 mb-4">{children}</h2>
  );
}

function Divider() {
  return <div className="border-b border-gray-100 my-6" />;
}

function TagList({
  items,
  className,
}: {
  items: string[] | null | undefined;
  className: string;
}) {
  if (!items || items.length === 0) {
    return <span className="text-sm text-gray-400">—</span>;
  }
  return (
    <div className="flex flex-wrap gap-2 mt-1">
      {items.map((item) => (
        <span key={item} className={`text-xs px-2 py-1 rounded-full ${className}`}>
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

  // Salud tab state
  const [conditionsAvailable, setConditionsAvailable] = useState<boolean | null>(null);
  const [conditionsLoading, setConditionsLoading] = useState(false);

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
        setError(err instanceof Error ? err.message : "Error al cargar el cliente.");
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

  useEffect(() => {
    if (tab !== "salud") return;
    if (conditionsAvailable !== null) return; // ya se intentó
    const fetchConditions = async () => {
      setConditionsLoading(true);
      try {
        await apiClient.get<PaginatedResponse<unknown>>(
          `/api/v1/clinical/clients/${params.id}/conditions?page=1&size=50`,
        );
        setConditionsAvailable(true);
      } catch {
        setConditionsAvailable(false);
      } finally {
        setConditionsLoading(false);
      }
    };
    fetchConditions();
  }, [tab, params.id, conditionsAvailable]);

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

      {/* Encabezado del paciente */}
      {!loading && client && (
        <div>
          <h1 className="text-2xl font-bold text-terra-900">{client.full_name}</h1>
          <p className="text-sm text-muted-foreground">
            Cliente desde {formatDate(client.created_at)}
          </p>
        </div>
      )}

      {/* Tabs */}
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

      {/* Tab: Datos Personales */}
      {tab === "datos" && (
        <Card>
          <CardContent className="pt-6">
            {loading ? (
              <SkeletonBlock lines={12} />
            ) : client ? (
              <div>
                {/* SECCIÓN 1: Información Personal */}
                <section>
                  <SectionTitle>Información Personal</SectionTitle>
                  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <Field label="Nombre completo" value={client.full_name} />
                    <Field label="Correo electrónico" value={client.email} />
                    <Field
                      label="Teléfono"
                      value={client.phone ? formatPhone(client.phone) : null}
                    />
                    <Field
                      label="Fecha de nacimiento"
                      value={client.birth_date ? formatDate(client.birth_date) : null}
                    />
                    <Field
                      label="Estado civil"
                      value={
                        client.marital_status
                          ? MARITAL_LABELS[client.marital_status]
                          : null
                      }
                    />
                    <Field label="Lugar de nacimiento" value={client.birth_place} />
                    <Field label="Lugar de residencia" value={client.residence_place} />
                    <Field label="Profesión" value={client.profession} />
                  </dl>
                </section>

                <Divider />

                {/* SECCIÓN 2: Perfil Emocional */}
                <section>
                  <SectionTitle>Perfil Emocional</SectionTitle>
                  <div className="space-y-6">
                    <div>
                      <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Emociones predominantes
                      </dt>
                      <TagList
                        items={client.predominant_emotions}
                        className="bg-terra-200/50 text-terra-700"
                      />
                    </div>
                    <div>
                      <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Motivación de visita
                      </dt>
                      <TagList
                        items={client.motivation_visit}
                        className="bg-blue-50 text-blue-700"
                      />
                    </div>
                  </div>
                </section>

                <Divider />

                {/* SECCIÓN 3: Familia */}
                <section>
                  <SectionTitle>Familia</SectionTitle>
                  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <Field label="Número de hijos" value={client.num_children} />
                    <Field label="Número de hermanos" value={client.num_siblings} />
                    <Field label="Orden de nacimiento" value={client.birth_order} />
                    <Field label="Abortos en sistema familiar" value={client.family_abortions} />
                    <div className="sm:col-span-2">
                      <Field label="Fallecimientos antes de 41" value={client.deaths_before_41} />
                    </div>
                  </dl>
                </section>

                <Divider />

                {/* SECCIÓN 4: Notas */}
                <section>
                  <SectionTitle>Notas</SectionTitle>
                  <div className="space-y-4">
                    {client.motivation_general && (
                      <div>
                        <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                          Motivación general
                        </dt>
                        <dd className="mt-1 text-sm text-terra-900">
                          {client.motivation_general}
                        </dd>
                      </div>
                    )}
                    {client.important_notes ? (
                      <div>
                        <dt className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                          Notas importantes
                        </dt>
                        <dd className="bg-amber-50 border-l-4 border-amber-400 p-4 text-sm text-terra-900">
                          {client.important_notes}
                        </dd>
                      </div>
                    ) : !client.motivation_general ? (
                      <p className="text-sm text-gray-400">—</p>
                    ) : null}
                  </div>
                </section>
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}

      {/* Tab: Historial de Sesiones */}
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
                No hay sesiones registradas para este cliente.
              </CardContent>
            </Card>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-terra-200 text-terra-900">
                    <th className="px-4 py-3 text-left font-semibold">Fecha</th>
                    <th className="px-4 py-3 text-left font-semibold hidden sm:table-cell">
                      Tipo de terapia
                    </th>
                    <th className="px-4 py-3 text-left font-semibold hidden sm:table-cell">
                      Estado
                    </th>
                    <th className="px-4 py-3 text-left font-semibold">Costo</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((session) => (
                    <tr
                      key={session.id}
                      onClick={() =>
                        router.push(`/clinica/sesiones/${session.id}`)
                      }
                      className="border-b cursor-pointer hover:bg-terra-50 transition-colors text-terra-900"
                    >
                      <td className="px-4 py-3">
                        {formatDate(session.measured_at ?? session.created_at)}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">
                        {session.session_type ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">
                        {session.status ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {session.cost != null ? formatCurrency(session.cost) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Tab: Salud */}
      {tab === "salud" && (
        <Card>
          <CardContent className="pt-6">
            {conditionsLoading ? (
              <SkeletonBlock lines={4} />
            ) : conditionsAvailable === false ? (
              <div className="py-12 text-center text-muted-foreground">
                <p className="text-lg font-medium text-terra-900 mb-2">Próximamente</p>
                <p className="text-sm">El historial de condiciones médicas estará disponible en una próxima versión.</p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Sin condiciones médicas registradas.</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
