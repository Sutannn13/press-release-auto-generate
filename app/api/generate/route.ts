import { NextResponse } from "next/server";
import {
  FactAuditError,
  GeminiConfigurationError,
  GeminiGenerationError,
  GeminiRateLimitError,
  generatePressRelease,
} from "@/lib/gemini";
import { protectApi } from "@/lib/api-guard";
import { MAX_JSON_BODY_BYTES, validatePressReleaseInput } from "@/lib/validation";
import { requestId, safeLog } from "@/lib/security";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const startedAt = Date.now();
  const id = requestId(request);
  const guard = await protectApi(request, "generate");
  if (!guard.ok) {
    safeLog(id, "generate", guard.response.status, startedAt, "guard_rejected");
    return guard.response;
  }
  const headers = { ...guard.headers, "X-Request-Id": id };
  const length = Number(request.headers.get("content-length") || 0);
  if (length > MAX_JSON_BODY_BYTES) {
    safeLog(id, "generate", 413, startedAt, "body_too_large");
    return NextResponse.json({ error: "Data kegiatan terlalu besar." }, { status: 413, headers });
  }

  let requestBody: unknown;
  try {
    requestBody = await request.json();
  } catch {
    safeLog(id, "generate", 400, startedAt, "invalid_json");
    return NextResponse.json({ error: "Body request harus berupa JSON valid." }, { status: 400, headers });
  }
  const parsed = validatePressReleaseInput(requestBody);
  if (!parsed.success) {
    safeLog(id, "generate", 422, startedAt, "incomplete_input");
    return NextResponse.json(
      {
        code: "INCOMPLETE_INPUT",
        error: "Data fakta inti belum lengkap atau tidak valid.",
        issues: parsed.issues,
      },
      { status: 422, headers },
    );
  }

  try {
    const result = await generatePressRelease(parsed.data, parsed.warnings);
    safeLog(id, "generate", 200, startedAt, result.audit.repaired ? "success_repaired" : "success");
    return NextResponse.json(result, { headers });
  } catch (error) {
    if (error instanceof GeminiConfigurationError) {
      safeLog(id, "generate", 503, startedAt, "gemini_unconfigured");
      return NextResponse.json({ error: error.message }, { status: 503, headers });
    }
    if (error instanceof GeminiRateLimitError) {
      safeLog(id, "generate", 429, startedAt, "gemini_rate_limited");
      return NextResponse.json({ error: error.message }, { status: 429, headers: { ...headers, "Retry-After": "60" } });
    }
    if (error instanceof FactAuditError) {
      safeLog(id, "generate", 422, startedAt, "fact_audit_failed");
      return NextResponse.json(
        {
          code: "FACT_AUDIT_FAILED",
          error: error.message,
          violations: error.violations,
        },
        { status: 422, headers },
      );
    }
    if (error instanceof GeminiGenerationError) {
      safeLog(id, "generate", 502, startedAt, "generation_failed");
      return NextResponse.json({ error: error.message }, { status: 502, headers });
    }
    safeLog(id, "generate", 500, startedAt, "unexpected");
    return NextResponse.json({ error: "Terjadi kesalahan saat membuat press release." }, { status: 500, headers });
  }
}
