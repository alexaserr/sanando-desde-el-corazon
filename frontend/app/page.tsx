import { redirect } from "next/navigation";

// La raíz redirige al dashboard clínico; el middleware gestiona la autenticación
export default function RootPage() {
  redirect("/clinica/dashboard");
}
