import { NextResponse } from "next/server";
import { buildPressReleaseDocx } from "@/lib/docx-builder";
import { protectApi } from "@/lib/api-guard";
import { parseExportDocxInput, parseImageFile } from "@/lib/validation";
import { requestId, safeLog } from "@/lib/security";

export const runtime = "nodejs";

const DOCX_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const MAX_MULTIPART_BYTES = 6 * 1024 * 1024;

export async function POST(request: Request) {
  const startedAt = Date.now();
  const id = requestId(request);
  const guard = await protectApi(request, "export");
  if (!guard.ok) {
    safeLog(id, "export-docx", guard.response.status, startedAt, "guard_rejected");
    return guard.response;
  }
  const headers = { ...guard.headers, "X-Request-Id": id };
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.includes("multipart/form-data")) {
    safeLog(id, "export-docx", 400, startedAt, "multipart_required");
    return NextResponse.json({ error: "Foto kegiatan dan data final wajib disertakan." }, { status: 400, headers });
  }
  const length = Number(request.headers.get("content-length") || 0);
  if (length > MAX_MULTIPART_BYTES) {
    safeLog(id, "export-docx", 413, startedAt, "body_too_large");
    return NextResponse.json({ error: "Ukuran request maksimal 6 MB." }, { status: 413, headers });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    safeLog(id, "export-docx", 400, startedAt, "invalid_multipart");
    return NextResponse.json({ error: "Multipart form-data tidak valid." }, { status: 400, headers });
  }
  const photo = formData.get("foto");
  const rawData = formData.get("data");
  if (!(photo instanceof File)) {
    safeLog(id, "export-docx", 400, startedAt, "photo_missing");
    return NextResponse.json({ error: "Foto kegiatan wajib disertakan saat download." }, { status: 400, headers });
  }
  if (typeof rawData !== "string" || rawData.length > 96 * 1024) {
    safeLog(id, "export-docx", 400, startedAt, "data_invalid");
    return NextResponse.json({ error: "Data final tidak valid atau terlalu besar." }, { status: 400, headers });
  }

  let rawPayload: unknown;
  try {
    rawPayload = JSON.parse(rawData);
  } catch {
    safeLog(id, "export-docx", 400, startedAt, "data_json_invalid");
    return NextResponse.json({ error: "Data final harus berupa JSON valid." }, { status: 400, headers });
  }
  const input = parseExportDocxInput(rawPayload);
  if (!input) {
    safeLog(id, "export-docx", 422, startedAt, "final_review_invalid");
    return NextResponse.json(
      {
        code: "FINAL_REVIEW_INVALID",
        error: "Draf final, checklist, urutan blok, atau persetujuan kutipan tidak valid.",
      },
      { status: 422, headers },
    );
  }
  const photoResult = await parseImageFile(photo);
  if (typeof photoResult === "string") {
    safeLog(id, "export-docx", 400, startedAt, "photo_invalid");
    return NextResponse.json({ error: photoResult }, { status: 400, headers });
  }

  try {
    const documentBuffer = await buildPressReleaseDocx(input, photoResult);
    safeLog(id, "export-docx", 200, startedAt, "success");
    return new Response(new Uint8Array(documentBuffer), {
      status: 200,
      headers: {
        ...headers,
        "Content-Disposition": 'attachment; filename="press-release-kemenag-depok.docx"',
        "Content-Type": DOCX_CONTENT_TYPE,
      },
    });
  } catch {
    safeLog(id, "export-docx", 500, startedAt, "docx_failed");
    return NextResponse.json({ error: "Gagal membuat dokumen Word." }, { status: 500, headers });
  }
}
