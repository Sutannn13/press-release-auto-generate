import {
  EVENT_TYPES,
  MAX_ARTICLE_BLOCKS,
  MIN_PARAGRAPH_BLOCKS,
  type ArticleBlock,
  type EventDetails,
  type EventType,
  type PersonInput,
  type PressReleaseInput,
  type QuoteInput,
  type QuoteReview,
} from "./prompt";
import {
  buildInputChecklist,
  validateDraftDeterministically,
} from "./article";
import { sanitizePlainText } from "./text-sanitize";
import type { DocxPhoto } from "./docx-builder";

export type PressReleasePhoto = DocxPhoto;

export interface ValidationIssue {
  field: string;
  message: string;
}

export type PressReleaseInputValidation =
  | { success: true; data: PressReleaseInput; warnings: string[] }
  | { success: false; issues: ValidationIssue[] };

export interface ExportDocxInput {
  version: 2;
  judul: string;
  blocks: ArticleBlock[];
  quoteReviews: QuoteReview[];
  sourceInput: PressReleaseInput;
  kontributor: string;
}

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
export const MAX_JSON_BODY_BYTES = 96 * 1024;
const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/u;
const DATELINE_PATTERN = /^[A-Z][A-Z.\s-]{1,48}$/u;
const DATE_PATTERN = /^(Senin|Selasa|Rabu|Kamis|Jumat|Sabtu|Minggu) \((\d{2})\/(\d{2})\/(\d{4})\)$/u;

