import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Rutas públicas: pasan sin verificación de sesión
const PUBLIC_PATHS = [
  "/",
  "/servicios",
  "/cursos",
  "/podcast",
  "/agendar",
  "/login",
  "/registro",
];

// Roles permitidos por prefijo de ruta
const ROUTE_ROLES: Record<string, string[]> = {
  "/clinica": ["admin", "sanador"],
  "/mis-cursos": ["miembro", "admin", "sanador"],
};

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // El access token vive en memoria (Zustand).
  // El refresh_token en cookie HttpOnly es la señal de sesión activa.
  const hasRefreshToken = request.cookies.has("refresh_token");

  if (!hasRefreshToken) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("returnUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Verificación de rol para rutas protegidas
  // El rol se almacena en una cookie no-HttpOnly "user_role" durante el login
  const userRole = request.cookies.get("user_role")?.value ?? "";

  for (const [prefix, allowedRoles] of Object.entries(ROUTE_ROLES)) {
    if (pathname.startsWith(prefix)) {
      if (!allowedRoles.includes(userRole)) {
        const loginUrl = new URL("/login", request.url);
        loginUrl.searchParams.set("returnUrl", pathname);
        return NextResponse.redirect(loginUrl);
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/).*)"],
};
