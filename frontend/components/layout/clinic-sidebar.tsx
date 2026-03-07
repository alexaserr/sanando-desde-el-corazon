"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Heart,
  LayoutDashboard,
  Users,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/store/ui";

const navItems = [
  { href: "/clinica/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/clinica/pacientes", label: "Pacientes", icon: Users },
  { href: "/clinica/sesiones", label: "Sesiones", icon: CalendarDays },
];

export function ClinicSidebar() {
  const pathname = usePathname();
  const { sidebarCollapsed, toggleSidebar } = useUIStore();

  return (
    <aside
      className={cn(
        "relative flex flex-col bg-white border-r transition-all duration-300 shrink-0",
        sidebarCollapsed ? "w-[72px]" : "w-[260px]",
      )}
    >
      {/* Logo */}
      <div className="h-16 flex items-center gap-2 px-4 border-b overflow-hidden">
        <Heart className="h-6 w-6 text-terra-medium shrink-0" />
        {!sidebarCollapsed && (
          <span className="font-display font-semibold text-sm leading-tight text-terra-dark whitespace-nowrap">
            Sanando desde
            <br />
            el Corazón
          </span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-2 space-y-1 overflow-hidden">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active =
            pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              title={sidebarCollapsed ? label : undefined}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                active
                  ? "bg-terra-medium/10 text-terra-dark"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!sidebarCollapsed && (
                <span className="whitespace-nowrap">{label}</span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Toggle button */}
      <button
        onClick={toggleSidebar}
        className="absolute -right-3 top-20 z-10 flex h-6 w-6 items-center justify-center rounded-full border bg-white shadow-sm hover:bg-muted transition-colors"
        aria-label={sidebarCollapsed ? "Expandir sidebar" : "Colapsar sidebar"}
      >
        {sidebarCollapsed ? (
          <ChevronRight className="h-3 w-3" />
        ) : (
          <ChevronLeft className="h-3 w-3" />
        )}
      </button>
    </aside>
  );
}
