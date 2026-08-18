import { NextResponse } from "next/server";
import { checkRateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { createSessionToken, SESSION_COOKIE, sessionCookieOptions } from "@/lib/session";
import {
  getClientIp,
  isSameOrigin,
  requestId,
  safeLog,
  securityConfigured,
  verifyAccessPassword,
} from "@/lib/security";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const startedAt = Date.now();
  const id = requestId(request);
  const headers = { "Cache-Control": "no-store", "X-Request-Id": id };
  if (!isSameOrigin(request)) {
    safeLog(id, "auth/login", 403, startedAt, "origin_rejected");
    return NextResponse.json({ error: "Origin request tidak diizinkan." }, { status: 403, headers });
  }
  if (!securityConfigured()) {
    safeLog(id, "auth/login", 503, startedAt, "security_unconfigured");
    return NextResponse.json({ error: "Konfigurasi keamanan server belum lengkap." }, { status: 503, headers });
  }

  const decision = await checkRateLimit("login", getClientIp(request), false);
  if (decision.unavailable) {
    safeLog(id, "auth/login", 503, startedAt, "rate_limit_unavailable");
    return NextResponse.json({ error: "Layanan keamanan sementara tidak tersedia." }, { status: 503, headers });
  }
  if (!decision.allowed) {
    safeLog(id, "auth/login", 429, startedAt, "rate_limited");
    return NextResponse.json(
      { error: "Terlalu banyak percobaan login. Coba kembali nanti." },
      { status: 429, headers: { ...headers, ...rateLimitHeaders(decision) } },
    );
  }

  const length = Number(request.headers.get("content-length") || 0);
  if (length > 2_048) {
    safeLog(id, "auth/login", 413, startedAt, "body_too_large");
    return NextResponse.json({ error: "Request terlalu besar." }, { status: 413, headers });
  }
  let password = "";
  try {
    const body = (await request.json()) as { password?: unknown };
    if (typeof body.password === "string") password = body.password;
  } catch {
    // Respons sengaja generik agar tidak membocorkan detail autentikasi.
  }
  if (!password || password.length > 256 || !verifyAccessPassword(password)) {
    safeLog(id, "auth/login", 401, startedAt, "invalid_credentials");
    return NextResponse.json({ error: "Password tidak valid." }, { status: 401, headers });
  }

  const response = NextResponse.json({ ok: true }, { headers });
  response.cookies.set(SESSION_COOKIE, await createSessionToken(), sessionCookieOptions);
  safeLog(id, "auth/login", 200, startedAt, "success");
  return response;
}
