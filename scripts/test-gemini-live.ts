import assert from "node:assert/strict";
import { generatePressRelease } from "../lib/gemini";
import { validateDraftDeterministically } from "../lib/article";
import { MAX_ARTICLE_BLOCKS, MAX_PARAGRAPH_BLOCKS, MIN_PARAGRAPH_BLOCKS } from "../lib/prompt";
import { validatePressReleaseInput } from "../lib/validation";
import { BRUS_INPUT, GEBER_INPUT, LOMBA_INPUT } from "./v2-fixtures";

async function main() {
  const fixtures = [
    ["BRUS", BRUS_INPUT],
    ["LOMBA", LOMBA_INPUT],
    ["GEBER", GEBER_INPUT],
  ] as const;
  const selectedNames = new Set(process.argv.slice(2).map((value) => value.toLocaleUpperCase("id-ID")));
  const selectedFixtures = selectedNames.size > 0
    ? fixtures.filter(([name]) => selectedNames.has(name))
    : fixtures;
  assert.ok(selectedFixtures.length > 0, "Nama fixture live test tidak dikenal.");

  for (const [name, rawInput] of selectedFixtures) {
    const validation = validatePressReleaseInput(rawInput);
    assert.equal(validation.success, true);
    if (!validation.success) continue;
    const generated = await generatePressRelease(validation.data, validation.warnings);
    assert.equal(generated.audit.passed, true);
    assert.deepEqual(validateDraftDeterministically(generated, validation.data), []);
    const paragraphCount = generated.blocks.filter((block) => block.type === "paragraph").length;
    assert.ok(paragraphCount >= MIN_PARAGRAPH_BLOCKS && paragraphCount <= MAX_PARAGRAPH_BLOCKS);
    assert.ok(generated.blocks.length <= MAX_ARTICLE_BLOCKS);
    assert.equal(generated.blocks[0].type, "paragraph");
    assert.equal(generated.blocks.at(-1)?.type, "paragraph");
    if (name === "GEBER") {
      const types = generated.blocks.map((block) => block.type);
      const firstQuote = types.indexOf("quote");
      const secondQuote = types.indexOf("quote", firstQuote + 1);
      assert.ok(firstQuote >= 0 && secondQuote > firstQuote);
      assert.ok(types.slice(firstQuote + 1, secondQuote).includes("paragraph"));
    }
    console.log(`${name}: ${paragraphCount} paragraf/${generated.blocks.length} blok, repaired=${generated.audit.repaired}`);
  }

  console.log(`${selectedFixtures.length} live smoke test Gemini V2 lulus.`);
}

main().catch((error: unknown) => {
  const rawViolations = (error as { violations?: unknown })?.violations;
  const violations = Array.isArray(rawViolations)
    ? rawViolations.slice(0, 12).map((violation) => {
      const item = violation as { blockId?: unknown; claim?: unknown; reason?: unknown };
      return {
        blockId: String(item.blockId ?? "document").slice(0, 80),
        claim: String(item.claim ?? "").slice(0, 180),
        reason: String(item.reason ?? "").slice(0, 240),
      };
    })
    : [];
  const chain: Array<{ name: string; status: unknown; code: unknown; message: string }> = [];
  let current: unknown = error;
  for (let index = 0; index < 5 && current; index += 1) {
    const item = current as { name?: unknown; status?: unknown; code?: unknown; message?: unknown; cause?: unknown };
    chain.push({
      name: typeof item.name === "string" ? item.name : "Error",
      status: item.status ?? null,
      code: item.code ?? null,
      message: String(item.message ?? "")
        .replace(/[A-Za-z0-9_-]{30,}/gu, "[REDACTED]")
        .slice(0, 300),
    });
    current = item.cause;
  }
  console.error(JSON.stringify({ errorChain: chain, violations }, null, 2));
  process.exitCode = 1;
});
