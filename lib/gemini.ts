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
export const GEMINI_FALLBACK_MODEL = "gemini-3.5-flash-lite";

const GEMINI_MODEL_PATTERN = /^gemini-[a-z0-9.-]+$/u;
const RETRYABLE_API_STATUSES = new Set([408, 500, 502, 503, 504]);

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
  constructor(message = "Credential Gemini belum dikonfigurasi.") {
    super(message);
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

export class GeminiUnavailableError extends GeminiGenerationError {
  constructor(options?: ErrorOptions) {
    super("Layanan Gemini sedang sibuk. Silakan coba lagi beberapa saat lagi.", options);
    this.name = "GeminiUnavailableError";
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

interface GeminiCredential {
  key: string;
  label: "primary" | "backup-1" | "backup-2";
}

interface GeminiTarget extends GeminiCredential {
  model: string;
}

export interface GeminiRoutingInfo {
  credentialCount: number;
  primaryModel: string;
  fallbackModel: string;
  targetCount: number;
}

function optionalEnvironment(name: string): string | null {
  const value = process.env[name]?.trim();
  return value || null;
}

function configuredModel(name: "GEMINI_MODEL_PRIMARY" | "GEMINI_MODEL_FALLBACK", fallback: string): string {
  const value = optionalEnvironment(name) ?? fallback;
  if (!GEMINI_MODEL_PATTERN.test(value)) {
    throw new GeminiConfigurationError(`${name} tidak memiliki format model Gemini yang valid.`);
  }
  return value;
}

function configuredCredentials(): GeminiCredential[] {
  const values: Array<[GeminiCredential["label"], string | null]> = [
    ["primary", optionalEnvironment("GEMINI_API_KEY_PRIMARY") ?? optionalEnvironment("GEMINI_API_KEY")],
    ["backup-1", optionalEnvironment("GEMINI_API_KEY_BACKUP_1") ?? optionalEnvironment("GEMINI_API_KEY_BACKUP")],
    ["backup-2", optionalEnvironment("GEMINI_API_KEY_BACKUP_2")],
  ];
  const seen = new Set<string>();
  const credentials = values.flatMap(([label, key]) => {
    if (!key || seen.has(key)) return [];
    seen.add(key);
    return [{ key, label }];
  });
  if (credentials.length === 0) throw new GeminiConfigurationError();
  return credentials;
}

function configuredTargets(): GeminiTarget[] {
  const credentials = configuredCredentials();
  const primaryModel = configuredModel("GEMINI_MODEL_PRIMARY", GEMINI_FLASH_MODEL);
  const fallbackModel = configuredModel("GEMINI_MODEL_FALLBACK", GEMINI_FALLBACK_MODEL);
  const models = [...new Set([primaryModel, fallbackModel])];
  const primaryTargets = models.map((model) => ({ ...credentials[0], model }));
  const backupModel = models.at(-1) ?? primaryModel;
  return [
    ...primaryTargets,
    ...credentials.slice(1).map((credential) => ({ ...credential, model: backupModel })),
  ];
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

export function getGeminiRoutingInfo(): GeminiRoutingInfo {
  const targets = configuredTargets();
  return {
    credentialCount: new Set(targets.map((target) => target.label)).size,
    primaryModel: targets[0].model,
    fallbackModel: targets[1]?.label === "primary" ? targets[1].model : targets[0].model,
    targetCount: targets.length,
  };
}

async function callModel(
  systemInstruction: string,
  contents: string,
  schema: typeof DRAFT_RESPONSE_SCHEMA | typeof FACT_AUDIT_SCHEMA,
): Promise<string> {
  const targets = configuredTargets();
  let lastError: unknown;
  let rejectedCredential: GeminiCredential["label"] | null = null;

  for (let index = 0; index < targets.length; index += 1) {
    const target = targets[index];
    if (target.label === rejectedCredential) continue;
    const client = new GoogleGenAI({
      apiKey: target.key,
      httpOptions: {
        timeout: 45_000,
        retryOptions: {
          attempts: 1,
          initialDelay: 1,
          maxDelay: 4,
          expBase: 2,
          jitter: 0.5,
          httpStatusCodes: [408, 429, 500, 502, 503, 504],
        },
      },
    });
    try {
      const response = await client.models.generateContent({
        model: target.model,
        contents,
        config: {
          systemInstruction,
          maxOutputTokens: 6_144,
          responseMimeType: "application/json",
          responseJsonSchema: schema,
        },
      });
      if (!response.text) throw new GeminiGenerationError("Gemini tidak mengembalikan teks.");
      return response.text;
    } catch (error) {
      if (error instanceof GeminiGenerationError) throw error;
      lastError = error;
      if (isAbortError(error)) {
        const next = targets[index + 1];
        if (next?.label === target.label && next.model !== target.model) continue;
        throw new GeminiUnavailableError({ cause: error });
      }
      if (!(error instanceof ApiError)) break;

      if (error.status === 401 || error.status === 403) {
        rejectedCredential = target.label;
        continue;
      }
      if (error.status === 429) {
        const next = targets[index + 1];
        const mayTryAnotherModelInSameProject =
          target.label === "primary" &&
          next?.label === "primary" &&
          next.model !== target.model;
        if (mayTryAnotherModelInSameProject) continue;
        throw new GeminiRateLimitError({ cause: error });
      }
      if (RETRYABLE_API_STATUSES.has(error.status)) {
        const next = targets[index + 1];
        if (next?.label === target.label && next.model !== target.model) continue;
        throw new GeminiUnavailableError({ cause: error });
      }
      break;
    }
  }

  if (lastError instanceof ApiError && RETRYABLE_API_STATUSES.has(lastError.status)) {
    throw new GeminiUnavailableError({ cause: lastError });
  }
  if (isAbortError(lastError)) throw new GeminiUnavailableError({ cause: lastError });
  if (lastError instanceof ApiError && (lastError.status === 401 || lastError.status === 403)) {
    throw new GeminiConfigurationError("Semua credential Gemini ditolak. Periksa key dan akses project.");
  }
  throw new GeminiGenerationError("Permintaan ke Gemini gagal. Silakan coba lagi.", { cause: lastError });
}

async function requestDraft(
  contents: string,
  input: PressReleaseInput,
  warnings: string[],
): Promise<GeneratedPressRelease> {
  const text = await callModel(SYSTEM_PROMPT, contents, DRAFT_RESPONSE_SCHEMA);
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
