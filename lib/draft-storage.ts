import type { GeneratedPressRelease, PressReleaseInput } from "./prompt";

export const DRAFT_STORAGE_KEY = "kemenag-press-release-v2-draft-v3";
export const DRAFT_SCHEMA_VERSION = 3;
export const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1_000;

export interface StoredDraft<TForm = unknown> {
  schema: 3;
  savedAt: number;
  form: TForm;
  preview: GeneratedPressRelease | null;
  sourceInput: PressReleaseInput | null;
  stale: boolean;
}

export function serializeDraft<TForm>(draft: Omit<StoredDraft<TForm>, "schema" | "savedAt">): string {
  return JSON.stringify({ schema: DRAFT_SCHEMA_VERSION, savedAt: Date.now(), ...draft });
}

export function parseStoredDraft<TForm>(raw: string, now = Date.now()): StoredDraft<TForm> | null {
  try {
    const value = JSON.parse(raw) as Partial<StoredDraft<TForm>>;
    if (
      value.schema !== DRAFT_SCHEMA_VERSION ||
      typeof value.savedAt !== "number" ||
      now - value.savedAt > DRAFT_TTL_MS ||
      !value.form ||
      typeof value.stale !== "boolean"
    ) {
      return null;
    }
    return value as StoredDraft<TForm>;
  } catch {
    return null;
  }
}
