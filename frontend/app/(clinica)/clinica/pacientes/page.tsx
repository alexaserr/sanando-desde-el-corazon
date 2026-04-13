"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Search, ChevronLeft, ChevronRight, UserSearch, UserPlus, Trash2, AlertCircle, RefreshCw, Users, X, Loader2 } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { useAuthStore } from "@/store/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SortableHeader, toggleSort } from "@/components/ui/sortable-header";
import type { SortConfig } from "@/components/ui/sortable-header";
import type { Client, PaginatedResponse } from "@/types/api";

interface DuplicateCandidate {
  id: string;
  full_name: string;
  email: string | null;
  sessions_count: number;
  created_at: string;
}

interface DuplicateGroup {
  name: string;
  clients: DuplicateCandidate[];
}

const PAGE_SIZE = 20;

function SkeletonRow() {
  return (
    <tr className="border-b">
      {[1, 2, 3, 4].map((i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 bg-terra-100 rounded animate-pulse" />
        </td>
      ))}
    </tr>
  );
}

export default function PacientesPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const isAdmin = user?.role === "admin";
  const [clients, setClients] = useState<Client[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);
  // Duplicados (admin-only)
  const [dupOpen, setDupOpen] = useState(false);
  const [dupLoading, setDupLoading] = useState(false);
  const [dupError, setDupError] = useState<string | null>(null);
  const [dupGroups, setDupGroups] = useState<DuplicateGroup[]>([]);
  const [mergingId, setMergingId] = useState<string | null>(null);
  // Refs para debounce y cancelación de requests en vuelo
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const sortedClients = useMemo(() => {
    if (!sortConfig) return clients;
    const { key, dir } = sortConfig;
    return [...clients].sort((a, b) => {
      const aVal = (a[key as keyof Client] as string | null) ?? "";
      const bVal = (b[key as keyof Client] as string | null) ?? "";
      const cmp = String(aVal).localeCompare(String(bVal), "es-MX");
      return dir === "asc" ? cmp : -cmp;
    });
  }, [clients, sortConfig]);

  const handleSort = (key: string) => {
    setSortConfig((prev) => toggleSort(prev, key));
  };

  const fetchClients = useCallback(async (searchQuery: string, pageNum: number) => {
    // Cancelar request anterior si sigue en vuelo
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(pageNum),
        per_page: String(PAGE_SIZE),
      });
      if (searchQuery) params.set("search", searchQuery);

      const data = await apiClient.get<PaginatedResponse<Client>>(
        `/api/v1/clinical/clients?${params.toString()}`,
        { signal: controller.signal },
      );
      setClients(data.items);
      setTotal(data.total);
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Error al cargar los clientes.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Carga inicial
  useEffect(() => {
    fetchClients("", 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Limpiar recursos al desmontar
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearch(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setQuery(val);
      setPage(1);
      fetchClients(val, 1);
    }, 400);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setQuery(search);
    setPage(1);
    fetchClients(search, 1);
  };

  const fetchDuplicates = useCallback(async () => {
    setDupLoading(true);
    setDupError(null);
    try {
      const data = await apiClient.get<{ groups: DuplicateGroup[] }>(
        "/api/v1/admin/clients/duplicates",
      );
      setDupGroups(data.groups);
    } catch (err) {
      setDupError(err instanceof Error ? err.message : "Error al buscar duplicados.");
    } finally {
      setDupLoading(false);
    }
  }, []);

  const openDuplicates = () => {
    setDupOpen(true);
    fetchDuplicates();
  };

  const handleMerge = async (
    group: DuplicateGroup,
    primary: DuplicateCandidate,
    duplicate: DuplicateCandidate,
  ) => {
    const confirmed = window.confirm(
      `Se moverán ${duplicate.sessions_count} sesiones de "${duplicate.full_name}" a "${primary.full_name}". El duplicado será archivado. ¿Continuar?`,
    );
    if (!confirmed) return;
    setMergingId(duplicate.id);
    try {
      await apiClient.post("/api/v1/admin/clients/merge", {
        primary_id: primary.id,
        duplicate_id: duplicate.id,
      });
      await fetchDuplicates();
      fetchClients(query, page);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Error al unir clientes.");
    } finally {
      setMergingId(null);
    }
  };

  async function handleDeleteClient(e: React.MouseEvent, clientId: string) {
    e.stopPropagation();
    const confirmed = window.confirm(
      "¿Estás seguro de que deseas eliminar a este paciente y todo su historial? Esta acción no se puede deshacer.",
    );
    if (!confirmed) return;
    try {
      await apiClient.delete(`/api/v1/clinical/clients/${clientId}`);
      fetchClients(query, page);
    } catch (err) {
      console.error("Delete client failed:", err);
    }
  }

  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-terra-900">Clientes</h1>
        <p className="text-muted-foreground">Gestión de expedientes clínicos</p>
      </div>

      {/* Búsqueda + acciones admin */}
      <div className="flex flex-wrap items-center gap-3">
        <form onSubmit={handleSearch} className="flex gap-2 max-w-sm">
          <Input
            placeholder="Buscar por nombre..."
            value={search}
            onChange={handleSearchChange}
          />
          <Button type="submit" variant="outline" size="icon" aria-label="Buscar">
            <Search className="h-4 w-4" />
          </Button>
        </form>
        {isAdmin && (
          <Button type="button" variant="outline" onClick={openDuplicates}>
            <Users className="h-4 w-4 mr-2" />
            Buscar duplicados
          </Button>
        )}
      </div>

      {error && (
        <div className="border-l-4 border-red-400 bg-red-50 rounded-r-xl p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-800">Error al cargar los datos</p>
            <p className="text-sm text-red-600 mt-0.5">{error}</p>
          </div>
          <button
            onClick={() => fetchClients(query, page)}
            className="flex items-center gap-1.5 text-sm font-medium text-red-700 hover:text-red-900 transition-colors shrink-0"
          >
            <RefreshCw className="h-4 w-4" />
            Reintentar
          </button>
        </div>
      )}

      {/* Tabla */}
      <div className="rounded-xl border border-terra-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#FAF7F5] border-b border-terra-100">
              <SortableHeader label="Nombre" sortKey="full_name" currentSort={sortConfig} onSort={handleSort} />
              <SortableHeader label="Email" sortKey="email" currentSort={sortConfig} onSort={handleSort} className="hidden sm:table-cell" />
              <SortableHeader label="Teléfono" sortKey="phone" currentSort={sortConfig} onSort={handleSort} className="hidden md:table-cell" />
              <SortableHeader label="Profesión" sortKey="profession" currentSort={sortConfig} onSort={handleSort} className="hidden md:table-cell" />
              {isAdmin && <th className="w-10" />}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)
            ) : clients.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-5 py-16 text-center">
                  <div className="flex flex-col items-center gap-3">
                    {query ? (
                      <>
                        <div className="rounded-full bg-terra-50 p-3">
                          <UserSearch className="h-6 w-6 text-terra-400" />
                        </div>
                        <p className="text-sm font-medium text-terra-800">No se encontraron pacientes</p>
                        <p className="text-sm text-muted-foreground">Intenta con otro término de búsqueda</p>
                      </>
                    ) : (
                      <>
                        <div className="rounded-full bg-terra-50 p-3">
                          <UserPlus className="h-6 w-6 text-terra-400" />
                        </div>
                        <p className="text-sm font-medium text-terra-800">No hay pacientes registrados</p>
                        <a
                          href="/clinica/pacientes/nuevo"
                          className="text-sm text-terra-700 hover:text-terra-900 font-medium underline underline-offset-2 transition-colors"
                        >
                          Registrar nuevo paciente
                        </a>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              sortedClients.map((client, idx) => (
                <tr
                  key={client.id}
                  onClick={() => router.push(`/clinica/pacientes/${client.id}`)}
                  className={`border-b border-terra-100/40 cursor-pointer hover:bg-terra-50/40 transition-colors duration-150 text-terra-800 ${idx % 2 === 1 ? "bg-[#F2E8E4]" : "bg-[#FAF7F5]"}`}
                >
                  <td className="px-5 py-4 font-medium">{client.full_name}</td>
                  <td className="px-5 py-4 text-terra-500 hidden sm:table-cell">
                    {client.email ?? "—"}
                  </td>
                  <td className="px-5 py-4 text-terra-500 hidden md:table-cell">
                    {client.phone ?? "—"}
                  </td>
                  <td className="px-5 py-4 text-terra-500 hidden md:table-cell">
                    {client.profession ?? "—"}
                  </td>
                  {isAdmin && (
                    <td className="px-2 py-4">
                      <button
                        onClick={(e) => handleDeleteClient(e, client.id)}
                        className="p-1.5 rounded text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        title="Eliminar paciente"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal: duplicados */}
      {dupOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-terra-50 rounded-xl shadow-xl w-full max-w-3xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-terra-100 px-5 py-4">
              <div>
                <h2 className="font-display text-lg font-semibold text-terra-900">
                  Posibles duplicados
                </h2>
                <p className="text-xs text-muted-foreground">
                  Agrupados por nombre normalizado. El principal conservará el expediente.
                </p>
              </div>
              <button
                onClick={() => setDupOpen(false)}
                className="p-1.5 rounded text-terra-500 hover:bg-terra-50"
                aria-label="Cerrar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
              {dupLoading ? (
                <div className="flex items-center justify-center py-12 text-terra-500">
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  Buscando duplicados...
                </div>
              ) : dupError ? (
                <div className="border-l-4 border-red-400 bg-red-50 rounded-r-xl p-4 text-sm text-red-700">
                  {dupError}
                </div>
              ) : dupGroups.length === 0 ? (
                <div className="text-center py-12 text-sm text-muted-foreground">
                  No se encontraron clientes con nombres duplicados.
                </div>
              ) : (
                dupGroups.map((group) => {
                  // El primario sugerido: el que tiene más sesiones (desempate por antigüedad)
                  const sorted = [...group.clients].sort(
                    (a, b) =>
                      b.sessions_count - a.sessions_count ||
                      new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
                  );
                  const primary = sorted[0];
                  const duplicates = sorted.slice(1);
                  return (
                    <div
                      key={group.name + primary.id}
                      className="border border-terra-100 rounded-lg overflow-hidden"
                    >
                      <div className="bg-terra-50 px-4 py-2 text-sm font-semibold text-terra-800">
                        {group.name}
                      </div>
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-xs uppercase text-terra-500">
                            <th className="text-left px-4 py-2 font-medium">Email</th>
                            <th className="text-left px-4 py-2 font-medium">Sesiones</th>
                            <th className="text-left px-4 py-2 font-medium">Creado</th>
                            <th className="text-right px-4 py-2 font-medium w-40">Acción</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="border-t border-terra-100 bg-green-50/50">
                            <td className="px-4 py-3">{primary.email ?? "—"}</td>
                            <td className="px-4 py-3">{primary.sessions_count}</td>
                            <td className="px-4 py-3">
                              {new Date(primary.created_at).toLocaleDateString("es-MX")}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span className="text-xs font-medium text-green-700">
                                Principal
                              </span>
                            </td>
                          </tr>
                          {duplicates.map((dup) => (
                            <tr key={dup.id} className="border-t border-terra-100">
                              <td className="px-4 py-3">{dup.email ?? "—"}</td>
                              <td className="px-4 py-3">{dup.sessions_count}</td>
                              <td className="px-4 py-3">
                                {new Date(dup.created_at).toLocaleDateString("es-MX")}
                              </td>
                              <td className="px-4 py-3 text-right">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  disabled={mergingId !== null}
                                  onClick={() => handleMerge(group, primary, dup)}
                                >
                                  {mergingId === dup.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    "Unir al principal"
                                  )}
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Paginación */}
      {!loading && total > 0 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Mostrando {from}–{to} de {total}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const prev = Math.max(1, page - 1);
                setPage(prev);
                fetchClients(query, prev);
              }}
              disabled={page === 1}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const next = Math.min(totalPages, page + 1);
                setPage(next);
                fetchClients(query, next);
              }}
              disabled={page >= totalPages}
            >
              Siguiente
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
