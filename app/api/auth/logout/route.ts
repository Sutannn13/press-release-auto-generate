import { NextResponse } from "next/server";
import { isSameOrigin } from "@/lib/security";
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/session";

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Origin request tidak diizinkan." }, { status: 403 });
  }
  const response = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  response.cookies.set(SESSION_COOKIE, "", { ...sessionCookieOptions, maxAge: 0 });
  return response;
}
