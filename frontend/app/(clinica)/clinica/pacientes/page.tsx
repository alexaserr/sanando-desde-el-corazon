"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Client, PaginatedResponse } from "@/types/api";

const PAGE_SIZE = 20;

function SkeletonRow() {
  return (
    <tr className="border-b">
      {[1, 2, 3, 4].map((i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 bg-terra-200 rounded animate-pulse" />
        </td>
      ))}
    </tr>
  );
}

export default function PacientesPage() {
  const router = useRouter();
  const [clients, setClients] = useState<Client[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isFirstRender = useRef(true);

  // Debounce: actualiza query 400ms después de que el usuario deja de escribir
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const timer = setTimeout(() => {
      setPage(1);
      setQuery(search);
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchClients = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        size: String(PAGE_SIZE),
      });
      if (query) params.set("search", query);

      const data = await apiClient.get<PaginatedResponse<Client>>(
        `/api/v1/clinical/clients?${params.toString()}`,
      );
      setClients(data.items);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar los clientes.");
    } finally {
      setLoading(false);
    }
  }, [page, query]);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setQuery(search);
  };

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
          onChange={(e) => setSearch(e.target.value)}
        />
        <Button type="submit" variant="outline" size="icon" aria-label="Buscar">
          <Search className="h-4 w-4" />
        </Button>
      </form>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* Tabla */}
      <div className="rounded-xl border border-terra-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-terra-50 text-terra-600 text-xs uppercase tracking-wider">
              <th className="px-5 py-3 text-left font-medium">Nombre</th>
              <th className="px-5 py-3 text-left font-medium hidden sm:table-cell">Email</th>
              <th className="px-5 py-3 text-left font-medium hidden md:table-cell">Teléfono</th>
              <th className="px-5 py-3 text-left font-medium hidden md:table-cell">Profesión</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)
            ) : clients.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-5 py-12 text-center text-muted-foreground">
                  {query
                    ? `No se encontraron resultados para "${query}"`
                    : "No hay clientes registrados aún."}
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
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
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
