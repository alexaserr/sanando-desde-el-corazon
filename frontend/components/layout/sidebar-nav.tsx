"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  UserPlus,
  CalendarDays,
  PlusCircle,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/lib/stores/uiStore";

const navItems = [
  { href: "/clinica",               label: "Dashboard",      icon: LayoutDashboard, exact: true  },
  { href: "/clinica/pacientes",     label: "Clientes",       icon: Users,           exact: false },
  { href: "/clinica/pacientes/nuevo", label: "Nuevo paciente", icon: UserPlus,      exact: true  },
  { href: "/clinica/sesiones",      label: "Sesiones",       icon: CalendarDays,    exact: true  },
  { href: "/clinica/sesiones/nueva", label: "Nueva sesión",  icon: PlusCircle,      exact: false },
];

export function SidebarNav() {
  const pathname = usePathname();
  const { sidebarCollapsed, toggleSidebar, setSidebarCollapsed } = useUiStore();

  // Responsive: colapsar automáticamente en pantallas < 1024px
  useEffect(() => {
    if (window.innerWidth < 1024) {
      setSidebarCollapsed(true);
    }
  }, [setSidebarCollapsed]);

  return (
    <aside
      className={cn(
        "bg-white border-r border-terra-100 flex flex-col shrink-0 overflow-hidden",
        "transition-all duration-300 ease-in-out",
        sidebarCollapsed ? "w-16" : "w-64",
      )}
    >
      {/* ── Logo ──────────────────────────────────────────────────────────── */}
      <div
        className={cn(
          "flex items-center border-b border-terra-100 shrink-0",
          sidebarCollapsed ? "justify-center pt-5 pb-4" : "gap-2 px-6 pt-6 pb-4",
        )}
      >
        <img
          src="/images/sdc-icon.png"
          alt="SDC"
          className="h-8 w-8 object-contain shrink-0"
        />
        {!sidebarCollapsed && (
          <span className="font-display font-semibold text-sm leading-tight text-terra-900 whitespace-nowrap">
            Sanando desde
            <br />
            el Corazón
          </span>
        )}
      </div>

      {/* ── Nav items ─────────────────────────────────────────────────────── */}
      <nav className="flex-1 py-4 px-2 space-y-1" aria-label="Navegación principal">
        {navItems.map(({ href, label, icon: Icon, exact }) => {
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
                  ? "bg-terra-100 text-terra-900 font-medium"
                  : "text-terra-600 hover:bg-terra-50 hover:text-terra-800 font-normal",
              )}
            >
              <Icon className="h-5 w-5 shrink-0" />
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