const EVENT_DETAIL_KEYS: Array<keyof EventDetails> = [
  "pemateri",
  "poin_materi",
  "jenis_lomba",
  "hasil_pemenang",
  "urutan_prosesi",
  "makna_peringatan",
  "bentuk_layanan",
  "penerima_manfaat",
  "agenda",
  "kesepakatan",
  "detail_tambahan",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasLettersOrNumbers(value: string): boolean {
  return /[\p{L}\p{N}]/u.test(value);
}

function textInRange(value: unknown, min: number, max: number): value is string {
  return (
    typeof value === "string" &&
    value.trim().length >= min &&
    value.trim().length <= max &&
    hasLettersOrNumbers(value)
  );
}

function nullableText(value: unknown, max: number): value is string | null {
  return value === null || textInRange(value, 1, max);
}

function validId(value: unknown): value is string {
  return typeof value === "string" && ID_PATTERN.test(value);
}

function nullableInteger(value: unknown): value is number | null {
  return value === null || (Number.isInteger(value) && Number(value) >= 0 && Number(value) <= 1_000_000);
}

function validDateLabel(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = DATE_PATTERN.exec(value);
  if (!match) return false;
  const [, weekday, dayRaw, monthRaw, yearRaw] = match;
  const date = new Date(Number(yearRaw), Number(monthRaw) - 1, Number(dayRaw));
  if (
    date.getFullYear() !== Number(yearRaw) ||
    date.getMonth() !== Number(monthRaw) - 1 ||
    date.getDate() !== Number(dayRaw)
  ) {
    return false;
  }
  const actualWeekday = new Intl.DateTimeFormat("id-ID", { weekday: "long" }).format(date);
  return actualWeekday.toLocaleLowerCase("id-ID") === weekday.toLocaleLowerCase("id-ID");
}

function validPerson(value: unknown): value is PersonInput {
  return (
    isRecord(value) &&
    validId(value.id) &&
    textInRange(value.nama, 2, 150) &&
    textInRange(value.jabatan, 2, 200) &&
    textInRange(value.peran, 2, 150)
  );
}

function validQuote(value: unknown): value is QuoteInput {
  return (
    isRecord(value) &&
    validId(value.id) &&
    textInRange(value.nama, 2, 150) &&
    textInRange(value.jabatan, 2, 200) &&
    textInRange(value.isi, 4, 2_000)
  );
}

function validDetails(value: unknown): value is EventDetails {
  return (
    isRecord(value) &&
    EVENT_DETAIL_KEYS.every((key) => nullableText(value[key], 3_000))
  );
}

function addIssue(
  issues: ValidationIssue[],
  condition: boolean,
  field: string,
  message: string,
) {
  if (!condition) issues.push({ field, message });
}

function hasConcreteHow(value: string): boolean {
  if (value.trim().length < 45) return false;
  return /\b(diawali|dilanjutkan|kemudian|ditutup|menyampaikan|mengikuti|meliputi|berupa|sesi|materi|lomba|upacara|diskusi|prosesi|pelayanan|rapat|peninjauan|penyerahan)\b/iu.test(value);
}

function uniqueIds(values: Array<{ id: string }>): boolean {
  return new Set(values.map((value) => value.id)).size === values.length;
}

function trimNullable(value: string | null): string | null {
  return value === null ? null : value.trim();
}

function hasSupportingArticleFact(input: PressReleaseInput): boolean {
  return Boolean(
    input.tema ||
      input.jumlah_peserta !== null ||
      input.respons_peserta ||
      input.hasil_kegiatan ||
      input.tindak_lanjut ||
      input.pihak_terlibat.length > 0 ||
      input.kutipan.length > 0 ||
      EVENT_DETAIL_KEYS.some((key) => input.detail_kegiatan[key]),
  );
}

export function validatePressReleaseInput(value: unknown): PressReleaseInputValidation {
  if (!isRecord(value)) {
    return { success: false, issues: [{ field: "form", message: "Body harus berupa objek JSON." }] };
  }

  const issues: ValidationIssue[] = [];
  addIssue(issues, value.version === 2, "version", "Versi payload harus 2.");
  addIssue(issues, textInRange(value.nama_kegiatan, 3, 250), "nama_kegiatan", "Nama kegiatan wajib 3–250 karakter.");
  addIssue(issues, typeof value.jenis_kegiatan === "string" && EVENT_TYPES.includes(value.jenis_kegiatan as EventType), "jenis_kegiatan", "Pilih jenis kegiatan yang valid.");
  addIssue(issues, textInRange(value.tujuan, 20, 2_000), "tujuan", "Tujuan/latar belakang wajib minimal 20 karakter.");
  addIssue(issues, textInRange(value.penyelenggara, 3, 300), "penyelenggara", "Penyelenggara/unit kerja wajib diisi.");
  addIssue(issues, textInRange(value.peserta, 3, 500), "peserta", "Peserta wajib diisi.");
  addIssue(issues, nullableInteger(value.jumlah_peserta), "jumlah_peserta", "Jumlah peserta harus bilangan 0–1.000.000 atau kosong.");
  addIssue(issues, nullableText(value.tema, 500), "tema", "Tema maksimal 500 karakter.");
  addIssue(issues, Array.isArray(value.pihak_terlibat) && value.pihak_terlibat.length <= 10 && value.pihak_terlibat.every(validPerson), "pihak_terlibat", "Pihak yang hadir maksimal 10 dan setiap nama, jabatan, serta peran wajib lengkap.");
  addIssue(issues, textInRange(value.lokasi_lengkap, 3, 500), "lokasi_lengkap", "Lokasi lengkap wajib diisi.");
  addIssue(issues, typeof value.lokasi_dateline === "string" && DATELINE_PATTERN.test(value.lokasi_dateline.trim().toLocaleUpperCase("id-ID")), "lokasi_dateline", "Dateline harus berupa nama lokasi, maksimal 50 karakter.");
  addIssue(issues, validDateLabel(value.tanggal), "tanggal", "Tanggal atau nama hari tidak valid.");
  addIssue(issues, nullableText(value.waktu, 50), "waktu", "Waktu maksimal 50 karakter.");
  addIssue(issues, textInRange(value.urutan_kegiatan, 45, 4_000) && typeof value.urutan_kegiatan === "string" && hasConcreteHow(value.urutan_kegiatan), "urutan_kegiatan", "How harus menjelaskan urutan faktual minimal 45 karakter, bukan hanya ‘berjalan lancar’.");
  addIssue(issues, nullableText(value.respons_peserta, 1_500), "respons_peserta", "Respons peserta maksimal 1.500 karakter.");
  addIssue(issues, nullableText(value.hasil_kegiatan, 2_000), "hasil_kegiatan", "Hasil kegiatan maksimal 2.000 karakter.");
  addIssue(issues, nullableText(value.tindak_lanjut, 2_000), "tindak_lanjut", "Tindak lanjut maksimal 2.000 karakter.");
  addIssue(issues, validDetails(value.detail_kegiatan), "detail_kegiatan", "Detail kegiatan tidak valid atau terlalu panjang.");
  addIssue(issues, Array.isArray(value.kutipan) && value.kutipan.length <= 5 && value.kutipan.every(validQuote), "kutipan", "Kutipan maksimal 5; setiap kutipan harus memiliki ID, nama, jabatan, dan isi.");
  addIssue(issues, textInRange(value.kontributor, 2, 300), "kontributor", "Kontributor wajib diisi.");

  if (issues.length > 0) return { success: false, issues };

  const input: PressReleaseInput = {
    version: 2,
    nama_kegiatan: String(value.nama_kegiatan).trim(),
    jenis_kegiatan: value.jenis_kegiatan as EventType,
    tujuan: String(value.tujuan).trim(),
    penyelenggara: String(value.penyelenggara).trim(),
    peserta: String(value.peserta).trim(),
    jumlah_peserta: value.jumlah_peserta as number | null,
    tema: trimNullable(value.tema as string | null),
    pihak_terlibat: (value.pihak_terlibat as PersonInput[]).map((person) => ({
      id: person.id,
      nama: person.nama.trim(),
      jabatan: person.jabatan.trim(),
      peran: person.peran.trim(),
    })),
    lokasi_lengkap: String(value.lokasi_lengkap).trim(),
    lokasi_dateline: String(value.lokasi_dateline).trim().toLocaleUpperCase("id-ID"),
    tanggal: String(value.tanggal).trim(),
    waktu: trimNullable(value.waktu as string | null),
    urutan_kegiatan: String(value.urutan_kegiatan).trim(),
    respons_peserta: trimNullable(value.respons_peserta as string | null),
    hasil_kegiatan: trimNullable(value.hasil_kegiatan as string | null),
    tindak_lanjut: trimNullable(value.tindak_lanjut as string | null),
    detail_kegiatan: Object.fromEntries(
      EVENT_DETAIL_KEYS.map((key) => [key, trimNullable((value.detail_kegiatan as EventDetails)[key])]),
    ) as unknown as EventDetails,
    kutipan: (value.kutipan as QuoteInput[]).map((quote) => ({
      id: quote.id,
      nama: quote.nama.trim(),
      jabatan: quote.jabatan.trim(),
      isi: quote.isi.trim(),
    })),
    kontributor: String(value.kontributor).trim(),
  };

  if (!uniqueIds([...input.pihak_terlibat, ...input.kutipan])) {
    return { success: false, issues: [{ field: "id", message: "ID pihak/kutipan harus unik." }] };
  }
  if (!hasSupportingArticleFact(input)) {
    return {
      success: false,
      issues: [{
        field: "detail_pendukung",
        message: "Untuk menyusun minimal lima paragraf tanpa filler, isi sedikitnya satu detail pendukung: tema, jumlah/respons peserta, hasil, tindak lanjut, pihak hadir, kutipan, atau detail khusus kegiatan.",
      }],
    };
  }

  const warnings: string[] = [];
  if (input.kutipan.length === 0) warnings.push("Draf tidak memiliki kutipan narasumber resmi.");
  if (input.jumlah_peserta === null) warnings.push("Jumlah peserta belum dicantumkan.");
  if (input.pihak_terlibat.length === 0) warnings.push("Belum ada pejabat atau pihak terlibat yang dicantumkan.");
  if (!input.hasil_kegiatan) warnings.push("Hasil kegiatan belum dicantumkan; AI tidak akan mengarang hasil.");
  if (!input.tindak_lanjut) warnings.push("Tindak lanjut belum dicantumkan.");

  const detailWarnings: Partial<Record<EventType, [keyof EventDetails, string][]>> = {
    bimbingan: [["pemateri", "Pemateri belum dicantumkan."], ["poin_materi", "Poin materi belum dicantumkan."]],
    lomba: [["jenis_lomba", "Jenis lomba belum dicantumkan."], ["hasil_pemenang", "Hasil/pemenang belum tersedia."]],
    upacara: [["urutan_prosesi", "Urutan prosesi khusus belum dicantumkan."], ["makna_peringatan", "Makna peringatan belum dicantumkan."]],
    pelayanan: [["bentuk_layanan", "Bentuk layanan belum dicantumkan."], ["penerima_manfaat", "Penerima manfaat belum dicantumkan."]],
    rapat: [["agenda", "Agenda rapat/kunjungan belum dicantumkan."], ["kesepakatan", "Kesepakatan belum dicantumkan."]],
    lainnya: [["detail_tambahan", "Detail tambahan belum dicantumkan."]],
  };
  detailWarnings[input.jenis_kegiatan]?.forEach(([key, message]) => {
    if (!input.detail_kegiatan[key]) warnings.push(message);
  });

  return { success: true, data: input, warnings };
}

export function parsePressReleaseInput(value: unknown): PressReleaseInput | null {
  const result = validatePressReleaseInput(value);
  return result.success ? result.data : null;
}

function validQuoteReview(value: unknown): value is QuoteReview {
  return (
    isRecord(value) &&
    validId(value.quoteId) &&
    textInRange(value.nama, 2, 150) &&
    textInRange(value.jabatan, 2, 200) &&
    textInRange(value.original, 4, 2_000) &&
    textInRange(value.cleaned, 4, 2_000) &&
    (value.selected === "original" || value.selected === "cleaned") &&
    value.approved === true
  );
}

function parseBlock(value: unknown, index: number): ArticleBlock | null {
  if (!isRecord(value) || !validId(value.id) || (value.type !== "paragraph" && value.type !== "quote")) return null;
  if (value.type === "paragraph") {
    if ((value.role !== "lead" && value.role !== "body" && value.role !== "closing") || !textInRange(value.text, 3, 4_000)) return null;
    return { id: value.id, type: "paragraph", role: value.role, text: sanitizePlainText(value.text) };
  }
  if (!validId(value.quoteId) || (value.attributionStyle !== "full" && value.attributionStyle !== "pronoun")) return null;
  return { id: value.id || `block-${index + 1}`, type: "quote", quoteId: value.quoteId, attributionStyle: value.attributionStyle };
}

export function parseExportDocxInput(value: unknown): ExportDocxInput | null {
  if (
    !isRecord(value) ||
    value.version !== 2 ||
    !textInRange(value.judul, 3, 300) ||
    !Array.isArray(value.blocks) ||
    value.blocks.length < MIN_PARAGRAPH_BLOCKS ||
    value.blocks.length > MAX_ARTICLE_BLOCKS ||
    !Array.isArray(value.quoteReviews) ||
    !value.quoteReviews.every(validQuoteReview) ||
    !textInRange(value.kontributor, 2, 300)
  ) {
    return null;
  }

  const sourceResult = validatePressReleaseInput(value.sourceInput);
  if (!sourceResult.success) return null;
  const blocks = value.blocks.map(parseBlock);
  if (blocks.some((block) => block === null)) return null;
  const parsedBlocks = blocks as ArticleBlock[];
  const quoteReviews = (value.quoteReviews as QuoteReview[]).map((review) => ({
    ...review,
    nama: sanitizePlainText(review.nama),
    jabatan: sanitizePlainText(review.jabatan),
    original: sanitizePlainText(review.original),
    cleaned: sanitizePlainText(review.cleaned),
  }));
  const candidate = {
    judul: sanitizePlainText(value.judul),
    blocks: parsedBlocks,
    quoteReviews,
  };
  if (validateDraftDeterministically(candidate, sourceResult.data, true).length > 0) return null;
  if (/\bKontributor\s*:/iu.test([candidate.judul, ...parsedBlocks.filter((block) => block.type === "paragraph").map((block) => block.text)].join("\n"))) return null;
  if (buildInputChecklist(sourceResult.data).some((item) => item.status !== "complete")) return null;

  return {
    version: 2,
    judul: candidate.judul,
    blocks: candidate.blocks,
    quoteReviews: candidate.quoteReviews,
    sourceInput: sourceResult.data,
    kontributor: sanitizePlainText(value.kontributor),
  };
}

function detectPngSize(bytes: Uint8Array): { w: number; h: number } | null {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length < 24 || !signature.every((byte, index) => bytes[index] === byte)) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { w: view.getUint32(16), h: view.getUint32(20) };
}

