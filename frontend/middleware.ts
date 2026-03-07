import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Rutas públicas: pasan sin verificación de sesión
const PUBLIC_PATHS = ["/login"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }

  // El access token vive en memoria (Zustand).
  // El refresh_token en cookie HttpOnly es la señal de sesión activa.
  const hasRefreshToken = request.cookies.has("refresh_token");

  if (!hasRefreshToken) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/).*)"],
};
