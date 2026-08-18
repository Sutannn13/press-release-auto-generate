// Strip artefak markdown ("AI slop") dari teks plain yang ditujukan untuk body docx
// press release Kemenag. Domain ini tidak memakai bold/italic/list-marker/horizontal-rule
// secara markdown — italic dikunci via docx run (ARCHITECTURE.md §4), bold dilarang spec,
// jadi karakter marker (* _ ` ~ #) tak pernah legit di narasi final.
// minimal: satu fungsi strip; upgrade ke parser bila markdown bersarang muncul nyata.
export function sanitizePlainText(input: string): string {
  return input
    .replace(/```[\s\S]*?```/g, "") // blok kode fenced
    .replace(/`([^`]*)`/g, "$1") // inline code `x` -> x
    .replace(/^\s*[-*=]{3,}\s*$/gm, "") // horizontal rule (strip besar: ---/***/===)
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1") // image ![alt](url) -> alt
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1") // link [text](url) -> text
    .replace(/^\s{0,3}#{1,6}\s+/gm, "") // heading ATX (## )
    .replace(/^\s{0,3}>\s?/gm, "") // blockquote (>)
    .replace(/^\s{0,3}([-*+]|\d+\.)\s+/gm, "") // list marker (- / 1. )
    .replace(/={2,}/g, "") // setext heading === / ==
    .replace(/-{2,}/g, "") // markdown em/en-dash substitute (--/---); hyphen tunggal aman
    .replace(/[`*_~#]/g, "") // sisa karakter marker (tak legit di domain)
    .replace(/\r?\n/g, " ") // gabung baris dalam satu paragraf (cegah \n di TextRun)
    .replace(/[ \t]{2,}/g, " ") // rapikan spasi ganda
    .trim();
}
