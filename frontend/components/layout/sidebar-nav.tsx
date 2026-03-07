"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Heart, LayoutDashboard, Users, CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/clients", label: "Clientes", icon: Users },
  { href: "/dashboard/sessions", label: "Sesiones", icon: CalendarDays },
];

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-white border-r flex flex-col">
      <div className="h-16 flex items-center gap-2 px-6 border-b">
        <Heart className="h-6 w-6 text-primary" />
        <span className="font-semibold text-sm leading-tight">
          Sanando desde
          <br />
          el Corazón
        </span>
      </div>

      <nav className="flex-1 py-4 px-3 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
              pathname === href || pathname.startsWith(href + "/")
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
