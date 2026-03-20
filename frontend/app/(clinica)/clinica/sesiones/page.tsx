"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { PlusCircle, ChevronLeft, ChevronRight, AlertCircle, CalendarPlus } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { formatDate, formatCurrency } from "@/lib/utils/formatters";
import type { SessionListItem } from "@/types/api";

interface SessionsResponse {
  data: SessionListItem[];
  total: number;
  page: number;
  per_page: number;
}

const PER_PAGE = 20;

function TableSkeleton() {
  return (
    <div className="bg-white rounded-lg shadow-[0_2px_8px_rgba(44,34,32,0.06)] overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="bg-[#FAF7F5] border-b border-[#D4A592]">
            {["Paciente", "Terapia", "Fecha", "Costo"].map((h) => (
              <th
                key={h}
                className="text-left text-xs uppercase tracking-wide text-[#4A3628] font-normal px-4 py-3"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 8 }).map((_, i) => (
            <tr key={i} className="border-b border-[#F2E8E4]">
              <td className="px-4 py-3"><div className="h-4 w-32 bg-terra-200 rounded animate-pulse" /></td>
              <td className="px-4 py-3"><div className="h-4 w-28 bg-terra-200 rounded animate-pulse" /></td>
              <td className="px-4 py-3"><div className="h-4 w-36 bg-terra-200 rounded animate-pulse" /></td>
              <td className="px-4 py-3"><div className="h-4 w-20 bg-terra-200 rounded animate-pulse" /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function SessionsPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [data, setData] = useState<SessionsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSessions = useCallback(async (p: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<SessionsResponse>(
        `/api/v1/clinical/sessions?page=${p}&per_page=${PER_PAGE}&sort_by=measured_at&sort_order=desc`,
      );
      setData(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar sesiones");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions(page);
  }, [page, fetchSessions]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PER_PAGE)) : 1;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-semibold tracking-tight text-terra-900">
            Sesiones
          </h1>
          <p className="text-sm text-[#4A3628] mt-0.5">
            Historial de sesiones clínicas
          </p>
        </div>
        <button
          onClick={() => router.push("/clinica/sesiones/nueva")}
          className="flex items-center gap-2 bg-terra-700 hover:bg-terra-500 text-white h-10 px-4 rounded text-sm font-medium transition-colors"
        >
          <PlusCircle className="h-4 w-4" />
          Nueva sesión
        </button>
      </div>

      {/* Loading */}
      {loading && <TableSkeleton />}

      {/* Error */}
      {!loading && error && (
        <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
          <div className="rounded-full bg-red-50 p-4">
            <AlertCircle className="h-8 w-8 text-red-400" />
          </div>
          <div>
            <h2 className="text-lg font-medium text-gray-900 mb-1">
              Error al cargar sesiones
            </h2>
            <p className="text-sm text-gray-500 max-w-sm">{error}</p>
          </div>
          <button
            onClick={() => fetchSessions(page)}
            className="text-sm text-terra-700 hover:text-terra-900 font-medium underline underline-offset-2 transition-colors"
          >
            Reintentar
          </button>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && data && data.total === 0 && (
        <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
          <div className="rounded-full bg-terra-50 p-4">
            <CalendarPlus className="h-8 w-8 text-terra-400" />
          </div>
          <div>
            <h2 className="text-lg font-medium text-gray-900 mb-1">
              No hay sesiones registradas
            </h2>
            <p className="text-sm text-gray-500 max-w-sm">
              Consulta las sesiones desde la ficha de cada clienta o crea una nueva sesión.
            </p>
          </div>
        </div>
      )}

      {/* Table */}
      {!loading && !error && data && data.total > 0 && (
        <>
          <div className="bg-white rounded-lg shadow-[0_2px_8px_rgba(44,34,32,0.06)] overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-[#FAF7F5] border-b border-[#D4A592]">
                  {["Paciente", "Terapia", "Fecha", "Costo"].map((h) => (
                    <th
                      key={h}
                      className="text-left text-xs uppercase tracking-wide text-[#4A3628] font-normal px-4 py-3"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.data.map((s) => (
                  <tr
                    key={s.id}
                    onClick={() => router.push(`/clinica/sesiones/${s.id}`)}
                    className="text-sm text-[#2C2220] border-b border-[#F2E8E4] hover:bg-[#FAF7F5] cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 font-medium">
                      {s.client_name ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      {s.therapy_type_name ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      {formatDate(s.measured_at)}
                    </td>
                    <td className="px-4 py-3 text-[#C4704A] font-medium">
                      {s.cost != null ? formatCurrency(s.cost) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-center gap-4">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="flex items-center gap-1 text-sm text-terra-700 hover:text-terra-900 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </button>
            <span className="text-xs text-gray-400">
              Página {page} de {totalPages}
            </span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="flex items-center gap-1 text-sm text-terra-700 hover:text-terra-900 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
