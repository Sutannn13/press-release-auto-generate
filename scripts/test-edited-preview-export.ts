import assert from "node:assert/strict";
import { buildPressReleaseDocx } from "../lib/docx-builder";
import { APPROVED_GEBER_QUOTES, GEBER_BLOCKS } from "./generate-dummy-docx";

async function main() {
  const edited = GEBER_BLOCKS.map((block) =>
    block.id === "block-5" && block.type === "paragraph"
      ? { ...block, text: `${block.text} PARAGRAF-EDIT-TERSIMPAN` }
      : block,
  );
  const bytes = await buildPressReleaseDocx(
    {
      judul: "Judul hasil review",
      blocks: edited,
      quoteReviews: APPROVED_GEBER_QUOTES,
      kontributor: "Kontributor Uji",
    },
    {
      data: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64"),
      type: "png",
      pixelWidth: 1,
      pixelHeight: 1,
    },
  );
  assert.equal(String.fromCharCode(...bytes.subarray(0, 2)), "PK");
  assert.ok(bytes.length > 1_000);
  console.log("Export preview V2 yang diedit lulus.");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
