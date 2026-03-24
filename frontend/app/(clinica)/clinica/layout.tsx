'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/auth';
import { getMe } from '@/lib/api/auth';
import { SidebarNav } from '@/components/layout/sidebar-nav';
import { TopBar } from '@/components/layout/top-bar';

export default function ClinicaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, accessToken, setAuth, logout } = useAuthStore();
  const [hydrating, setHydrating] = useState(!user);

  useEffect(() => {
    if (user) {
      setHydrating(false);
      return;
    }

    let cancelled = false;

    async function hydrate() {
      try {
        // After reload the Zustand store is empty (no persist).
        // getMe() without a token → 403 (not 401), so apiClient never refreshes.
        // Fix: call /auth/refresh first (uses HttpOnly cookie), then getMe().
        const refreshRes = await fetch('/api/v1/auth/refresh', {
          method: 'POST',
          credentials: 'include',
        });

        if (!refreshRes.ok) throw new Error('Refresh failed');

        const refreshData = (await refreshRes.json()) as { data: { access_token: string } };
        const newToken = refreshData.data.access_token;

        if (!newToken) throw new Error('No token in refresh response');

        useAuthStore.getState().setAccessToken(newToken);

        const me = await getMe();
        if (!cancelled) {
          setAuth(me, newToken);
          setHydrating(false);
        }
      } catch {
        if (!cancelled) {
          logout();
          window.location.href = '/login';
        }
      }
    }

    hydrate();
    return () => { cancelled = true; };
  }, [user, accessToken, setAuth, logout]);

  if (hydrating) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#FAF7F5]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-[#D4A592] border-t-[#C4704A]" />
          <p className="text-sm text-[#4A3628]">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#FAF7F5]">
      <SidebarNav />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
