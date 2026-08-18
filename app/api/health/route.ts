import { NextResponse } from "next/server";
import { getGeminiRoutingInfo } from "@/lib/gemini";
import { redisConfigured } from "@/lib/rate-limit";
import { securityConfigured } from "@/lib/security";

export const runtime = "nodejs";

function geminiConfigured(): boolean {
  try {
    return getGeminiRoutingInfo().credentialCount > 0;
  } catch {
    return false;
  }
}

export function GET() {
  const ready = securityConfigured() && redisConfigured() && geminiConfigured();
  return NextResponse.json(
    { status: ready ? "ok" : "unavailable" },
    {
      status: ready ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
