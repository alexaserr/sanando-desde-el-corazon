"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, CalendarDays, PlusCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/clinica", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/clinica/pacientes", label: "Clientes", icon: Users, exact: false },
  { href: "/clinica/sesiones", label: "Sesiones", icon: CalendarDays, exact: true },
  { href: "/clinica/sesiones/nueva", label: "Nueva sesión", icon: PlusCircle, exact: false },
];

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-white border-r flex flex-col">
      <div className="h-16 flex items-center gap-2 px-6 border-b">
        <img src="/images/sdc-icon.png" alt="SDC" className="h-8 w-8 object-contain flex-shrink-0" />
        <span className="font-display font-semibold text-sm leading-tight text-terra-900">
          Sanando desde
          <br />
          el Corazón
        </span>
      </div>

      <nav className="flex-1 py-4 px-3 space-y-1">
        {navItems.map(({ href, label, icon: Icon, exact }) => {
          const isActive = exact
            ? pathname === href
            : pathname === href || pathname.startsWith(href + "/");

          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
