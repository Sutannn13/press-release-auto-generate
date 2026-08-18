import {
  MAX_ARTICLE_BLOCKS,
  MAX_PARAGRAPH_BLOCKS,
  MIN_PARAGRAPH_BLOCKS,
  type ArticleBlock,
  type ChecklistItem,
  type FactViolation,
  type GeneratedPressRelease,
  type PressReleaseInput,
  type QuoteReview,
} from "./prompt";

export function normalizeForComparison(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("id-ID")
    .replace(/\bdianggep\b/gu, "dianggap")
    .replace(/\bterimakasih\b/gu, "terimakasih")
    .replace(/\b(\p{L}+)2\b/gu, "$1$1")
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

export function extractNumbers(value: string): string[] {
  return value.match(/(?<![\p{L}\p{N}])\p{N}+(?:[./-]\p{N}+)*(?![\p{L}\p{N}])/gu) ?? [];
}

function meaningfulTokens(value: string): Set<string> {
  const stopWords = new Set([
    "yang",
    "dan",
    "dengan",
    "untuk",
    "dalam",
    "pada",
    "dari",
    "kegiatan",
    "kementerian",
    "agama",
    "kota",
    "depok",
  ]);

  return new Set(
    value
      .normalize("NFKC")
      .toLocaleLowerCase("id-ID")
      .match(/[\p{L}\p{N}]+/gu)
      ?.filter((token) => token.length >= 4 && !stopWords.has(token)) ?? [],
  );
}

export function hasFactCoverage(text: string, fact: string, minimum = 0.55): boolean {
  if (normalizeForComparison(text).includes(normalizeForComparison(fact))) {
    return true;
  }

  const factTokens = meaningfulTokens(fact);
  if (factTokens.size === 0) return false;
  const textTokens = meaningfulTokens(text);
  let found = 0;
  factTokens.forEach((token) => {
    if (textTokens.has(token)) found += 1;
  });
  return found / factTokens.size >= minimum;
}

export function buildInputChecklist(input: Partial<PressReleaseInput>): ChecklistItem[] {
  const entries: Array<{
    key: ChecklistItem["key"];
    label: string;
    complete: boolean;
    detail: string;
  }> = [
    {
      key: "what",
      label: "What",
      complete: Boolean(input.nama_kegiatan?.trim() && input.jenis_kegiatan),
      detail: input.nama_kegiatan?.trim() || "Nama dan jenis kegiatan belum lengkap.",
    },
    {
      key: "who",
      label: "Who",
      complete: Boolean(input.penyelenggara?.trim() && input.peserta?.trim()),
      detail:
        [input.penyelenggara?.trim(), input.peserta?.trim()].filter(Boolean).join("; ") ||
        "Penyelenggara dan peserta belum lengkap.",
    },
    {
      key: "where",
      label: "Where",
      complete: Boolean(input.lokasi_lengkap?.trim() && input.lokasi_dateline?.trim()),
      detail: input.lokasi_lengkap?.trim() || "Lokasi belum lengkap.",
    },
    {
      key: "when",
      label: "When",
      complete: Boolean(input.tanggal?.trim()),
      detail: input.tanggal?.trim() || "Tanggal belum dipilih.",
    },
    {
      key: "why",
      label: "Why",
      complete: Boolean(input.tujuan?.trim()),
      detail: input.tujuan?.trim() || "Tujuan/latar belakang belum diisi.",
    },
    {
      key: "how",
      label: "How",
      complete: Boolean(input.urutan_kegiatan?.trim()),
      detail: input.urutan_kegiatan?.trim() || "Urutan kegiatan belum diisi.",
    },
  ];

  return entries.map((entry) => ({
    key: entry.key,
    label: entry.label,
    status: entry.complete ? "complete" : "missing",
    detail: entry.detail,
  }));
}

export function buildGeneratedChecklist(
  input: PressReleaseInput,
  blocks: ArticleBlock[],
): ChecklistItem[] {
  const paragraphText = blocks
    .filter((block) => block.type === "paragraph")
    .map((block) => block.text)
    .join("\n");
  const lead = blocks[0]?.type === "paragraph" ? blocks[0].text : "";
  const firstContent = blocks
    .filter((block) => block.type === "paragraph")
    .slice(0, 4)
    .map((block) => block.text)
    .join("\n");

  const checks = [
    {
      key: "what" as const,
      label: "What",
      ok: hasFactCoverage(lead, input.nama_kegiatan, 0.6),
      detail: input.nama_kegiatan,
    },
    {
      key: "who" as const,
      label: "Who",
      ok:
        hasFactCoverage(lead, input.penyelenggara, 0.5) &&
        hasFactCoverage(lead, input.peserta, 0.5),
      detail: `${input.penyelenggara}; ${input.peserta}`,
    },
    {
      key: "where" as const,
      label: "Where",
      ok: hasFactCoverage(lead, input.lokasi_lengkap, 0.6),
      detail: input.lokasi_lengkap,
    },
    {
      key: "when" as const,
      label: "When",
      ok: normalizeForComparison(lead).includes(normalizeForComparison(input.tanggal)),
      detail: input.tanggal,
    },
    {
      key: "why" as const,
      label: "Why",
      ok: hasFactCoverage(firstContent, input.tujuan, 0.45),
      detail: input.tujuan,
    },
    {
      key: "how" as const,
      label: "How",
      ok: hasFactCoverage(firstContent || paragraphText, input.urutan_kegiatan, 0.4),
      detail: input.urutan_kegiatan,
    },
  ];

  return checks.map((check) => ({
    key: check.key,
    label: check.label,
    status: check.ok ? "complete" : "missing",
    detail: check.ok ? check.detail : `${check.label} belum terwakili dengan jelas dalam draf.`,
  }));
}

function tokenSimilarity(left: string, right: string): number {
  const a = meaningfulTokens(left);
  const b = meaningfulTokens(right);
  if (a.size === 0 && b.size === 0) return 1;
  let intersection = 0;
  a.forEach((token) => {
    if (b.has(token)) intersection += 1;
  });
  return intersection / Math.max(a.size, b.size);
}

export function cleanedQuoteIsSafe(original: string, cleaned: string): boolean {
  const originalNumbers = extractNumbers(original).sort().join("|");
  const cleanedNumbers = extractNumbers(cleaned).sort().join("|");
  if (originalNumbers !== cleanedNumbers) return false;

  const negations = ["tidak", "jangan", "bukan", "belum", "tanpa"];
  const originalNormalized = normalizeForComparison(original);
  const cleanedNormalized = normalizeForComparison(cleaned);
  if (
    negations.some(
      (word) =>
        originalNormalized.includes(word) !== cleanedNormalized.includes(word),
    )
  ) {
    return false;
  }

  return tokenSimilarity(original, cleaned) >= 0.72;
}

export function selectedQuoteText(review: QuoteReview): string | null {
  if (!review.approved || !review.selected) return null;
  return review.selected === "original" ? review.original : review.cleaned;
}

function quotePunctuation(value: string): string {
  const trimmed = value.trim().replace(/^["“”']+|["“”']+$/gu, "");
  if (/[!?]$/u.test(trimmed)) return trimmed;
  return `${trimmed.replace(/[.,;:]+$/u, "")},`;
}

export function renderApprovedQuote(
  review: QuoteReview,
  attributionStyle: "full" | "pronoun",
): string | null {
  const selected = selectedQuoteText(review);
  if (!selected) return null;
  const attribution =
    attributionStyle === "pronoun"
      ? "ujarnya"
      : `ujar ${review.jabatan}, ${review.nama}`;
  return `"${quotePunctuation(selected)}" ${attribution}.`;
}

export function collectFactSummary(input: PressReleaseInput): string[] {
  const facts = [
    `Kegiatan: ${input.nama_kegiatan}`,
    `Jenis: ${input.jenis_kegiatan}`,
    `Tujuan: ${input.tujuan}`,
    `Penyelenggara: ${input.penyelenggara}`,
    `Peserta: ${input.peserta}`,
    input.jumlah_peserta === null ? "" : `Jumlah peserta: ${input.jumlah_peserta}`,
    `Lokasi: ${input.lokasi_lengkap}`,
    `Tanggal: ${input.tanggal}`,
    input.waktu ? `Waktu: ${input.waktu}` : "",
    `Urutan: ${input.urutan_kegiatan}`,
    input.hasil_kegiatan ? `Hasil: ${input.hasil_kegiatan}` : "",
    input.tindak_lanjut ? `Tindak lanjut: ${input.tindak_lanjut}` : "",
  ];
  return facts.filter(Boolean);
}

export function validateDraftDeterministically(
  draft: Pick<GeneratedPressRelease, "judul" | "blocks" | "quoteReviews">,
  input: PressReleaseInput,
  requireApproval = false,
): FactViolation[] {
  const violations: FactViolation[] = [];
  const { blocks, quoteReviews } = draft;
  const paragraphs = blocks.filter((block) => block.type === "paragraph");
  const bodyParagraphs = paragraphs.filter((block) => block.role === "body");
  if (blocks.length < MIN_PARAGRAPH_BLOCKS || blocks.length > MAX_ARTICLE_BLOCKS) {
    violations.push({
      blockId: "document",
      claim: `${blocks.length} blok`,
      reason: `Jumlah seluruh blok harus dalam batas ${MIN_PARAGRAPH_BLOCKS}–${MAX_ARTICLE_BLOCKS}.`,
    });
  }
  if (paragraphs.length < MIN_PARAGRAPH_BLOCKS || paragraphs.length > MAX_PARAGRAPH_BLOCKS) {
    violations.push({
      blockId: "document",
      claim: `${paragraphs.length} paragraf`,
      reason: `Artikel wajib memiliki ${MIN_PARAGRAPH_BLOCKS}–${MAX_PARAGRAPH_BLOCKS} paragraf faktual di luar kutipan.`,
    });
  }
  if (bodyParagraphs.length < MIN_PARAGRAPH_BLOCKS - 2) {
    violations.push({
      blockId: "document",
      claim: `${bodyParagraphs.length} paragraf isi`,
      reason: "Artikel memerlukan sedikitnya tiga paragraf isi dengan fungsi yang berbeda.",
    });
  }
  if (blocks[0]?.type !== "paragraph" || blocks[0].role !== "lead") {
    violations.push({ blockId: "document", claim: "Blok pertama", reason: "Blok pertama harus lead." });
  }
  const last = blocks.at(-1);
  if (last?.type !== "paragraph" || last.role !== "closing") {
    violations.push({ blockId: "document", claim: "Blok terakhir", reason: "Blok terakhir harus penutup." });
  }
  const firstQuoteIndex = blocks.findIndex((block) => block.type === "quote");
  if (firstQuoteIndex >= 0) {
    const paragraphCountBeforeQuote = blocks
      .slice(0, firstQuoteIndex)
      .filter((block) => block.type === "paragraph").length;
    if (paragraphCountBeforeQuote < 3) {
      violations.push({
        blockId: blocks[firstQuoteIndex].id,
        claim: "Posisi kutipan pertama",
        reason: "Kutipan pertama harus ditempatkan setelah lead dan sedikitnya dua paragraf isi awal.",
      });
    }
  }
  blocks.forEach((block, index) => {
    if (block.type === "quote" && blocks[index + 1]?.type === "quote") {
      violations.push({
        blockId: block.id,
        claim: "Dua kutipan berdampingan",
        reason: "Sisipkan paragraph/body faktual di antara dua quote block.",
      });
    }
    if (
      block.type === "paragraph" &&
      ((index > 0 && block.role === "lead") ||
        (index < blocks.length - 1 && block.role === "closing"))
    ) {
      violations.push({
        blockId: block.id,
        claim: block.role,
        reason: "Lead hanya boleh berada di awal dan closing hanya boleh berada di akhir.",
      });
    }
  });

  const sourceText = JSON.stringify(input);
  const unsupportedSlop: Array<[RegExp, string]> = [
    [/\bberlangsung (?:dengan )?lancar\b/iu, "berlangsung lancar"],
    [/\bsangat antusias\b/iu, "sangat antusias"],
    [/\bpenuh semangat\b/iu, "penuh semangat"],
    [/\bsukses digelar\b/iu, "sukses digelar"],
    [/\bsuasana (?:yang )?meriah\b/iu, "suasana meriah"],
    [/\bwujud nyata\b/iu, "wujud nyata"],
    [/\bkomitmen kuat\b/iu, "komitmen kuat"],
    [/\bmenjadi bukti\b/iu, "menjadi bukti"],
    [/\btidak hanya\b[^.!?]{0,180}\btetapi juga\b/iu, "tidak hanya ... tetapi juga"],
  ];
  paragraphs.forEach((block) => {
    const wordCount = block.text.match(/[\p{L}\p{N}]+/gu)?.length ?? 0;
    if (wordCount < 10) {
      violations.push({ blockId: block.id, claim: block.text, reason: "Paragraf terlalu tipis untuk berdiri sebagai gagasan tersendiri." });
    }
    if (/\s+[,.!?;:]/u.test(block.text) || /\.{3,}|[!?]{2,}/u.test(block.text)) {
      violations.push({ blockId: block.id, claim: block.text, reason: "Tanda baca atau spasi sebelum tanda baca tidak sesuai gaya editorial." });
    }
    if (block.role !== "lead" && block.text.includes("–")) {
      violations.push({ blockId: block.id, claim: "–", reason: "En dash hanya digunakan pada dateline lead." });
    }
    const sentences = block.text.split(/(?<=[.!?])\s+/u);
    if (sentences.some((sentence) => (sentence.match(/[\p{L}\p{N}]+/gu)?.length ?? 0) > 55)) {
      violations.push({ blockId: block.id, claim: block.text, reason: "Kalimat terlalu panjang; pecah agar tetap natural dan mudah dibaca." });
    }
    unsupportedSlop.forEach(([pattern, label]) => {
      if (pattern.test(block.text) && !pattern.test(sourceText)) {
        violations.push({ blockId: block.id, claim: label, reason: "Frasa klise/AI tidak didukung fakta input." });
      }
    });
  });
  for (let leftIndex = 0; leftIndex < paragraphs.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < paragraphs.length; rightIndex += 1) {
      const left = paragraphs[leftIndex];
      const right = paragraphs[rightIndex];
      const leftTokenCount = meaningfulTokens(left.text).size;
      const rightTokenCount = meaningfulTokens(right.text).size;
      if (
        Math.min(leftTokenCount, rightTokenCount) >= 8 &&
        tokenSimilarity(left.text, right.text) >= 0.78
      ) {
        violations.push({
          blockId: right.id,
          claim: right.text,
          reason: `Paragraf terlalu repetitif terhadap ${left.id}; gunakan fakta atau fokus yang berbeda.`,
        });
      }
    }
  }

  const expectedDateline = `${input.lokasi_dateline.toLocaleUpperCase("id-ID")} (KEMENAG) –`;
  if (
    blocks[0]?.type === "paragraph" &&
    !blocks[0].text.startsWith(expectedDateline)
  ) {
    violations.push({ blockId: blocks[0].id, claim: blocks[0].text, reason: `Lead harus dimulai "${expectedDateline}".` });
  }

  const checklist = buildGeneratedChecklist(input, blocks);
  checklist
    .filter((item) => item.status !== "complete")
    .forEach((item) =>
      violations.push({ blockId: "checklist", claim: item.label, reason: item.detail }),
    );

  const allText = [
    draft.judul,
    ...blocks.filter((block) => block.type === "paragraph").map((block) => block.text),
    ...quoteReviews.map((quote) => quote.cleaned),
  ].join("\n");
  const inputNumbers = new Set(extractNumbers(JSON.stringify(input)));
  extractNumbers(allText).forEach((number) => {
    if (!inputNumbers.has(number)) {
      violations.push({ blockId: "document", claim: number, reason: "Angka tidak terdapat pada data fakta." });
    }
  });

  const quoteById = new Map(input.kutipan.map((quote) => [quote.id, quote]));
  const references = blocks
    .filter((block) => block.type === "quote")
    .map((block) => block.quoteId);
  input.kutipan.forEach((quote) => {
    if (references.filter((id) => id === quote.id).length !== 1) {
      violations.push({ blockId: "document", claim: quote.id, reason: "Setiap kutipan input harus dirujuk tepat satu kali." });
    }
  });
  references.forEach((id) => {
    if (!quoteById.has(id)) {
      violations.push({ blockId: "document", claim: id, reason: "Quote block merujuk ID yang tidak dikenal." });
    }
  });

  quoteReviews.forEach((review) => {
    const source = quoteById.get(review.quoteId);
    if (!source || review.original !== source.isi || review.nama !== source.nama || review.jabatan !== source.jabatan) {
      violations.push({ blockId: review.quoteId, claim: review.original, reason: "Data kutipan asli atau narasumber berubah." });
      return;
    }
    if (!cleanedQuoteIsSafe(review.original, review.cleaned)) {
      violations.push({ blockId: review.quoteId, claim: review.cleaned, reason: "Versi rapih terlalu jauh dari kutipan asli." });
    }
    if (requireApproval && (!review.approved || !review.selected)) {
      violations.push({ blockId: review.quoteId, claim: "Kutipan belum disetujui", reason: "Pilih versi kutipan dan setujui sebelum export." });
    }
  });

  return violations;
}

export function normalizeTitleCapitalization(value: string): string {
  const taskWords = ["Dan", "Dengan", "Di", "Ke", "Dari", "Untuk", "Bagi", "Pada", "Dalam", "Yang"];
  return taskWords.reduce(
    (title, word) => title.replace(new RegExp(`\\s${word}\\s`, "gu"), ` ${word.toLocaleLowerCase("id-ID")} `),
    value.trim(),
  );
}
