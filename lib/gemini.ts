import { ApiError, GoogleGenAI } from "@google/genai";
import {
  FACT_AUDITOR_SYSTEM_PROMPT,
  MAX_ARTICLE_BLOCKS,
  MIN_PARAGRAPH_BLOCKS,
  SYSTEM_PROMPT,
  buildFactAuditPrompt,
  buildPressReleasePrompt,
  buildRepairPrompt,
  type ArticleBlock,
  type ChecklistKey,
  type FactViolation,
  type GeneratedPressRelease,
  type ModelDraftResponse,
  type ModelFactAuditResponse,
  type PressReleaseInput,
  type QuoteReview,
} from "./prompt";
import {
  buildGeneratedChecklist,
  cleanedQuoteIsSafe,
  collectFactSummary,
  normalizeTitleCapitalization,
  validateDraftDeterministically,
} from "./article";

export const GEMINI_FLASH_MODEL = "gemini-3.6-flash";

const DRAFT_RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    judul: { type: "string" },
    blocks: {
      type: "array",
      minItems: MIN_PARAGRAPH_BLOCKS,
      maxItems: MAX_ARTICLE_BLOCKS,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          type: { type: "string", enum: ["paragraph", "quote"] },
          role: { type: "string", enum: ["lead", "body", "closing", "quote"] },
          text: { type: "string" },
          quoteId: { type: "string" },
          attributionStyle: { type: "string", enum: ["full", "pronoun", ""] },
        },
        required: ["type", "role", "text", "quoteId", "attributionStyle"],
      },
    },
    quoteCleanups: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: { quoteId: { type: "string" }, cleaned: { type: "string" } },
        required: ["quoteId", "cleaned"],
      },
    },
    faktaDigunakan: { type: "array", items: { type: "string" } },
  },
  required: ["judul", "blocks", "quoteCleanups", "faktaDigunakan"],
} as const;

const FACT_AUDIT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    valid: { type: "boolean" },
    violations: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          blockId: { type: "string" },
          claim: { type: "string" },
          reason: { type: "string" },
        },
        required: ["blockId", "claim", "reason"],
      },
    },
    missingElements: {
      type: "array",
      items: { type: "string", enum: ["what", "who", "where", "when", "why", "how"] },
    },
  },
  required: ["valid", "violations", "missingElements"],
} as const;

export class GeminiConfigurationError extends Error {
  constructor() {
    super("GEMINI_API_KEY belum dikonfigurasi.");
    this.name = "GeminiConfigurationError";
  }
}

export class GeminiGenerationError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "GeminiGenerationError";
  }
}

export class GeminiRateLimitError extends GeminiGenerationError {
  constructor(options?: ErrorOptions) {
    super("Batas permintaan Gemini sedang tercapai.", options);
    this.name = "GeminiRateLimitError";
  }
}

export class FactAuditError extends GeminiGenerationError {
  readonly violations: FactViolation[];

