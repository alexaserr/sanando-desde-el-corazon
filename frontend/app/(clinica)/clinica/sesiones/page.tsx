"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { PlusCircle, ChevronLeft, ChevronRight, AlertCircle, CalendarPlus, Trash2, Sparkles, Copy, X } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { useAuthStore } from "@/store/auth";
import { formatDate, formatCurrency } from "@/lib/utils/formatters";
import { getTherapyTypes } from "@/lib/api/clinical";
import { SortableHeader, toggleSort } from "@/components/ui/sortable-header";
import type { SortConfig } from "@/components/ui/sortable-header";
import type { SessionListItem, TherapyType } from "@/types/api";

interface SessionsResponse {
  data: SessionListItem[];
  total: number;
  page: number;
  per_page: number;
}

const PER_PAGE = 20;

// ─── Duplicate sessions types ───────────────────────────────────────────────

interface DuplicateSession {
  id: string;
  measured_at: string;
  client_name: string | null;
  therapy_type_name: string | null;
  sub_resource_count: number;
}

interface DuplicateGroup {
  client_id: string;
  client_name: string;
  therapy_type: string;
  measured_at: string;
  sessions: DuplicateSession[];
}

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
  const { user } = useAuthStore();
  const isAdmin = user?.role === "admin";
  const [page, setPage] = useState(1);
  const [data, setData] = useState<SessionsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cleaningEmpty, setCleaningEmpty] = useState(false);
  // Duplicates
  const [duplicateGroups, setDuplicateGroups] = useState<DuplicateGroup[]>([]);
  const [duplicateModalOpen, setDuplicateModalOpen] = useState(false);
  const [loadingDuplicates, setLoadingDuplicates] = useState(false);
  const [selectedKeep, setSelectedKeep] = useState<Record<number, string>>({});
  const [deletingDuplicates, setDeletingDuplicates] = useState(false);
  // Sort & filters
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [filterTherapyType, setFilterTherapyType] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [therapyTypes, setTherapyTypes] = useState<TherapyType[]>([]);

  async function handleCleanEmptySessions() {
    if (cleaningEmpty) return;
    setCleaningEmpty(true);
    try {
      const list = await apiClient.get<{ data: unknown[]; total: number }>(
        "/api/v1/admin/sessions/empty",
      );
      if (list.total === 0) {
        window.alert("No hay sesiones vacías para eliminar.");
        return;
      }
      const confirmed = window.confirm(
        `Se eliminarán ${list.total} sesiones vacías. ¿Continuar?`,
      );
      if (!confirmed) return;
      const result = await apiClient.delete<{ deleted_count: number }>(
        "/api/v1/admin/sessions/empty",
      );
      window.alert(`Se eliminaron ${result.deleted_count} sesiones vacías.`);
      fetchSessions(page);
    } catch (err) {
      console.error("Clean empty sessions failed:", err);
      window.alert(
        err instanceof Error ? err.message : "Error al limpiar sesiones vacías",
      );
    } finally {
      setCleaningEmpty(false);
    }
  }

  async function handleDeleteSession(e: React.MouseEvent, sessionId: string) {
    e.stopPropagation();
    const confirmed = window.confirm(
      "¿Estás seguro de que deseas eliminar esta sesión? Esta acción no se puede deshacer.",
    );
    if (!confirmed) return;
    try {
      await apiClient.delete(`/api/v1/clinical/sessions/${sessionId}`);
      fetchSessions(page);
    } catch (err) {
      console.error("Delete session failed:", err);
    }
  }

  async function handleFindDuplicates() {
    setLoadingDuplicates(true);
    try {
      const response = await apiClient.get<{ data: DuplicateGroup[]; total_groups: number }>(
        "/api/v1/admin/sessions/duplicates",
      );
      const groups = response.data;
      if (groups.length === 0) {
        window.alert("No se encontraron sesiones duplicadas.");
        return;
      }
      setDuplicateGroups(groups);
      // Pre-select the session with highest sub_resource_count in each group
      const initial: Record<number, string> = {};
      groups.forEach((g, idx) => {
        const best = g.sessions.reduce((a, b) =>
          b.sub_resource_count > a.sub_resource_count ? b : a,
        );
        initial[idx] = best.id;
      });
      setSelectedKeep(initial);
      setDuplicateModalOpen(true);
    } catch (err) {
      console.error("Find duplicates failed:", err);
      window.alert(
        err instanceof Error ? err.message : "Error al buscar duplicadas",
      );
    } finally {
      setLoadingDuplicates(false);
    }
  }

  async function handleDeleteDuplicates() {
    setDeletingDuplicates(true);
    try {
      const toDelete: string[] = [];
      duplicateGroups.forEach((g, idx) => {
        const keepId = selectedKeep[idx];
        for (const s of g.sessions) {
          if (s.id !== keepId) toDelete.push(s.id);
        }
      });
      for (const id of toDelete) {
        await apiClient.delete(`/api/v1/clinical/sessions/${id}`);
      }
      window.alert(`Se eliminaron ${toDelete.length} sesiones duplicadas.`);
      setDuplicateModalOpen(false);
      setDuplicateGroups([]);
      fetchSessions(page);
    } catch (err) {
      console.error("Delete duplicates failed:", err);
      window.alert(
        err instanceof Error ? err.message : "Error al eliminar duplicadas",
      );
    } finally {
      setDeletingDuplicates(false);
    }
  }

  useEffect(() => {
    getTherapyTypes().then(setTherapyTypes).catch(() => {});
  }, []);

  const handleSort = (key: string) => {
    setSortConfig((prev) => toggleSort(prev, key));
  };

  const filteredAndSorted = useMemo(() => {
    if (!data) return [];
    let items = [...data.data];

    // Apply filters
    if (filterDateFrom) {
      items = items.filter((s) => s.measured_at >= filterDateFrom);
    }
    if (filterDateTo) {
      items = items.filter((s) => s.measured_at.slice(0, 10) <= filterDateTo);
    }
    if (filterTherapyType) {
      items = items.filter((s) => s.therapy_type_name === filterTherapyType);
    }
    if (filterStatus) {
      items = items.filter((s) => s.status === filterStatus);
    }

    // Apply sort
    if (sortConfig) {
      const { key, dir } = sortConfig;
      items.sort((a, b) => {
        let aVal: string | number | null;
        let bVal: string | number | null;
        if (key === "measured_at") {
          aVal = a.measured_at;
          bVal = b.measured_at;
        } else if (key === "client_name") {
          aVal = a.client_name;
          bVal = b.client_name;
        } else if (key === "therapy_type_name") {
          aVal = a.therapy_type_name;
          bVal = b.therapy_type_name;
        } else if (key === "status") {
          aVal = a.status ?? "";
          bVal = b.status ?? "";
        } else {
          aVal = "";
          bVal = "";
        }
        const cmp = String(aVal ?? "").localeCompare(String(bVal ?? ""), "es-MX");
        return dir === "asc" ? cmp : -cmp;
      });
    }

    return items;
  }, [data, sortConfig, filterDateFrom, filterDateTo, filterTherapyType, filterStatus]);

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
        <div className="flex items-center gap-2">
          {isAdmin && (
            <>
              <button
                onClick={handleFindDuplicates}
                disabled={loadingDuplicates}
                className="flex items-center gap-2 bg-white border border-terra-700 text-terra-700 hover:bg-terra-50 disabled:opacity-50 disabled:cursor-not-allowed h-10 px-4 rounded text-sm font-medium transition-colors"
                title="Buscar sesiones duplicadas por paciente, tipo y fecha"
              >
                <Copy className="h-4 w-4" />
                {loadingDuplicates ? "Buscando..." : "Buscar duplicadas"}
              </button>
              <button
                onClick={handleCleanEmptySessions}
                disabled={cleaningEmpty}
                className="flex items-center gap-2 bg-white border border-terra-700 text-terra-700 hover:bg-terra-50 disabled:opacity-50 disabled:cursor-not-allowed h-10 px-4 rounded text-sm font-medium transition-colors"
                title="Eliminar sesiones creadas sin datos capturados"
              >
                <Sparkles className="h-4 w-4" />
                {cleaningEmpty ? "Limpiando..." : "Limpiar sesiones vacias"}
              </button>
            </>
          )}
          <button
            onClick={() => router.push("/clinica/sesiones/nueva")}
            className="flex items-center gap-2 bg-terra-700 hover:bg-terra-500 text-white h-10 px-4 rounded text-sm font-medium transition-colors"
          >
            <PlusCircle className="h-4 w-4" />
            Nueva sesión
          </button>
        </div>
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

      {/* Filters */}
      {!loading && !error && data && data.total > 0 && (
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs uppercase tracking-wide text-[#4A3628] mb-1">Desde</label>
            <input
              type="date"
              value={filterDateFrom}
              onChange={(e) => setFilterDateFrom(e.target.value)}
              className="h-9 px-3 rounded border border-terra-200 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[#C4704A]"
            />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wide text-[#4A3628] mb-1">Hasta</label>
            <input
              type="date"
              value={filterDateTo}
              onChange={(e) => setFilterDateTo(e.target.value)}
              className="h-9 px-3 rounded border border-terra-200 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[#C4704A]"
            />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wide text-[#4A3628] mb-1">Tipo de terapia</label>
            <select
              value={filterTherapyType}
              onChange={(e) => setFilterTherapyType(e.target.value)}
              className="h-9 px-3 rounded border border-terra-200 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[#C4704A]"
            >
              <option value="">Todas</option>
              {therapyTypes.map((tt) => (
                <option key={tt.id} value={tt.name}>{tt.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wide text-[#4A3628] mb-1">Estado</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="h-9 px-3 rounded border border-terra-200 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-[#C4704A]"
            >
              <option value="">Todas</option>
              <option value="completed">Completada</option>
              <option value="in_progress">En progreso</option>
            </select>
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
                  <SortableHeader label="Fecha" sortKey="measured_at" currentSort={sortConfig} onSort={handleSort} />
                  <SortableHeader label="Paciente" sortKey="client_name" currentSort={sortConfig} onSort={handleSort} />
                  <SortableHeader label="Terapia" sortKey="therapy_type_name" currentSort={sortConfig} onSort={handleSort} />
                  <SortableHeader label="Estado" sortKey="status" currentSort={sortConfig} onSort={handleSort} />
                  <th className="text-left text-xs uppercase tracking-wide text-[#4A3628] font-normal px-4 py-3" style={{ letterSpacing: "0.1em" }}>
                    Costo
                  </th>
                  {isAdmin && <th className="w-10" />}
                </tr>
              </thead>
              <tbody>
                {filteredAndSorted.map((s, idx) => (
                  <tr
                    key={s.id}
                    onClick={() => router.push(`/clinica/sesiones/${s.id}`)}
                    className={`text-sm text-[#2C2220] border-b border-[#F2E8E4] hover:bg-[#FAF7F5] cursor-pointer transition-colors ${idx % 2 === 1 ? "bg-[#F2E8E4]" : "bg-[#FAF7F5]"}`}
                  >
                    <td className="px-4 py-3">
                      {formatDate(s.measured_at)}
                    </td>
                    <td className="px-4 py-3 font-medium">
                      {s.client_name ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      {s.therapy_type_name ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      {s.status === "completed" ? "Completada" : s.status === "in_progress" ? "En progreso" : "—"}
                    </td>
                    <td className="px-4 py-3 text-[#C4704A] font-medium">
                      {s.cost != null ? formatCurrency(s.cost) : "—"}
                    </td>
                    {isAdmin && (
                      <td className="px-2 py-3">
                        <button
                          onClick={(e) => handleDeleteSession(e, s.id)}
                          className="p-1.5 rounded text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="Eliminar sesión"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    )}
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

      {/* Duplicates Modal */}
      {duplicateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#2C2220]/50">
          <div className="bg-[#FAF7F5] rounded-lg shadow-xl max-w-3xl w-full mx-4 max-h-[80vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#D4A592]">
              <h2 className="font-display text-lg font-semibold text-[#2C2220]">
                Sesiones Duplicadas ({duplicateGroups.length} grupos)
              </h2>
              <button
                onClick={() => setDuplicateModalOpen(false)}
                className="p-1.5 rounded hover:bg-terra-100 transition-colors"
              >
                <X className="h-5 w-5 text-[#4A3628]" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
              {duplicateGroups.map((group, gIdx) => (
                <div
                  key={gIdx}
                  className="border border-[#D4A592] rounded-lg p-4 bg-white"
                >
                  <div className="mb-3">
                    <p className="text-sm font-medium text-[#2C2220]">
                      {group.client_name} &middot; {group.therapy_type}
                    </p>
                    <p className="text-xs text-[#4A3628]/60">
                      {formatDate(group.measured_at)}
                    </p>
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-[#4A3628] uppercase tracking-wide">
                        <th className="text-left py-1 pr-2">Conservar</th>
                        <th className="text-left py-1 pr-2">ID</th>
                        <th className="text-left py-1 pr-2">Recursos</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.sessions.map((s) => (
                        <tr key={s.id} className="border-t border-[#F2E8E4]">
                          <td className="py-2 pr-2">
                            <input
                              type="radio"
                              name={`dup-group-${gIdx}`}
                              checked={selectedKeep[gIdx] === s.id}
                              onChange={() =>
                                setSelectedKeep((prev) => ({
                                  ...prev,
                                  [gIdx]: s.id,
                                }))
                              }
                              className="accent-[#C4704A]"
                            />
                          </td>
                          <td className="py-2 pr-2 font-mono text-xs text-[#4A3628]">
                            {s.id.slice(0, 8)}...
                          </td>
                          <td className="py-2 pr-2 text-[#2C2220]">
                            {s.sub_resource_count} sub-recursos
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#D4A592]">
              <button
                onClick={() => setDuplicateModalOpen(false)}
                className="h-9 px-4 rounded text-sm font-medium text-[#4A3628] hover:bg-terra-100 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteDuplicates}
                disabled={deletingDuplicates}
                className="h-9 px-4 rounded text-sm font-medium bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {deletingDuplicates ? "Eliminando..." : "Eliminar duplicadas"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
