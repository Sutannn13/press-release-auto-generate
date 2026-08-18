import {
  AlignmentType,
  Document,
  ImageRun,
  LineRuleType,
  Packer,
  PageOrientation,
  Paragraph,
  TextRun,
} from "docx";
import { renderApprovedQuote } from "./article";
import { sanitizePlainText } from "./text-sanitize";
import type { ArticleBlock, QuoteReview } from "./prompt";

export interface DocxPhoto {
  data: Uint8Array | ArrayBuffer;
  type: "jpg" | "png";
  pixelWidth: number;
  pixelHeight: number;
}

export interface PressReleaseDocumentData {
  judul: string;
  blocks: ArticleBlock[];
  quoteReviews: QuoteReview[];
  kontributor: string;
}

const DOCUMENT_FONT = "Calibri";
const DOCUMENT_FONT_SIZE = 24;
const PARAGRAPH_SPACING = {
  line: 240,
  lineRule: LineRuleType.AUTO,
  before: 0,
  after: 160,
} as const;

const PIXELS_PER_CM = 96 / 2.54;
const PHOTO_MAX_WIDTH_PX = Math.round(12 * PIXELS_PER_CM);
const PHOTO_MAX_HEIGHT_PX = Math.round(20 * PIXELS_PER_CM);

export function calculatePhotoTransformation(
  pixelWidth: number,
  pixelHeight: number,
): { width: number; height: number } {
  if (pixelWidth <= 0 || pixelHeight <= 0) throw new Error("Dimensi foto tidak valid.");
  const scale = Math.min(
    PHOTO_MAX_WIDTH_PX / pixelWidth,
    PHOTO_MAX_HEIGHT_PX / pixelHeight,
  );
  return {
    width: Math.max(1, Math.round(pixelWidth * scale)),
    height: Math.max(1, Math.round(pixelHeight * scale)),
  };
}

function createTextParagraph(text: string, italics = false): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: PARAGRAPH_SPACING,
    children: [
      new TextRun({
        text: sanitizePlainText(text),
        font: DOCUMENT_FONT,
        size: DOCUMENT_FONT_SIZE,
        ...(italics ? { italics: true } : {}),
      }),
    ],
  });
}

function createPhotoParagraph(foto: DocxPhoto): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: PARAGRAPH_SPACING,
    children: [
      new ImageRun({
        data: foto.data,
        type: foto.type,
        transformation: calculatePhotoTransformation(foto.pixelWidth, foto.pixelHeight),
      }),
    ],
  });
}

function createContentParagraphs(
  blocks: ArticleBlock[],
  quoteReviews: QuoteReview[],
): Paragraph[] {
  const reviews = new Map(quoteReviews.map((review) => [review.quoteId, review]));
  return blocks.map((block) => {
    if (block.type === "paragraph") return createTextParagraph(block.text);
    const review = reviews.get(block.quoteId);
    const rendered = review
      ? renderApprovedQuote(review, block.attributionStyle)
      : null;
    if (!rendered) throw new Error(`Kutipan ${block.quoteId} belum disetujui.`);
    return createTextParagraph(rendered, true);
  });
}

export async function buildPressReleaseDocx(
  data: PressReleaseDocumentData,
  foto: DocxPhoto,
): Promise<Buffer> {
  const document = new Document({
    styles: {
      default: {
        document: { run: { font: DOCUMENT_FONT, size: DOCUMENT_FONT_SIZE } },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: {
              width: 11906,
              height: 16838,
              orientation: PageOrientation.PORTRAIT,
            },
            margin: {
              top: 1378,
              bottom: 278,
              left: 1418,
              right: 1418,
              gutter: 0,
            },
          },
        },
        children: [
          createTextParagraph(data.judul),
          createPhotoParagraph(foto),
          ...createContentParagraphs(data.blocks, data.quoteReviews),
          createTextParagraph(`Kontributor : ${data.kontributor}`),
        ],
      },
    ],
  });
  return Packer.toBuffer(document);
}
