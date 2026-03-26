import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasRefreshToken = request.cookies.has("refresh_token");

  // Rutas /clinica/*: requieren cookie refresh_token
  if (pathname.startsWith("/clinica")) {
    if (!hasRefreshToken) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("returnUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  // /login: si ya hay sesión activa, redirigir a /clinica
  // Excepción: ?session=expired indica que el refresh token ya no es válido
  // (cookie HttpOnly sigue presente pero el token expiró/fue revocado)
  if (pathname === "/login" && hasRefreshToken) {
    if (request.nextUrl.searchParams.get("session") !== "expired") {
      return NextResponse.redirect(new URL("/clinica", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/clinica/:path*", "/login"],
};
