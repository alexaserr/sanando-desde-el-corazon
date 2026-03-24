'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import { getMe } from '@/lib/api/auth';
import { SidebarNav } from '@/components/layout/sidebar-nav';
import { TopBar } from '@/components/layout/top-bar';

export default function ClinicaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
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
        // getMe() will 401 → apiClient refreshes via HttpOnly cookie → retries
        const me = await getMe();
        if (!cancelled) {
          // accessToken was updated by the refresh flow inside apiClient
          const token = useAuthStore.getState().accessToken ?? '';
          setAuth(me, token);
          setHydrating(false);
        }
      } catch {
        // Refresh failed — no valid session
        if (!cancelled) {
          logout();
          router.replace('/login');
        }
      }
    }

    hydrate();
    return () => { cancelled = true; };
  }, [user, accessToken, setAuth, logout, router]);

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
