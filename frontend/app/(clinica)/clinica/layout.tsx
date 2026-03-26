'use client';

import { useEffect, useState, useRef } from 'react';
import { useAuthStore } from '@/store/auth';
import { getMe } from '@/lib/api/auth';
import { SidebarNav } from '@/components/layout/sidebar-nav';
import { TopBar } from '@/components/layout/top-bar';

export default function ClinicaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, setAuth } = useAuthStore();
  const [hydrating, setHydrating] = useState(!user);
  const [authFailed, setAuthFailed] = useState(false);
  const attempted = useRef(false);

  useEffect(() => {
    if (user || attempted.current) {
      setHydrating(false);
      return;
    }

    attempted.current = true;

    async function hydrate() {
      try {
        const refreshRes = await fetch('/api/v1/auth/refresh', {
          method: 'POST',
          credentials: 'include',
        });

        if (!refreshRes.ok) throw new Error('Refresh failed');

        const refreshData = (await refreshRes.json()) as { access_token: string };
        const newToken = refreshData.access_token;

        if (!newToken) throw new Error('No token');

        useAuthStore.getState().setAccessToken(newToken);

        const me = await getMe();
        setAuth(me, newToken);
        setHydrating(false);
      } catch {
        // Do NOT redirect — it causes an infinite loop because the cookie isn't cleared
        setHydrating(false);
        setAuthFailed(true);
      }
    }

    hydrate();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

  if (authFailed) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#FAF7F5]">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="h-16 w-16 rounded-full bg-[#C4704A]/10 flex items-center justify-center">
            <svg className="h-8 w-8 text-[#C4704A]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-[#2C2220]">Sesión expirada</h2>
            <p className="text-sm text-[#4A3628] mt-1">Tu sesión ha expirado. Inicia sesión de nuevo.</p>
          </div>
          <a
            href="/login?session=expired"
            className="inline-block bg-[#C4704A] text-white rounded-md px-6 py-2 text-sm font-medium hover:bg-[#A85C3A] transition-colors"
          >
            Iniciar sesión
          </a>
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
