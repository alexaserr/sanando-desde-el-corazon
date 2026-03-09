import { redirect } from "next/navigation";

// La raíz redirige a la plataforma clínica; el middleware gestiona la autenticación
export default function RootPage() {
  redirect("/clinica");
}
