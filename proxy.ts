import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";

const PUBLIC_PATHS = ["/login", "/api/auth/login"];

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.includes(path);
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySessionToken(token) : null;

  if (isPublic) {
    if (session && path === "/login") return NextResponse.redirect(new URL("/", request.url));
    return NextResponse.next();
  }
  if (session) return NextResponse.next();
  if (path.startsWith("/api/")) {
    return NextResponse.json(
      { error: "Sesi tidak valid atau sudah berakhir." },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }
  return NextResponse.redirect(new URL("/login", request.url));
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
