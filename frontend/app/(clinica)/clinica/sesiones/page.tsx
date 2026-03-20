"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { Users, PlusCircle, CalendarPlus } from "lucide-react";

export default function SessionsPage() {
  const router = useRouter();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-terra-900">
            Sesiones
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Historial de sesiones clínicas
          </p>
        </div>
        <button
          onClick={() => router.push("/clinica/sesiones/nueva")}
          className="flex items-center gap-2 bg-terra-700 hover:bg-terra-500 text-white h-10 px-4 rounded text-sm font-medium transition-colors"
        >
          <PlusCircle className="h-4 w-4" />
          Nueva sesión
        </button>
      </div>

      {/* Estado vacío */}
      <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
        <div className="rounded-full bg-terra-50 p-4">
          <CalendarPlus className="h-8 w-8 text-terra-400" />
        </div>
        <div>
          <h2 className="text-lg font-medium text-gray-900 mb-1">
            No hay sesiones registradas
          </h2>
          <p className="text-sm text-gray-500 max-w-sm">
            Consulta las sesiones desde la ficha de cada clienta o crea una nueva sesión.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href="/clinica/sesiones/nueva"
            className="text-sm text-terra-700 hover:text-terra-900 font-medium underline underline-offset-2 transition-colors"
          >
            Nueva sesión
          </Link>
          <Link
            href="/clinica/pacientes"
            className="text-sm text-terra-700 hover:text-terra-900 font-medium underline underline-offset-2 transition-colors"
          >
            Ir a Clientes
          </Link>
        </div>
      </div>
    </div>
  );
}
