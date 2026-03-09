"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Users, CalendarDays, Activity, Zap, ChevronRight } from "lucide-react";
import { apiClient, ApiError } from "@/lib/api/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/utils/formatters";
import type { Client, Session, PaginatedResponse } from "@/types/api";

interface DashboardStats {
  total_clients: number;
  sessions_this_month: number | null;
  total_sessions: number;
  avg_energy: number | null;
}

function StatCardSkeleton() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="h-4 w-28 bg-terra-200 rounded animate-pulse" />
        <div className="h-8 w-8 bg-terra-200 rounded animate-pulse" />
      </CardHeader>
      <CardContent>
        <div className="h-8 w-16 bg-terra-200 rounded animate-pulse mb-1" />
        <div className="h-3 w-24 bg-terra-200 rounded animate-pulse" />
      </CardContent>
    </Card>
  );
}

interface StatCardProps {
  title: string;
  value: string | number;
  description: string;
  icon: React.ElementType;
}

function StatCard({ title, value, description, icon: Icon }: StatCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <div className="h-8 w-8 rounded-md bg-terra-200 flex items-center justify-center flex-shrink-0">
          <Icon className="h-4 w-4 text-terra-700" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-terra-900">{value}</div>
        <p className="text-xs text-muted-foreground mt-1">{description}</p>
      </CardContent>
    </Card>
  );
}

export default function ClinicaDashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentClients, setRecentClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);

      // Intentar endpoint dedicado; si no existe aún, fallback a queries individuales
      try {
        const dashboardStats = await apiClient.get<DashboardStats>(
          "/api/v1/clinical/dashboard/stats",
        );
        setStats(dashboardStats);
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) {
          const [clientsRes, sessionsRes] = await Promise.allSettled([
            apiClient.get<PaginatedResponse<Client>>(
              "/api/v1/clinical/clients?page=1&size=1",
            ),
            apiClient.get<PaginatedResponse<Session>>(
              "/api/v1/clinical/sessions?page=1&size=1",
            ),
          ]);
          setStats({
            total_clients:
              clientsRes.status === "fulfilled" ? clientsRes.value.total : 0,
            sessions_this_month: null, // requiere filtro de fecha en backend
            total_sessions:
              sessionsRes.status === "fulfilled" ? sessionsRes.value.total : 0,
            avg_energy: null,
          });
        }
        // Otros errores (401, red) son manejados por apiClient
      }

      // Pacientes recientes — independiente de las stats
      try {
        const clientsRes = await apiClient.get<PaginatedResponse<Client>>(
          "/api/v1/clinical/clients?page=1&size=5&sort_by=created_at&sort_order=desc",
        );
        setRecentClients(clientsRes.items);
      } catch {
        setRecentClients([]);
      }

      setLoading(false);
    };

    fetchData();
  }, []);

  const statCards: StatCardProps[] = [
    {
      title: "Total Pacientes",
      value: stats?.total_clients ?? "—",
      description: "Expedientes registrados",
      icon: Users,
    },
    {
      title: "Sesiones Este Mes",
      value: stats?.sessions_this_month ?? "—",
      description: "Mes actual",
      icon: CalendarDays,
    },
    {
      title: "Total Sesiones",
      value: stats?.total_sessions ?? "—",
      description: "Histórico",
      icon: Activity,
    },
    {
      title: "Energía Promedio",
      value: stats?.avg_energy != null ? stats.avg_energy.toFixed(1) : "—",
      description: "Últimas sesiones",
      icon: Zap,
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-terra-900">
          Dashboard
        </h1>
        <p className="text-muted-foreground">
          Bienvenido a Sanando desde el Corazón
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)
          : statCards.map((card) => <StatCard key={card.title} {...card} />)}
      </div>

      {/* Pacientes recientes */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-terra-900">
            Pacientes Recientes
          </h2>
          <button
            onClick={() => router.push("/clinica/pacientes")}
            className="text-sm text-terra-700 hover:text-terra-900 flex items-center gap-1 transition-colors"
          >
            Ver todos
            <ChevronRight className="h-3 w-3" />
          </button>
        </div>

        <div className="rounded-lg border overflow-hidden bg-white">
          {loading ? (
            <ul className="divide-y">
              {Array.from({ length: 5 }).map((_, i) => (
                <li key={i} className="flex items-center justify-between px-4 py-3 gap-4">
                  <div className="space-y-1.5">
                    <div className="h-4 w-40 bg-terra-200 rounded animate-pulse" />
                    <div className="h-3 w-24 bg-terra-200 rounded animate-pulse" />
                  </div>
                  <div className="h-3 w-20 bg-terra-200 rounded animate-pulse" />
                </li>
              ))}
            </ul>
          ) : recentClients.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              No hay pacientes registrados aún.
            </p>
          ) : (
            <ul className="divide-y">
              {recentClients.map((client) => (
                <li
                  key={client.id}
                  onClick={() => router.push(`/clinica/pacientes/${client.id}`)}
                  className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-terra-50 transition-colors"
                >
                  <div>
                    <p className="text-sm font-medium text-terra-900">
                      {client.full_name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {client.profession ?? client.email ?? "—"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground flex-shrink-0">
                    <span>{formatDate(client.created_at)}</span>
                    <ChevronRight className="h-3 w-3" />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
