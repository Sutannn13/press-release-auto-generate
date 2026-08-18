import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { GEBER_INPUT } from "./v2-fixtures";
import { APPROVED_GEBER_QUOTES, GEBER_BLOCKS } from "./generate-dummy-docx";

const DUMMY_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

async function main() {
  (process.env as Record<string, string | undefined>).NODE_ENV = "test";
  process.env.RATE_LIMIT_TEST_MODE = "allow";
  process.env.SESSION_SECRET = "test-session-secret-that-is-at-least-32-characters";
  process.env.APP_ACCESS_PASSWORD = "test-password";
  process.env.GEMINI_API_KEY_PRIMARY = "test-gemini-key";
  process.env.UPSTASH_REDIS_REST_URL = "https://example.test";
  process.env.UPSTASH_REDIS_REST_TOKEN = "test-redis-token";

  const [{ POST: generate }, { POST: exportDocx }, { GET: health }, { createSessionToken }] = await Promise.all([
    import("../app/api/generate/route"),
    import("../app/api/export-docx/route"),
    import("../app/api/health/route"),
    import("../lib/session"),
  ]);
  const cookie = `kemenag_session=${await createSessionToken()}`;
  const headers = {
    Origin: "http://localhost",
    Cookie: cookie,
    "X-Forwarded-For": "127.0.0.1",
  };

  const ready = await health();
  assert.equal(ready.status, 200);
  assert.deepEqual(await ready.json(), { status: "ok" });
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  const unavailableHealth = await health();
  assert.equal(unavailableHealth.status, 503);
  assert.deepEqual(await unavailableHealth.json(), { status: "unavailable" });
  process.env.UPSTASH_REDIS_REST_TOKEN = "test-redis-token";

  const unauthorized = await generate(new Request("http://localhost/api/generate", {
    method: "POST",
    headers: { Origin: "http://localhost", "Content-Type": "application/json" },
    body: JSON.stringify(GEBER_INPUT),
  }));
  assert.equal(unauthorized.status, 401);

  const foreignOrigin = await generate(new Request("http://localhost/api/generate", {
    method: "POST",
    headers: { ...headers, Origin: "https://evil.example", "Content-Type": "application/json" },
    body: JSON.stringify(GEBER_INPUT),
  }));
  assert.equal(foreignOrigin.status, 403);

  const incomplete = await generate(new Request("http://localhost/api/generate", {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ ...GEBER_INPUT, tujuan: "" }),
  }));
  assert.equal(incomplete.status, 422);
  assert.equal(((await incomplete.json()) as { code?: string }).code, "INCOMPLETE_INPUT");

  const payload = {
    version: 2,
    judul: "Kemenag Depok Lanjutkan GEBER MAS dengan Ziarah dan Tabur Bunga di TMP Kalimulya",
    blocks: GEBER_BLOCKS,
    quoteReviews: APPROVED_GEBER_QUOTES,
    sourceInput: GEBER_INPUT,
    kontributor: GEBER_INPUT.kontributor,
  };
  const withoutPhoto = new FormData();
  withoutPhoto.append("data", JSON.stringify(payload));
  const noPhoto = await exportDocx(new Request("http://localhost/api/export-docx", {
    method: "POST",
    headers,
    body: withoutPhoto,
  }));
  assert.equal(noPhoto.status, 400);

  const formData = new FormData();
  formData.append("data", JSON.stringify(payload));
  formData.append("foto", new File([Buffer.from(DUMMY_PNG_BASE64, "base64")], "foto.png", { type: "image/png" }));
  const exported = await exportDocx(new Request("http://localhost/api/export-docx", {
    method: "POST",
    headers,
    body: formData,
  }));
  assert.equal(exported.status, 200);
  assert.equal(exported.headers.get("content-type"), "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  const bytes = new Uint8Array(await exported.arrayBuffer());
  assert.equal(String.fromCharCode(...bytes.slice(0, 2)), "PK");
  const outputDirectory = path.resolve("artifacts/phase-4");
  await mkdir(outputDirectory, { recursive: true });
  await writeFile(path.join(outputDirectory, "api-export.docx"), bytes);

  process.env.RATE_LIMIT_TEST_MODE = "deny";
  const limited = await generate(new Request("http://localhost/api/generate", {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify(GEBER_INPUT),
  }));
  assert.equal(limited.status, 429);
  assert.ok(limited.headers.get("retry-after"));

  console.log("API health, auth, origin, 422, rate-limit, foto wajib export, dan DOCX lulus.");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
