import assert from "node:assert/strict";
import { sanitizePlainText } from "../lib/text-sanitize";
import { calculatePhotoTransformation } from "../lib/docx-builder";
import { validatePressReleaseInput } from "../lib/validation";
import { BRUS_INPUT, emptyDetails } from "./v2-fixtures";

assert.equal(sanitizePlainText("A --- B"), "A B");
assert.equal(sanitizePlainText("anak-anak"), "anak-anak");
assert.equal(validatePressReleaseInput(BRUS_INPUT).success, true);
assert.equal(validatePressReleaseInput({ ...BRUS_INPUT, urutan_kegiatan: "Kegiatan berjalan lancar." }).success, false);
const sparseInput = validatePressReleaseInput({
  ...BRUS_INPUT,
  jumlah_peserta: null,
  tema: null,
  pihak_terlibat: [],
  respons_peserta: null,
  hasil_kegiatan: null,
  tindak_lanjut: null,
  detail_kegiatan: emptyDetails(),
  kutipan: [],
});
assert.equal(sparseInput.success, false);
if (!sparseInput.success) {
  assert.ok(sparseInput.issues.some((issue) => issue.field === "detail_pendukung"));
}

const landscape = calculatePhotoTransformation(1600, 900);
assert.ok(Math.abs(landscape.width / landscape.height - 1600 / 900) < 0.01);
const portrait = calculatePhotoTransformation(900, 2400);
assert.ok(Math.abs(portrait.width / portrait.height - 900 / 2400) < 0.01);

console.log("Guard input, sanitasi, dan rasio foto V2 lulus.");
