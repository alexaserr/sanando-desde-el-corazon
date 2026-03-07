import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// TODO: Habilitar verificación de refresh_token cuando el backend lo implemente
export function middleware(_request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/).*)"],
};
