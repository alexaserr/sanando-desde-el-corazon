"use client";

import { useState, useEffect } from "react";
import { apiClient } from "@/lib/api/client";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface TopClient {
  id: string;
  name: string;
  session_count: number;
}

export interface TherapyDistribution {
  therapy_type: string;
  count: number;
}

export interface MonthlyCount {
  month: string; // "2025-05"
  count: number;
}

export interface DashboardStats {
  sessions_this_month: number;
  sessions_last_month: number;
  sessions_delta_pct: number;
  revenue_this_month: number;
  revenue_last_month: number;
  new_clients_this_month: number;
  return_rate: number;
  top_clients: TopClient[];
  sessions_by_therapy: TherapyDistribution[];
  sessions_by_month: MonthlyCount[];
  cleanings_by_month: MonthlyCount[];
}

// ─── Mock data (while backend endpoint is not available) ────────────────────

const MOCK_STATS: DashboardStats = {
  sessions_this_month: 47,
  sessions_last_month: 39,
  sessions_delta_pct: 20.5,
  revenue_this_month: 68900,
  revenue_last_month: 55200,
  new_clients_this_month: 12,
  return_rate: 73.2,
  top_clients: [
    { id: "1", name: "Maria Garcia", session_count: 15 },
    { id: "2", name: "Laura Martinez", session_count: 12 },
    { id: "3", name: "Ana Lopez", session_count: 10 },
    { id: "4", name: "Carmen Hernandez", session_count: 9 },
    { id: "5", name: "Patricia Rodriguez", session_count: 8 },
    { id: "6", name: "Rosa Sanchez", session_count: 7 },
    { id: "7", name: "Elena Torres", session_count: 6 },
    { id: "8", name: "Isabel Ramirez", session_count: 5 },
    { id: "9", name: "Sofia Flores", session_count: 4 },
    { id: "10", name: "Daniela Cruz", session_count: 3 },
  ],
  sessions_by_therapy: [
    { therapy_type: "Sanacion Energetica", count: 18 },
    { therapy_type: "Limpieza Energetica", count: 12 },
    { therapy_type: "Medicina Cuantica", count: 8 },
    { therapy_type: "Terapia LNT", count: 5 },
    { therapy_type: "Recuperacion del Alma", count: 4 },
  ],
  sessions_by_month: [
    { month: "2025-05", count: 32 },
    { month: "2025-06", count: 38 },
    { month: "2025-07", count: 41 },
    { month: "2025-08", count: 35 },
    { month: "2025-09", count: 44 },
    { month: "2025-10", count: 39 },
    { month: "2025-11", count: 42 },
    { month: "2025-12", count: 36 },
    { month: "2026-01", count: 40 },
    { month: "2026-02", count: 45 },
    { month: "2026-03", count: 39 },
    { month: "2026-04", count: 47 },
  ],
  cleanings_by_month: [
    { month: "2025-05", count: 8 },
    { month: "2025-06", count: 11 },
    { month: "2025-07", count: 9 },
    { month: "2025-08", count: 13 },
    { month: "2025-09", count: 10 },
    { month: "2025-10", count: 14 },
    { month: "2025-11", count: 12 },
    { month: "2025-12", count: 8 },
    { month: "2026-01", count: 15 },
    { month: "2026-02", count: 11 },
    { month: "2026-03", count: 13 },
    { month: "2026-04", count: 16 },
  ],
};

// ─── Hook ───────────────────────────────────────────────────────────────────

export function useDashboardStats() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await apiClient.get<DashboardStats>(
          "/api/v1/admin/dashboard/stats",
        );
        if (!cancelled) setStats(data);
      } catch {
        // Fallback to mock data if endpoint not available
        if (!cancelled) setStats(MOCK_STATS);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  return { stats, loading, error };
}
