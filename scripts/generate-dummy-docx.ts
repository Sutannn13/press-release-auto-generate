import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { buildPressReleaseDocx } from "../lib/docx-builder";
import type { ArticleBlock, QuoteReview } from "../lib/prompt";
import { GEBER_INPUT } from "./v2-fixtures";

export const GEBER_BLOCKS: ArticleBlock[] = [
  {
    id: "block-1",
    type: "paragraph",
    role: "lead",
    text: "CILODONG (KEMENAG) – Kantor Kementerian Agama Kota Depok menyelenggarakan Ziarah Maqburah sebagai rangkaian lanjutan GEBER MAS bersama jajaran Kementerian Agama Kota Depok di Taman Makam Pahlawan (TMP) Kalimulya, Kota Depok, Senin (10/08/2026).",
  },
  {
    id: "block-2",
    type: "paragraph",
    role: "body",
    text: "Ziarah Maqburah bertujuan mengenang dan menghormati jasa para pahlawan serta memperkuat kepedulian dan semangat kebangsaan. Peringatan ini juga memaknai upaya meneruskan semangat pengabdian.",
  },
  {
    id: "block-3",
    type: "paragraph",
    role: "body",
    text: "Jajaran Kementerian Agama Kota Depok mengikuti upacara penghormatan kepada para pahlawan. Rangkaian kemudian dilanjutkan dengan prosesi tabur bunga sebagai penghargaan atas jasa dan pengorbanan para pejuang bangsa.",
  },
  { id: "block-4", type: "quote", quoteId: "quote-dede-1", attributionStyle: "full" },
  {
    id: "block-5",
    type: "paragraph",
    role: "body",
    text: "H. Dede Supriatna menekankan pentingnya meneruskan semangat pengabdian melalui kerja yang berintegritas dan pelayanan yang baik.",
  },
  { id: "block-6", type: "quote", quoteId: "quote-dede-2", attributionStyle: "pronoun" },
  {
    id: "block-7",
    type: "paragraph",
    role: "closing",
    text: "Upacara ziarah dan tabur bunga di TMP Kalimulya berlangsung khidmat bersama jajaran Kementerian Agama Kota Depok.",
  },
];

export const APPROVED_GEBER_QUOTES: QuoteReview[] = GEBER_INPUT.kutipan.map((quote) => ({
  quoteId: quote.id,
  nama: quote.nama,
  jabatan: quote.jabatan,
  original: quote.isi,
  cleaned: quote.isi,
  selected: "original",
  approved: true,
}));

const DUMMY_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAKAAAABaCAIAAACwpMoFAAAAoklEQVR42u3RQREAAAjDsEmaNPy/8AG5q4ImnepwsQCwAAuwAAuwAAswYAEWYAEWYAEWYMACLMACLMACLMACDFiABViABViABRiwAAuwAAuwAAswYAEWYAEWYAEWYAEGLMACLMACLMACDFiABViABViABRiwC4AFWIAFWIAFWIABC7AAC7AAC7AAAxZgARZgARZgARZgwAIswAIswAIswL+AF0XrtqR02gDrAAAAAElFTkSuQmCC";

export async function main() {
  const outputDirectory = path.resolve("artifacts/phase-2");
  const outputPath = path.join(outputDirectory, "kemenag-depok-press-release-dummy.docx");
  const documentBuffer = await buildPressReleaseDocx(
    {
      judul: "Kemenag Depok Lanjutkan GEBER MAS dengan Ziarah dan Tabur Bunga di TMP Kalimulya",
      blocks: GEBER_BLOCKS,
      quoteReviews: APPROVED_GEBER_QUOTES,
      kontributor: "Hari",
    },
    {
      data: Buffer.from(DUMMY_PNG_BASE64, "base64"),
      type: "png",
      pixelWidth: 160,
      pixelHeight: 90,
    },
  );
  await mkdir(outputDirectory, { recursive: true });
  await writeFile(outputPath, documentBuffer);
  console.log(`DOCX V2 dibuat: ${outputPath}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
