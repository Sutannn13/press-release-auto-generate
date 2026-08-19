import { NextRequest, NextResponse } from "next/server";

export async function proxy(request: NextRequest) {
  // Keep old bookmarks working after the login screen was removed.
  if (request.nextUrl.pathname === "/login") {
    return NextResponse.redirect(new URL("/", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
