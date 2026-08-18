# ARCHITECTURE — Kemenag Depok Auto Press Release Generator

## 1. Keputusan Interface: Next.js Web Form

Ada 3 opsi yang gw timbang:

| Opsi | Plus | Minus |
|---|---|---|
| **Next.js web form** ✅ | Cocok stack lo (reuse skill Public Insight), deploy gratis di Vercel, bisa diakses dari HP/laptop mana aja, gampang dipakai kolega Humas lain | Perlu bikin UI form (tapi simpel, 1 halaman) |
| CLI script lokal | Paling cepat dibikin, no hosting | Cuma bisa dipakai di laptop lo, kolega lain nggak bisa akses |
| Discord bot | Fit sama kalimat "suruh ai/bot" & lo udah punya server Discord | Bot butuh proses yang nyala terus (persistent connection) — nggak cocok di Vercel serverless, butuh hosting terpisah (Railway/VPS) yang nambah kompleksitas buat value yang sama aja |

**Keputusan: Next.js web form.** Kalau nanti kerasa kurang praktis, command Discord bisa ditambah belakangan sebagai "alternate trigger" yang manggil API yang sama — jadi nggak sia-sia.

## 2. Tech Stack

| Layer | Pilihan | Kenapa |
|---|---|---|
| Framework | Next.js 16.3+ (App Router) | Rilis aman yang memperbaiki advisory dependency dan memakai `proxy.ts` untuk boundary jaringan |
| AI content generation | Gemini API — model tier **Flash** (bukan Pro) | Free tier Flash punya kuota harian jauh lebih besar dari Pro, dan task ini (nulis ulang narasi dari struktur, bukan reasoning berat) nggak butuh Pro. ⚠️ Cek model ID terbaru di [ai.google.dev/pricing](https://ai.google.dev/pricing) pas mulai build — lineup Gemini sering ganti nama (2.5 Flash / 3 Flash / Flash-Lite dst), yang penting ambil tier "Flash", bukan "Pro" |
| Docx generation | npm package `docx` (MIT, gratis, sudah dipakai internal Anthropic juga) | Full kontrol margin/font/spacing/image lewat kode, nggak bergantung ke fitur berbayar (docxtemplater versi gratis nggak support auto-embed gambar — fitur itu ada di paid add-on mereka. Karena foto adalah elemen wajib di format Kemenag, `docx` library lebih pas) |
| Hosting | Vercel (free tier) | Sama kayak Public Insight |
| Auth | Password bersama + JWT cookie 8 jam (`jose`) | `proxy.ts` memberi redirect cepat dan setiap route mengulangi verifikasi sesi sebagai boundary keamanan |
| Rate-limit | Upstash Redis REST | Login 5/15 menit/IP, generate 20/jam/sesi+IP dan 100/hari global, export 60/jam/sesi+IP |
| Database | **Tidak ada di V2** (stateless) | Nggak butuh — generate & download langsung. Kalau nanti mau history/riwayat (§10 PRD), baru tambah Neon Postgres, dan bisa reuse skema dari Public Insight |

## 3. Kenapa Programmatic (`docx` lib), Bukan Template-Fill

Dua pendekatan bikin docx:
- **A. Template-fill** (isi placeholder di file Word yang udah diformat) — pakai `docxtemplater`
- **B. Programmatic** (bangun dokumen dari kode, atur margin/font/dst lewat config) — pakai `docx`

Gw cross-check langsung ke file `Kemenag_Depok_Gelar_BRUS.docx` yang lo upload (bukan cuma nebak dari screenshot), dan nemu foto kegiatan itu WAJIB ada di setiap artikel, posisinya center, tepat di bawah judul. `docxtemplater` versi gratis nggak bisa auto-taruh gambar (itu fitur add-on berbayar mereka). `docx` (library terpisah, gratis selamanya, MIT license) punya `ImageRun` bawaan buat ini. Jadi **opsi B** yang dipilih — sedikit lebih banyak kode di awal, tapi kontrol penuh dan nggak ada dependency berbayar.

## 4. Spesifikasi Format Dokumen (Ground Truth, dari File Asli)

Ini bukan dari screenshot — ini diambil langsung dari XML internal file `Kemenag_Depok_Gelar_BRUS.docx` yang lo upload, jadi presisi 100%:

### Page & Margin

| Setting | Nilai | Dalam kode (`docx` lib, satuan twip/DXA, 1 cm = 567 twip) |
|---|---|---|
| Ukuran kertas | A4 Portrait | `width: 11906, height: 16838` |
| Margin atas | 2,43 cm | `top: 1378` |
| Margin bawah | 0,49 cm | `bottom: 278` |
| Margin kiri | 2,5 cm | `left: 1418` |
| Margin kanan | 2,5 cm | `right: 1418` |
| Gutter | 0 | `gutter: 0` |

> Catatan: margin bawah 0,49 cm itu memang sekecil itu di file asli lo (bukan typo) — konsisten di file yang gw cek. Kalau ternyata itu nggak sengaja pas ngedrag di Word, kasih tau, gampang diganti satu angka doang di config.

### Font & Paragraf

| Setting | Nilai |
|---|---|
| Font | Calibri |
| Ukuran | 12pt (`size: 24` dalam half-points, satuan yang dipakai library `docx`) |
| Alignment body & judul | Justify (rata kiri-kanan) |
| Alignment foto | Center |
| Line spacing | Single (1.0) |
| Spasi setelah paragraf | 8pt |
| Spasi sebelum paragraf | 0pt |
| Kutipan narasumber | Italic, tetap justify |
| Bold | Tidak dipakai sama sekali (judul pun reguler, bukan bold) |

> Penting: di file asli, line spacing & spacing-after itu **nggak di-set eksplisit** — dia ngikut default Word yang beda-beda tergantung versi/template Word siapa yang bikin file. Ini kenapa hasilnya bisa keliatan "hampir 1.0 tapi nggak persis". Buat automation, kita **kunci eksplisit** ke single + 8pt-after di kode, biar hasilnya selalu identik nggak peduli versi Word siapapun yang buka.

### Struktur Dokumen (urutan paragraf)

```
1. Judul       — reguler (bukan bold/besar), justify
2. Foto        — center, di bawah judul langsung
3. Paragraf pembuka (dateline + 5W1H) — justify
4. Lima sampai delapan paragraf faktual: satu lead, sedikitnya tiga body dengan fungsi berbeda, dan satu closing
5. Quote block yang sudah disetujui — italic, justify
6. Closing block (harapan/makna kegiatan) — justify
7. "Kontributor : [nama]"  — justify
```

## 5. Alur Sistem (Data Flow)

```
[Login + signed cookie + Redis rate-limit]
   │
[Form inti 5W1H + detail dinamis]
   │  POST /api/generate
   ▼
[Preflight] → 422 INCOMPLETE_INPUT bila fakta inti kurang
   │
[Gemini generate → Gemini fact audit → optional repair sekali → audit ulang]
   │
[Ordered block editor + checklist + quote approval]
   │  POST /api/export-docx (foto wajib)
   ▼
[Validasi ulang sourceInput/blok/quote approval → DOCX]
```

## 6. Kontrak API (Referensi Cepat)

**`POST /api/generate`**
```json
// Request V2: fakta inti + detail jenis kegiatan + pihak + kutipan opsional
{ "version": 2, "nama_kegiatan": "...", "jenis_kegiatan": "lomba", "tujuan": "...", "penyelenggara": "...", "peserta": "...", "lokasi_lengkap": "...", "lokasi_dateline": "DEPOK", "tanggal": "Selasa (18/08/2026)", "urutan_kegiatan": "...", "detail_kegiatan": {}, "pihak_terlibat": [], "kutipan": [], "kontributor": "..." }

// Response V2
{ "version": 2, "judul": "...", "blocks": [{ "type": "paragraph", "role": "lead", "text": "..." }], "quoteReviews": [], "checklist": [], "warnings": [], "faktaDigunakan": [], "audit": { "passed": true, "repaired": false, "violations": [] } }
```

**`POST /api/export-docx`** — multipart berisi struktur V2 final, `sourceInput`, approval kutipan, dan foto wajib → `.docx` binary.

## 7. Boundary keamanan

- `proxy.ts` melindungi halaman dan API, tetapi bukan satu-satunya boundary; setiap route memverifikasi sesi kembali.
- Semua POST memeriksa same-origin, ukuran request, dan mengirim `Cache-Control: no-store`.
- Login dibatasi 5 percobaan/15 menit/IP dan fail-closed dengan 503 bila Redis tidak tersedia.
- Generate dibatasi 20/jam/sesi+IP serta 100/hari global; export 60/jam/sesi+IP.
- Pengguna terautentikasi tetap dapat generate/export bila Redis timeout setelah satu detik; kondisi ini dilog sebagai kategori degradasi tanpa isi berita.
- Log hanya berisi request ID, route, status, durasi, dan kategori error. Password, cookie, token, API key, teks berita, kutipan, serta foto tidak dicatat.
- Cookie sesi ditandatangani HS256, berlaku delapan jam, `httpOnly`, `SameSite=Strict`, dan `Secure` pada production.
- Security headers meliputi HSTS production, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, dan `Permissions-Policy`.

## 8. Struktur Folder

```
kemenag-pressrelease-ai/
├── app/                         # form, login, generate/export/auth routes
├── components/                  # form dinamis, checklist, dan editor
├── lib/                         # prompt, audit, validasi, sesi, rate-limit, DOCX
├── scripts/                     # unit/API/security/DOCX/live/golden checks
├── tests/browser/               # Playwright E2E
├── proxy.ts                     # redirect/401 cepat untuk route terlindungi
└── .env.example                 # daftar env tanpa secret
```

## 9. `docx` Library — Gotchas yang Perlu Diperhatikan Coding Agent

Dari pengalaman bikin docx pakai library ini:

- Set `page.size` eksplisit (`width/height`) — jangan andalkan default, defaultnya Letter bukan A4.
- Line spacing pakai `spacing: { line: 240, lineRule: "auto", before: 0, after: 160 }` di tiap `Paragraph` — 240 = single, 160 = 8pt (satuan twentieths-of-a-point).
- Justify pakai `alignment: AlignmentType.JUSTIFIED`.
- Kutipan italic: `italics: true` di `TextRun`, bukan di `Paragraph`.
- Gambar pakai `ImageRun`, wajib isi `type` (`"jpg"`/`"png"`), dan taruh di dalam `Paragraph` dengan `alignment: AlignmentType.CENTER`.
- Jangan pakai `\n` di dalam satu `TextRun` buat ganti baris — tiap paragraf harus jadi `Paragraph` terpisah.
