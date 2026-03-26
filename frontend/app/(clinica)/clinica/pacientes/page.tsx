"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Search, ChevronLeft, ChevronRight, UserSearch, UserPlus, Trash2, AlertCircle, RefreshCw } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { useAuthStore } from "@/store/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Client, PaginatedResponse } from "@/types/api";

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
  // Refs para debounce y cancelación de requests en vuelo
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

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

      {/* Búsqueda */}
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
            <tr className="bg-terra-50 text-terra-600 text-xs uppercase tracking-wider">
              <th className="px-5 py-3 text-left font-medium">Nombre</th>
              <th className="px-5 py-3 text-left font-medium hidden sm:table-cell">Email</th>
              <th className="px-5 py-3 text-left font-medium hidden md:table-cell">Teléfono</th>
              <th className="px-5 py-3 text-left font-medium hidden md:table-cell">Profesión</th>
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
                        <p className="text-sm font-medium text-gray-700">No se encontraron pacientes</p>
                        <p className="text-sm text-muted-foreground">Intenta con otro término de búsqueda</p>
                      </>
                    ) : (
                      <>
                        <div className="rounded-full bg-terra-50 p-3">
                          <UserPlus className="h-6 w-6 text-terra-400" />
                        </div>
                        <p className="text-sm font-medium text-gray-700">No hay pacientes registrados</p>
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
              clients.map((client) => (
                <tr
                  key={client.id}
                  onClick={() => router.push(`/clinica/pacientes/${client.id}`)}
                  className="border-b border-terra-100/40 cursor-pointer hover:bg-terra-50/40 transition-colors duration-150 text-terra-800"
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
