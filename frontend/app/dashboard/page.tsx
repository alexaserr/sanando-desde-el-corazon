import { Users, CalendarDays, TrendingUp, Heart } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const stats = [
  {
    title: "Clientes activos",
    value: "—",
    icon: Users,
    description: "Total registrados",
  },
  {
    title: "Sesiones este mes",
    value: "—",
    icon: CalendarDays,
    description: "Mes actual",
  },
  {
    title: "Sesiones totales",
    value: "—",
    icon: TrendingUp,
    description: "Histórico",
  },
  {
    title: "Plataforma",
    value: "Activa",
    icon: Heart,
    description: "Sistema en línea",
  },
];

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Bienvenido a Sanando desde el Corazón
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {stat.title}
              </CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground">
                {stat.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
