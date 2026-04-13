"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  UserPlus,
  UserCog,
  CalendarDays,
  PlusCircle,
  Shield,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/lib/stores/uiStore";
import { useAuthStore } from "@/store/auth";

const navItems = [
  { href: "/clinica",               label: "Dashboard",      icon: LayoutDashboard, exact: true,  adminOnly: false },
  { href: "/clinica/pacientes",     label: "Pacientes",      icon: Users,           exact: false, adminOnly: false },
  { href: "/clinica/pacientes/nuevo", label: "Nuevo paciente", icon: UserPlus,      exact: true,  adminOnly: false },
  { href: "/clinica/sesiones",      label: "Sesiones",       icon: CalendarDays,    exact: true,  adminOnly: false },
  { href: "/clinica/sesiones/nueva", label: "Nueva sesión",  icon: PlusCircle,      exact: false, adminOnly: false },
  { href: "/clinica/seguridad",     label: "Seguridad",      icon: Shield,          exact: true,  adminOnly: true  },
  { href: "/clinica/usuarios",     label: "Usuarios",       icon: UserCog,         exact: true,  adminOnly: true  },
];

export function SidebarNav() {
  const pathname = usePathname();
  const { sidebarCollapsed, toggleSidebar, setSidebarCollapsed } = useUiStore();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';
  const visibleItems = navItems.filter((item) => !item.adminOnly || isAdmin);

  // Responsive: colapsar automáticamente en pantallas < 1024px
  useEffect(() => {
    if (window.innerWidth < 1024) {
      setSidebarCollapsed(true);
    }
  }, [setSidebarCollapsed]);

  return (
    <aside
      className={cn(
        "bg-terra-50 border-r border-terra-100 flex flex-col shrink-0 overflow-hidden",
        "transition-all duration-300 ease-in-out",
        sidebarCollapsed ? "w-16" : "w-64",
      )}
    >
      {/* ── Logo ──────────────────────────────────────────────────────────── */}
      <Link
        href="/clinica"
        className={cn(
          "flex items-center border-b border-terra-100 shrink-0 justify-center",
          sidebarCollapsed ? "pt-5 pb-4" : "pt-6 pb-4",
        )}
        title="Ir al dashboard"
      >
        <img
          src="/images/sdc-icon.png"
          alt="SDC"
          className="h-8 w-8 object-contain shrink-0"
        />
      </Link>

      {/* ── Nav items ─────────────────────────────────────────────────────── */}
      <nav className="flex-1 py-4 px-2 space-y-1" aria-label="Navegación principal">
        {visibleItems.map(({ href, label, icon: Icon, exact }) => {
          const isActive = exact
            ? pathname === href
            : pathname === href || pathname.startsWith(href + "/");

          return (
            <Link
              key={href}
              href={href}
              title={sidebarCollapsed ? label : undefined}
              className={cn(
                "flex items-center rounded-lg text-sm transition-colors duration-150",
                sidebarCollapsed
                  ? "justify-center p-2.5 mx-1"
                  : "gap-3 px-3 py-2 mx-2",
                "min-h-[44px]",
                isActive
                  ? "bg-[#C4704A]/10 text-[#2C2220] font-medium border-l-[3px] border-[#C4704A]"
                  : "text-[#4A3628] hover:bg-[#FAF7F5] hover:text-[#2C2220] font-normal border-l-[3px] border-transparent",
              )}
            >
              <Icon className="h-5 w-5 shrink-0" strokeWidth={1.5} />
              {!sidebarCollapsed && (
                <span className="truncate">{label}</span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* ── Botón toggle ──────────────────────────────────────────────────── */}
      <div className="border-t border-terra-100 flex justify-center p-2 shrink-0">
        <button
          type="button"
          onClick={toggleSidebar}
          title={sidebarCollapsed ? "Expandir menú" : "Colapsar menú"}
          aria-label={sidebarCollapsed ? "Expandir menú" : "Colapsar menú"}
          className="flex items-center justify-center rounded-lg p-2 min-h-[44px] min-w-[44px] text-terra-700/60 hover:bg-terra-50 hover:text-terra-700 transition-colors"
        >
          {sidebarCollapsed
            ? <PanelLeftOpen  className="h-5 w-5" />
            : <PanelLeftClose className="h-5 w-5" />
          }
        </button>
      </div>
    </aside>
  );
}
