import { NextResponse } from "next/server";
import { checkRateLimit, rateLimitHeaders, type RateLimitKind } from "./rate-limit";
import { getClientIp, isSameOrigin } from "./security";
import { getRequestSession, type AppSession } from "./session";

export type ApiGuardResult =
  | { ok: true; session: AppSession; headers: HeadersInit }
  | { ok: false; response: NextResponse };

export async function protectApi(
  request: Request,
  kind: Exclude<RateLimitKind, "login">,
): Promise<ApiGuardResult> {
  const noStore = { "Cache-Control": "no-store" };
  if (!isSameOrigin(request)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Origin request tidak diizinkan." },
        { status: 403, headers: noStore },
      ),
    };
  }
  const session = await getRequestSession(request);
  if (!session) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Sesi tidak valid atau sudah berakhir." },
        { status: 401, headers: noStore },
      ),
    };
  }
  const identifier = `${session.sid}:${getClientIp(request)}`;
  const decision = await checkRateLimit(kind, identifier, true);
  if (!decision.allowed) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Batas permintaan tercapai. Coba kembali setelah waktu tunggu." },
        { status: 429, headers: { ...noStore, ...rateLimitHeaders(decision) } },
      ),
    };
  }
  return {
    ok: true,
    session,
    headers: decision.unavailable
      ? { ...noStore, "X-RateLimit-Degraded": "true" }
      : { ...noStore, ...rateLimitHeaders(decision) },
  };
}