  constructor(violations: FactViolation[]) {
    super("Draf masih memiliki klaim yang tidak didukung setelah satu kali perbaikan.");
    this.name = "FactAuditError";
    this.violations = violations;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function parseJson(text: string, label: string): unknown {
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new GeminiGenerationError(`${label} tidak mengembalikan JSON valid.`, { cause: error });
  }
}

function parseModelDraft(value: unknown): ModelDraftResponse {
  if (!isRecord(value) || !isText(value.judul) || !Array.isArray(value.blocks) || !Array.isArray(value.quoteCleanups) || !Array.isArray(value.faktaDigunakan)) {
    throw new GeminiGenerationError("Gemini mengembalikan struktur draf yang tidak lengkap.");
  }
  const blocks = value.blocks;
  if (
    blocks.length < MIN_PARAGRAPH_BLOCKS ||
    blocks.length > MAX_ARTICLE_BLOCKS ||
    !blocks.every(
      (block) =>
        isRecord(block) &&
        (block.type === "paragraph" || block.type === "quote") &&
        (block.role === "lead" || block.role === "body" || block.role === "closing" || block.role === "quote") &&
        typeof block.text === "string" &&
        typeof block.quoteId === "string" &&
        (block.attributionStyle === "full" || block.attributionStyle === "pronoun" || block.attributionStyle === ""),
    )
  ) {
    throw new GeminiGenerationError("Blok artikel dari Gemini tidak valid.");
  }
  if (
    !value.quoteCleanups.every(
      (item) => isRecord(item) && isText(item.quoteId) && isText(item.cleaned),
    ) ||
    !value.faktaDigunakan.every(isText)
  ) {
    throw new GeminiGenerationError("Daftar perapian kutipan atau fakta tidak valid.");
  }
  return value as unknown as ModelDraftResponse;
}

function toGeneratedDraft(
  model: ModelDraftResponse,
  input: PressReleaseInput,
  warnings: string[],
): GeneratedPressRelease {
  const quoteById = new Map(input.kutipan.map((quote) => [quote.id, quote]));
  const cleanupById = new Map(model.quoteCleanups.map((cleanup) => [cleanup.quoteId, cleanup.cleaned.trim()]));
  const quoteReviews: QuoteReview[] = input.kutipan.map((quote) => {
    const cleaned = cleanupById.get(quote.id);
    if (!cleaned || !cleanedQuoteIsSafe(quote.isi, cleaned)) {
      throw new GeminiGenerationError(`Versi rapih kutipan ${quote.id} tidak aman atau tidak tersedia.`);
    }
    return {
      quoteId: quote.id,
      nama: quote.nama,
      jabatan: quote.jabatan,
      original: quote.isi,
      cleaned,
      selected: null,
      approved: false,
    };
  });
  if (cleanupById.size !== input.kutipan.length || [...cleanupById.keys()].some((id) => !quoteById.has(id))) {
    throw new GeminiGenerationError("Jumlah atau ID versi rapih kutipan berbeda dari input.");
  }

  const blocks: ArticleBlock[] = model.blocks.map((block, index) => {
    const id = `block-${index + 1}`;
    if (block.type === "paragraph") {
      if (block.role === "quote" || !block.text.trim() || block.quoteId) {
        throw new GeminiGenerationError(`Paragraph block ke-${index + 1} tidak valid.`);
      }
      return { id, type: "paragraph", role: block.role, text: block.text.trim() };
    }
    if (block.role !== "quote" || !quoteById.has(block.quoteId) || !block.attributionStyle) {
      throw new GeminiGenerationError(`Quote block ke-${index + 1} tidak valid.`);
    }
    return { id, type: "quote", quoteId: block.quoteId, attributionStyle: block.attributionStyle };
  });

  const draft: GeneratedPressRelease = {
    version: 2,
    judul: normalizeTitleCapitalization(model.judul),
    blocks,
    quoteReviews,
    checklist: buildGeneratedChecklist(input, blocks),
    warnings,
    faktaDigunakan: collectFactSummary(input),
    audit: { passed: false, repaired: false, violations: [] },
  };
  const violations = validateDraftDeterministically(draft, input);
  return {
    ...draft,
    audit: { passed: false, repaired: false, violations },
  };
}

function parseFactAudit(value: unknown): ModelFactAuditResponse {
  if (
    !isRecord(value) ||
    typeof value.valid !== "boolean" ||
    !Array.isArray(value.violations) ||
    !Array.isArray(value.missingElements) ||
    !value.violations.every(
      (item) => isRecord(item) && typeof item.blockId === "string" && typeof item.claim === "string" && typeof item.reason === "string",
    ) ||
    !value.missingElements.every((item) => ["what", "who", "where", "when", "why", "how"].includes(String(item)))
  ) {
    throw new GeminiGenerationError("Auditor fakta mengembalikan struktur yang tidak valid.");
  }
  return value as unknown as ModelFactAuditResponse;
}

function apiKey(): string {
  const value = process.env.GEMINI_API_KEY?.trim();
  if (!value) throw new GeminiConfigurationError();
  return value;
}

async function callModel(
  systemInstruction: string,
  contents: string,
  schema: typeof DRAFT_RESPONSE_SCHEMA | typeof FACT_AUDIT_SCHEMA,
  temperature: number,
): Promise<string> {
  const client = new GoogleGenAI({ apiKey: apiKey() });
  try {
    const response = await client.models.generateContent({
      model: GEMINI_FLASH_MODEL,
      contents,
      config: {
        systemInstruction,
        temperature,
        maxOutputTokens: 6_144,
        responseMimeType: "application/json",
        responseJsonSchema: schema,
      },
    });
    if (!response.text) throw new GeminiGenerationError("Gemini tidak mengembalikan teks.");
    return response.text;
  } catch (error) {
    if (error instanceof GeminiGenerationError) throw error;
    if (error instanceof ApiError && error.status === 429) throw new GeminiRateLimitError({ cause: error });
    throw new GeminiGenerationError("Permintaan ke Gemini gagal. Silakan coba lagi.", { cause: error });
  }
}

async function requestDraft(
  contents: string,
  input: PressReleaseInput,
  warnings: string[],
): Promise<GeneratedPressRelease> {
  const text = await callModel(SYSTEM_PROMPT, contents, DRAFT_RESPONSE_SCHEMA, 0.2);
  return toGeneratedDraft(parseModelDraft(parseJson(text, "Gemini")), input, warnings);
}

async function auditDraft(
  input: PressReleaseInput,
  draft: GeneratedPressRelease,
): Promise<FactViolation[]> {
  const deterministic = validateDraftDeterministically(draft, input);
  const text = await callModel(
    FACT_AUDITOR_SYSTEM_PROMPT,
    buildFactAuditPrompt(input, draft),
    FACT_AUDIT_SCHEMA,
    0,
  );
  const audit = parseFactAudit(parseJson(text, "Auditor fakta"));
  const missing = audit.missingElements.map((key: ChecklistKey) => ({
    blockId: "checklist",
    claim: key,
    reason: `Unsur ${key.toUpperCase()} belum terwakili.`,
  }));
  return [...deterministic, ...audit.violations, ...missing];
}

export function parseGeneratedPressRelease(
  responseText: string,
  input: PressReleaseInput,
  warnings: string[] = [],
): GeneratedPressRelease {
  return toGeneratedDraft(parseModelDraft(parseJson(responseText, "Gemini")), input, warnings);
}

export async function generatePressRelease(
  input: PressReleaseInput,
  warnings: string[] = [],
): Promise<GeneratedPressRelease> {
  const firstDraft = await requestDraft(buildPressReleasePrompt(input), input, warnings);
  const firstViolations = await auditDraft(input, firstDraft);
  if (firstViolations.length === 0) {
    return { ...firstDraft, audit: { passed: true, repaired: false, violations: [] } };
  }

  const repaired = await requestDraft(
    buildRepairPrompt(input, firstDraft, firstViolations),
    input,
    warnings,
  );
  const finalViolations = await auditDraft(input, repaired);
  if (finalViolations.length > 0) throw new FactAuditError(finalViolations);
  return { ...repaired, audit: { passed: true, repaired: true, violations: [] } };
}