function detectJpegSize(bytes: Uint8Array): { w: number; h: number } | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) return null;
    const marker = bytes[offset + 1];
    if (marker === 0xd8 || marker === 0xd9) { offset += 2; continue; }
    const segmentLength = view.getUint16(offset + 2);
    if (segmentLength < 2 || offset + 2 + segmentLength > bytes.length) return null;
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return { w: view.getUint16(offset + 7), h: view.getUint16(offset + 5) };
    }
    offset += 2 + segmentLength;
  }
  return null;
}

export async function parseImageFile(file: File): Promise<PressReleasePhoto | string> {
  if (file.size === 0) return "Foto kegiatan tidak boleh kosong.";
  if (file.size > MAX_PHOTO_BYTES) return "Ukuran foto maksimal 5 MB.";
  const type = file.type === "image/jpeg" ? "jpg" : file.type === "image/png" ? "png" : null;
  if (!type) return "Format foto harus JPG atau PNG.";
  const data = new Uint8Array(await file.arrayBuffer());
  const size = type === "png" ? detectPngSize(data) : detectJpegSize(data);
  if (!size || size.w <= 0 || size.h <= 0) return "File foto rusak atau bukan JPG/PNG valid.";
  return { data, type, pixelWidth: size.w, pixelHeight: size.h };
}
