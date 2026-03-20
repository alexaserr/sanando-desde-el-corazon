"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Users,
  CalendarDays,
  Activity,
  PlusCircle,
  ChevronRight,
} from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { formatDate, formatCurrency } from "@/lib/utils/formatters";
import type { Client, PaginatedResponse, SessionListItem } from "@/types/api";

// ─── Helpers ────────────────────────────────────────────────────────────────

function firstDayOfMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

// ─── Skeletons & Cards ──────────────────────────────────────────────────────

function StatCardSkeleton() {
  return (
    <div className="bg-white rounded-lg shadow-[0_2px_8px_rgba(44,34,32,0.06)] p-6">
      <div className="flex flex-row items-center justify-between pb-3">
        <div className="h-4 w-28 bg-terra-200 rounded animate-pulse" />
        <div className="h-12 w-12 bg-terra-200 rounded-full animate-pulse" />
      </div>
      <div className="h-9 w-16 bg-terra-200 rounded animate-pulse mb-1" />
      <div className="h-3 w-24 bg-terra-200 rounded animate-pulse" />
    </div>
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

function StatCard({
  title,
  value,
  description,
  icon: Icon,
  iconBg,
  iconColor,
  href,
}: StatCardProps) {
  const card = (
    <div
      className={`bg-white rounded-lg shadow-[0_2px_8px_rgba(44,34,32,0.06)] transition-shadow ${
        href ? "cursor-pointer hover:shadow-[0_4px_16px_rgba(44,34,32,0.10)]" : "cursor-default"
      }`}
    >
      <div className="flex flex-row items-center justify-between p-6 pb-3">
        <span className="text-xs font-medium uppercase tracking-wide text-[#4A3628]">
          {title}
        </span>
        <div
          className={`h-12 w-12 rounded-full flex items-center justify-center flex-shrink-0 ${iconBg}`}
        >
          <Icon className={`h-5 w-5 ${iconColor}`} />
        </div>
      </div>
      <div className="px-6 pb-6 pt-0">
        <div className="font-body text-3xl font-bold text-[#2C2220]">{value}</div>
        <p className="text-sm text-[#4A3628]/70 mt-1">{description}</p>
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block">
        {card}
      </Link>
    );
  }
  return card;
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function ClinicaDashboardPage() {
  const router = useRouter();

  const [totalClients, setTotalClients] = useState<number | null>(null);
  const [totalSessions, setTotalSessions] = useState<number | null>(null);
  const [sessionsThisMonth, setSessionsThisMonth] = useState<number | null>(null);
  const [recentSessions, setRecentSessions] = useState<SessionListItem[]>([]);
  const [recentClients, setRecentClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);

      const results = await Promise.allSettled([
        // Total clients
        apiClient.get<PaginatedResponse<unknown>>(
          "/api/v1/clinical/clients?per_page=1&page=1",
        ),
        // Recent sessions (total + últimas 5)
        apiClient.get<{ data: SessionListItem[]; total: number }>(
          "/api/v1/clinical/sessions?per_page=5&page=1&sort_by=measured_at&sort_order=desc",
        ),
        // Sessions this month
        apiClient.get<{ data: SessionListItem[]; total: number }>(
          `/api/v1/clinical/sessions?per_page=1&page=1&date_from=${firstDayOfMonth()}`,
        ),
        // Recent clients
        apiClient.get<PaginatedResponse<Client>>(
          "/api/v1/clinical/clients?page=1&per_page=5&sort_by=created_at&sort_order=desc",
        ),
      ]);

      let anyError = false;

      if (results[0].status === "fulfilled") {
        setTotalClients(results[0].value.total);
      } else {
        anyError = true;
      }

      if (results[1].status === "fulfilled") {
        setTotalSessions(results[1].value.total);
        setRecentSessions(results[1].value.data);
      } else {
        anyError = true;
      }

      if (results[2].status === "fulfilled") {
        setSessionsThisMonth(results[2].value.total);
      } else {
        anyError = true;
      }

      if (results[3].status === "fulfilled") {
        setRecentClients(results[3].value.items);
      }

      if (anyError) {
        setError("No se pudieron cargar algunas estadísticas.");
      }

      setLoading(false);
    };

    load();
  }, []);

  const statCards: StatCardProps[] = [
    {
      title: "Total Pacientes",
      value: totalClients ?? "—",
      description: "Expedientes registrados",
      icon: Users,
      iconBg: "bg-terra-100",
      iconColor: "text-terra-600",
      href: "/clinica/pacientes",
    },
    {
      title: "Sesiones Este Mes",
      value: sessionsThisMonth ?? "—",
      description: "Mes actual",
      icon: CalendarDays,
      iconBg: "bg-blue-50/80",
      iconColor: "text-blue-500",
      href: "/clinica/sesiones",
    },
    {
      title: "Total Sesiones",
      value: totalSessions ?? "—",
      description: "Histórico",
      icon: Activity,
      iconBg: "bg-emerald-50/80",
      iconColor: "text-emerald-500",
      href: "/clinica/sesiones",
    },
  ];

  return (
    <div className="space-y-12 max-w-5xl">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold text-[#2C2220]">
            Dashboard
          </h1>
          <p className="text-sm text-[#4A3628]/60">
            Bienvenido a Sanando desde el Corazón
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push("/clinica/sesiones/nueva")}
            className="flex items-center gap-2 bg-[#C4704A] hover:bg-[#A85C3A] text-white h-10 px-4 rounded-lg text-sm font-medium transition-colors"
          >
            <PlusCircle className="h-4 w-4" />
            Nueva sesión
          </button>
          <button
            onClick={() => router.push("/clinica/pacientes/nuevo")}
            className="flex items-center gap-2 border border-[#C4704A] text-[#C4704A] hover:bg-[#C4704A]/5 h-10 px-4 rounded-lg text-sm font-medium transition-colors"
          >
            <PlusCircle className="h-4 w-4" />
            Nuevo paciente
          </button>
        </div>
      </div>

      {/* Error parcial */}
      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {loading
          ? Array.from({ length: 3 }).map((_, i) => (
              <StatCardSkeleton key={i} />
            ))
          : statCards.map((card) => <StatCard key={card.title} {...card} />)}
      </div>

      {/* Sesiones recientes */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-[#2C2220]">
            Sesiones Recientes
          </h2>
          <button
            onClick={() => router.push("/clinica/sesiones")}
            className="text-sm text-[#C4704A] hover:text-[#A85C3A] flex items-center gap-1 transition-colors"
          >
            Ver todas
            <ChevronRight className="h-3 w-3" />
          </button>
        </div>

        <div className="rounded-lg shadow-[0_2px_8px_rgba(44,34,32,0.06)] overflow-hidden bg-white">
          {loading ? (
            <ul className="divide-y divide-[#2C2220]/5">
              {Array.from({ length: 5 }).map((_, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between px-5 py-3.5 gap-4"
                >
                  <div className="space-y-1.5">
                    <div className="h-4 w-40 bg-terra-200 rounded animate-pulse" />
                    <div className="h-3 w-24 bg-terra-200 rounded animate-pulse" />
                  </div>
                  <div className="h-3 w-20 bg-terra-200 rounded animate-pulse" />
                </li>
              ))}
            </ul>
          ) : recentSessions.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-[#4A3628]/60">
              No hay sesiones registradas aún.
            </p>
          ) : (
            <ul className="divide-y divide-[#2C2220]/5">
              {recentSessions.map((s) => (
                <li
                  key={s.id}
                  onClick={() => router.push(`/clinica/sesiones/${s.id}`)}
                  className="flex items-center justify-between px-5 py-3.5 cursor-pointer hover:shadow-[inset_0_0_0_0_transparent,0_2px_8px_rgba(44,34,32,0.06)] hover:bg-[#FAF7F5] transition-all duration-150"
                >
                  <div>
                    <p className="text-sm font-medium text-[#2C2220]">
                      {s.client_name ?? "Sin paciente"}
                    </p>
                    <p className="text-xs text-[#4A3628]/60">
                      {s.therapy_type_name ?? "Sesión"} ·{" "}
                      {formatDate(s.measured_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-[#4A3628]/60 flex-shrink-0">
                    {s.cost != null && (
                      <span className="text-[#2C2220] font-medium">
                        {formatCurrency(s.cost)}
                      </span>
                    )}
                    <ChevronRight className="h-3 w-3" />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Pacientes recientes */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-[#2C2220]">
            Pacientes Recientes
          </h2>
          <button
            onClick={() => router.push("/clinica/pacientes")}
            className="text-sm text-[#C4704A] hover:text-[#A85C3A] flex items-center gap-1 transition-colors"
          >
            Ver todos
            <ChevronRight className="h-3 w-3" />
          </button>
        </div>

        <div className="rounded-lg shadow-[0_2px_8px_rgba(44,34,32,0.06)] overflow-hidden bg-white">
          {loading ? (
            <ul className="divide-y divide-[#2C2220]/5">
              {Array.from({ length: 5 }).map((_, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between px-5 py-3.5 gap-4"
                >
                  <div className="space-y-1.5">
                    <div className="h-4 w-40 bg-terra-200 rounded animate-pulse" />
                    <div className="h-3 w-24 bg-terra-200 rounded animate-pulse" />
                  </div>
                  <div className="h-3 w-20 bg-terra-200 rounded animate-pulse" />
                </li>
              ))}
            </ul>
          ) : recentClients.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-[#4A3628]/60">
              No hay pacientes registrados aún.
            </p>
          ) : (
            <ul className="divide-y divide-[#2C2220]/5">
              {recentClients.map((client) => (
                <li
                  key={client.id}
                  onClick={() =>
                    router.push(`/clinica/pacientes/${client.id}`)
                  }
                  className="flex items-center justify-between px-5 py-3.5 cursor-pointer hover:shadow-[inset_0_0_0_0_transparent,0_2px_8px_rgba(44,34,32,0.06)] hover:bg-[#FAF7F5] transition-all duration-150"
                >
                  <div>
                    <p className="text-sm font-medium text-[#2C2220]">
                      {client.full_name}
                    </p>
                    <p className="text-xs text-[#4A3628]/60">
                      {(client.profession && client.profession !== "NA")
                        ? client.profession
                        : client.email ?? "—"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-[#4A3628]/60 flex-shrink-0">
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
