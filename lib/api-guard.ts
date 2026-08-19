import { NextResponse } from "next/server";
import { checkRateLimit, rateLimitHeaders, type RateLimitKind } from "./rate-limit";
import { getClientIp, isSameOrigin } from "./security";

export type ApiGuardResult =
  | { ok: true; headers: HeadersInit }
  | { ok: false; response: NextResponse };

export async function protectApi(
  request: Request,
  kind: RateLimitKind,
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
  const decision = await checkRateLimit(kind, getClientIp(request));
  if (decision.unavailable) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Pembatas permintaan sedang tidak tersedia. Coba kembali sesaat lagi." },
        { status: 503, headers: noStore },
      ),
    };
  }
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
    headers: { ...noStore, ...rateLimitHeaders(decision) },
  };
}
