import assert from "node:assert/strict";
import {
  GEMINI_FALLBACK_MODEL,
  GEMINI_FLASH_MODEL,
  GeminiGenerationError,
  getGeminiRoutingInfo,
  parseGeneratedPressRelease,
} from "../lib/gemini";
import { SYSTEM_PROMPT } from "../lib/prompt";
import { validateDraftDeterministically } from "../lib/article";
import { validatePressReleaseInput } from "../lib/validation";
import { parseStoredDraft, serializeDraft, DRAFT_TTL_MS } from "../lib/draft-storage";
import { BRUS_INPUT, GEBER_INPUT, LOMBA_INPUT } from "./v2-fixtures";

const brusResponse = JSON.stringify({
  judul: "Kemenag Depok Gelar BRUS untuk Membekali Remaja dalam Pergaulan Sehat",
  blocks: [
    {
      type: "paragraph",
      role: "lead",
      text: "DEPOK (KEMENAG) – Kantor Kementerian Agama Kota Depok menggelar Bimbingan Remaja Usia Sekolah (BRUS) bagi 30 siswa dan siswi Pondok Pesantren Hidayatullah di Aula Kantor Kementerian Agama Kota Depok, Rabu (12/08/2026).",
      quoteId: "",
      attributionStyle: "",
    },
    {
      type: "paragraph",
      role: "body",
      text: "BRUS bertujuan memberikan bimbingan pergaulan sehat kepada remaja usia sekolah sebagai bekal menjalani kehidupan setelah lulus. Tema yang dibahas adalah pergaulan sehat bagi remaja usia sekolah.",
      quoteId: "",
      attributionStyle: "",
    },
    {
      type: "paragraph",
      role: "body",
      text: "Kegiatan diawali dengan pembukaan dan dilanjutkan dengan pemaparan materi oleh Penyuluh Agama Islam Siti Habibah. Materi mencakup pergaulan sehat dan persiapan remaja menuju kehidupan setelah lulus.",
      quoteId: "",
      attributionStyle: "",
    },
    {
      type: "paragraph",
      role: "body",
      text: "Setelah pemaparan, peserta mengikuti sesi tanya jawab dan mengajukan pertanyaan kepada pemateri. Kegiatan kemudian ditutup dengan rangkuman materi.",
      quoteId: "",
      attributionStyle: "",
    },
    { type: "quote", role: "quote", text: "", quoteId: "quote-sholahudin", attributionStyle: "full" },
    {
      type: "paragraph",
      role: "closing",
      text: "Rangkaian BRUS berakhir dengan rangkuman tentang pergaulan sehat dan persiapan remaja menghadapi kehidupan setelah lulus.",
      quoteId: "",
      attributionStyle: "",
    },
  ],
  quoteCleanups: [
    {
      quoteId: "quote-sholahudin",
      cleaned: "Jangan dianggap BRUS itu cuma pendidikan seks Islami, tapi lebih ke bimbingan mempersiapkan anak-anak usia sekolah secara pergaulan untuk ke jenjang membangun keluarga dan setelah lulus siap dalam hal pergaulan.",
    },
  ],
  faktaDigunakan: ["BRUS", "30 peserta"],
});

assert.equal(GEMINI_FLASH_MODEL, "gemini-3.6-flash");
assert.equal(GEMINI_FALLBACK_MODEL, "gemini-3.5-flash-lite");
assert.match(SYSTEM_PROMPT, /Dilarang menambah nama/);
assert.match(SYSTEM_PROMPT, /5 sampai 8/);

const previousGeminiEnvironment = {
  legacy: process.env.GEMINI_API_KEY,
  primary: process.env.GEMINI_API_KEY_PRIMARY,
  backup1: process.env.GEMINI_API_KEY_BACKUP_1,
  backup2: process.env.GEMINI_API_KEY_BACKUP_2,
  primaryModel: process.env.GEMINI_MODEL_PRIMARY,
  fallbackModel: process.env.GEMINI_MODEL_FALLBACK,
};
process.env.GEMINI_API_KEY = "legacy-key-that-must-not-override-primary";
process.env.GEMINI_API_KEY_PRIMARY = "primary-test-key";
process.env.GEMINI_API_KEY_BACKUP_1 = "backup-one-test-key";
process.env.GEMINI_API_KEY_BACKUP_2 = "backup-two-test-key";
process.env.GEMINI_MODEL_PRIMARY = "gemini-3.6-flash";
process.env.GEMINI_MODEL_FALLBACK = "gemini-3.5-flash-lite";
assert.deepEqual(getGeminiRoutingInfo(), {
  credentialCount: 3,
  primaryModel: "gemini-3.6-flash",
  fallbackModel: "gemini-3.5-flash-lite",
  targetCount: 4,
});
Object.entries(previousGeminiEnvironment).forEach(([key, value]) => {
  const names = {
    legacy: "GEMINI_API_KEY",
    primary: "GEMINI_API_KEY_PRIMARY",
    backup1: "GEMINI_API_KEY_BACKUP_1",
    backup2: "GEMINI_API_KEY_BACKUP_2",
    primaryModel: "GEMINI_MODEL_PRIMARY",
    fallbackModel: "GEMINI_MODEL_FALLBACK",
  } as const;
  const environmentName = names[key as keyof typeof names];
  if (value === undefined) delete process.env[environmentName];
  else process.env[environmentName] = value;
});

for (const input of [BRUS_INPUT, LOMBA_INPUT, GEBER_INPUT]) {
  assert.equal(validatePressReleaseInput(input).success, true);
}

