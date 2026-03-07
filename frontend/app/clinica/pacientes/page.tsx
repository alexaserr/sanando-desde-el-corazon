import { Users } from "lucide-react";

export default function PacientesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold tracking-tight text-terra-dark">
          Pacientes
        </h1>
        <p className="text-muted-foreground">
          Gestión de clientes clínicos
        </p>
      </div>

      <div className="flex items-center justify-center h-64 border-2 border-dashed border-muted rounded-lg">
        <div className="text-center text-muted-foreground">
          <Users className="h-12 w-12 mx-auto mb-3 opacity-40" />
          <p className="text-sm">Lista de pacientes — próximamente</p>
        </div>
      </div>
    </div>
  );
}
