"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Users, CalendarDays, Activity, Zap, ChevronRight } from "lucide-react";
import { apiClient, ApiError } from "@/lib/api/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/utils/formatters";
import type { Client, PaginatedResponse } from "@/types/api";

interface DashboardStats {
  total_clients: number;
  sessions_this_month: number | null;
  sessions_this_week: number | null;
  total_sessions: number;
  average_energy: number | null;
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
  iconBg: string;
  iconColor: string;
  href?: string;
}

function StatCard({ title, value, description, icon: Icon, iconBg, iconColor, href }: StatCardProps) {
  const card = (
    <Card
      className={`bg-white border border-terra-100 rounded-card shadow-card transition-shadow ${
        href ? "cursor-pointer hover:shadow-card-hover" : "cursor-default"
      }`}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 p-6">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <div className={`h-12 w-12 rounded-full flex items-center justify-center flex-shrink-0 ${iconBg}`}>
          <Icon className={`h-5 w-5 ${iconColor}`} />
        </div>
      </CardHeader>
      <CardContent className="px-6 pb-6 pt-0">
        <div className="text-2xl font-bold text-terra-900">{value}</div>
        <p className="text-xs text-muted-foreground mt-1">{description}</p>
      </CardContent>
    </Card>
  );

  if (href) {
    return <Link href={href} className="block">{card}</Link>;
  }
  return card;
}

export default function ClinicaDashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentClients, setRecentClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);

      try {
        const res = await apiClient.get<{ data: DashboardStats }>(
          "/api/v1/clinical/dashboard/stats",
        );
        setStats(res.data);
      } catch (err) {
        const message =
          err instanceof ApiError
            ? `Error ${err.status}: no se pudieron cargar las estadísticas`
            : "No se pudieron cargar las estadísticas del dashboard";
        setError(message);
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
      iconBg: "bg-terra-100",
      iconColor: "text-terra-600",
      href: "/clinica/pacientes",
    },
    {
      title: "Sesiones Este Mes",
      value: stats?.sessions_this_month ?? "—",
      description: "Mes actual",
      icon: CalendarDays,
      iconBg: "bg-blue-50/80",
      iconColor: "text-blue-500",
      href: "/clinica/sesiones",
    },
    {
      title: "Total Sesiones",
      value: stats?.total_sessions ?? "—",
      description: "Histórico",
      icon: Activity,
      iconBg: "bg-emerald-50/80",
      iconColor: "text-emerald-500",
      href: "/clinica/sesiones",
    },
    {
      title: "Energía Promedio",
      value: stats?.average_energy != null ? stats.average_energy.toFixed(1) : "—",
      description: "Últimas sesiones",
      icon: Zap,
      iconBg: "bg-amber-50/80",
      iconColor: "text-amber-500",
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold text-terra-900">
          Dashboard
        </h1>
        <p className="text-muted-foreground">
          Bienvenido a Sanando desde el Corazón
        </p>
      </div>

      {/* Error de estadísticas */}
      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Stat cards */}
      <div className="grid gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
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

        <div className="rounded-xl border border-terra-100 overflow-hidden bg-white">
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