const incomplete = validatePressReleaseInput({ ...BRUS_INPUT, tujuan: "" });
assert.equal(incomplete.success, false);
if (!incomplete.success) assert.ok(incomplete.issues.some((issue) => issue.field === "tujuan"));

const brus = parseGeneratedPressRelease(brusResponse, BRUS_INPUT);
assert.equal(brus.blocks.length, 6);
assert.equal(brus.quoteReviews[0].original, BRUS_INPUT.kutipan[0].isi);
assert.equal(brus.quoteReviews[0].selected, null);
assert.equal(brus.quoteReviews[0].approved, false);
assert.deepEqual(validateDraftDeterministically(brus, BRUS_INPUT), []);

const unsafeQuote = brusResponse.replace("Jangan dianggap", "Jangan pernah dianggap bukan");
assert.throws(
  () => parseGeneratedPressRelease(unsafeQuote, BRUS_INPUT),
  GeminiGenerationError,
);

const geberResponse = JSON.stringify({
  judul: "Kemenag Depok Lanjutkan GEBER MAS dengan Ziarah dan Tabur Bunga",
  blocks: [
    {
      type: "paragraph",
      role: "lead",
      text: "CILODONG (KEMENAG) – Kantor Kementerian Agama Kota Depok menyelenggarakan Ziarah Maqburah sebagai rangkaian lanjutan GEBER MAS bersama jajaran Kementerian Agama Kota Depok di Taman Makam Pahlawan (TMP) Kalimulya, Kota Depok, Senin (10/08/2026).",
      quoteId: "",
      attributionStyle: "",
    },
    {
      type: "paragraph",
      role: "body",
      text: "Ziarah Maqburah bertujuan mengenang dan menghormati jasa para pahlawan serta memperkuat kepedulian dan semangat kebangsaan. Peringatan ini juga memaknai upaya meneruskan semangat pengabdian.",
      quoteId: "",
      attributionStyle: "",
    },
    {
      type: "paragraph",
      role: "body",
      text: "Jajaran Kementerian Agama Kota Depok mengikuti upacara penghormatan kepada para pahlawan. Rangkaian kemudian dilanjutkan dengan prosesi tabur bunga sebagai penghargaan atas jasa dan pengorbanan para pejuang bangsa.",
      quoteId: "",
      attributionStyle: "",
    },
    { type: "quote", role: "quote", text: "", quoteId: "quote-dede-1", attributionStyle: "full" },
    {
      type: "paragraph",
      role: "body",
      text: "H. Dede Supriatna juga menyampaikan pentingnya meneruskan semangat pengabdian melalui kerja yang berintegritas dan pelayanan yang baik.",
      quoteId: "",
      attributionStyle: "",
    },
    { type: "quote", role: "quote", text: "", quoteId: "quote-dede-2", attributionStyle: "pronoun" },
    {
      type: "paragraph",
      role: "closing",
      text: "Upacara ziarah dan tabur bunga di TMP Kalimulya berlangsung khidmat bersama jajaran Kementerian Agama Kota Depok.",
      quoteId: "",
      attributionStyle: "",
    },
  ],
  quoteCleanups: GEBER_INPUT.kutipan.map((quote) => ({ quoteId: quote.id, cleaned: quote.isi })),
  faktaDigunakan: ["Ziarah Maqburah", "TMP Kalimulya"],
});
const geber = parseGeneratedPressRelease(geberResponse, GEBER_INPUT);
assert.deepEqual(geber.blocks.map((block) => block.type), ["paragraph", "paragraph", "paragraph", "quote", "paragraph", "quote", "paragraph"]);
assert.deepEqual(validateDraftDeterministically(geber, GEBER_INPUT), []);
const oldThreeParagraphDraft = {
  ...brus,
  blocks: brus.blocks.filter((block) => block.type === "quote" || block.id === "block-1" || block.id === "block-2" || block.id === "block-6"),
};
assert.ok(
  validateDraftDeterministically(oldThreeParagraphDraft, BRUS_INPUT)
    .some((violation) => violation.reason.includes("5") && violation.reason.includes("paragraf")),
);
const slopDraft = {
  ...brus,
  blocks: brus.blocks.map((block) =>
    block.id === "block-4" && block.type === "paragraph"
      ? { ...block, text: `${block.text} Kegiatan berlangsung lancar.` }
      : block,
  ),
};
assert.ok(
  validateDraftDeterministically(slopDraft, BRUS_INPUT)
    .some((violation) => violation.reason.includes("Frasa klise/AI")),
);
const repetitiveDraft = {
  ...brus,
  blocks: brus.blocks.map((block) =>
    block.id === "block-4" && block.type === "paragraph"
      ? { ...block, text: brus.blocks[2].type === "paragraph" ? brus.blocks[2].text : block.text }
      : block,
  ),
};
assert.ok(
  validateDraftDeterministically(repetitiveDraft, BRUS_INPUT)
    .some((violation) => violation.reason.includes("terlalu repetitif")),
);
const adjacentQuotes = {
  ...geber,
  blocks: geber.blocks.filter((block) => block.id !== "block-5"),
};
assert.ok(
  validateDraftDeterministically(adjacentQuotes, GEBER_INPUT)
    .some((violation) => violation.reason.includes("di antara dua quote block")),
);

const stored = serializeDraft({ form: { nama: "BRUS" }, preview: brus, sourceInput: BRUS_INPUT, stale: false });
assert.ok(parseStoredDraft<{ nama: string }>(stored));
const parsedStored = JSON.parse(stored) as { savedAt: number };
assert.equal(parseStoredDraft(stored, parsedStored.savedAt + DRAFT_TTL_MS + 1), null);

console.log("Validasi V2, ordered blocks, quote fidelity, 5W1H, dan autosave lulus.");
