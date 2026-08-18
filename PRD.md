# PRD — Kemenag Depok Auto Press Release Generator

## 1. Latar Belakang & Masalah

Humas Kemenag Kota Depok rutin bikin press release tiap ada kegiatan (BRUS, GEBER MAS, ziarah, dll). Alur sekarang:

1. Tulis narasi manual di Word (5W1H + kutipan narasumber)
2. Atur format manual: margin, font Calibri 12, justify, line spacing — dan ini gampang meleset/inkonsisten antar penulis
3. Baru bisa di-upload ke website Kemenag Depok

Masalahnya dua lapis:
- **Nulis narasinya makan waktu** — dari fakta 5W+1H menjadi 5–8 paragraf faktual yang enak dibaca, tidak repetitif, dan sesuai gaya bahasa institusi.
- **Formatnya harus presisi tapi diatur manual tiap kali** — kalau meleset dikit (margin, spacing), harus dibenerin lagi sebelum upload.

## 2. Tujuan (Goals)

- Dari input terstruktur lengkap (What/Who/Where/When/Why/How + kutipan opsional), hasilkan **draf artikel lengkap** dalam gaya bahasa resmi Kemenag Depok tanpa mengarang fakta.
- Output langsung berupa file **`.docx` yang formatnya sudah final** (margin, font, spacing, justify) — nol ubahan format manual sebelum upload.
- Prosesnya cepat: dari isi form sampai file jadi, **< 30 detik**.
- Zero biaya operasional — pakai API tier gratis (Gemini).

## 3. Non-Goals (di luar scope V2)

- **Tidak** auto-publish ke website Kemenag — output tetap file yang direview manusia dulu sebelum di-upload. Ini prinsip, bukan keterbatasan teknis (lihat §6 Aturan Non-Negotiable).
- Tidak multi-user / role-based access di V2 — asumsi dipakai Johan (dan mungkin 1-2 kolega Humas) langsung, bukan sistem kantor besar.
- Tidak ada CMS integration langsung ke web Kemenag di V2.
- Tidak generate foto/gambar — foto kegiatan tetap dari kamera/HP asli, tinggal ditempel/upload.

## 4. Target Pengguna

- **Primer:** Johan (dan tim Humas Kemenag Depok kalau mau dipakai bareng) — nulis press release rutin, butuh alat yang bikin kerjaan lebih cepat tanpa ngorbanin kualitas & keseragaman format.

## 5. Alur Pemakaian (User Flow)

```
1. Login memakai password internal
2. Isi field inti 5W+1H dan detail dinamis
3. Klik "Generate"; data inti yang kurang ditolak dengan field terarah
4. AI menyusun draf adaptif, auditor AI memeriksa fakta, dan sistem memperbaiki maksimal sekali
5. Review ordered blocks dan checklist 5W+1H
6. Pilih serta setujui versi setiap kutipan
7. Pilih foto lalu klik "Download .docx"
8. Review sekali lagi → upload manual ke website Kemenag
```

Langkah 5-6 (preview + edit) itu penting — bukan langsung "generate → download" tanpa jeda, karena press release itu dokumen resmi, harus ada kesempatan koreksi sebelum jadi file.

## 6. Aturan Non-Negotiable

Prinsip yang sama kayak project AutoApply lo — dikunci dari awal biar coding agent nggak improvisasi:

1. **Tidak ada auto-publish.** Output selalu file yang di-download, direview manusia. Tidak ada endpoint yang langsung posting ke web Kemenag.
2. **AI tidak boleh mengarang fakta.** AI hanya boleh mengembangkan gaya bahasa & narasi dari fakta yang diinput user (nama, angka, kutipan). Tidak boleh nambah detail yang tidak ada di input (nama orang baru, angka baru, kutipan yang tidak diberikan). Ini WAJIB ditulis eksplisit di system prompt (lihat CONTENT_STYLE_GUIDE.md).
3. **Kutipan narasumber harus persis seperti yang diinput** — AI boleh merapikan tanda baca/ejaan ringan, tapi tidak boleh mengubah makna atau menambah kalimat baru di dalam tanda kutip.
4. **Format dokumen harus persis sesuai spec** (lihat ARCHITECTURE.md) — bukan "kira-kira mirip".

## 7. Input Fields (Formula Terstruktur)

Berdasarkan formula yang lo kasih, ini field-nya dipecah biar bisa diproses AI + template dengan presisi:

| Kelompok | Field inti | Wajib? |
|---|---|---|
| What | `nama_kegiatan`, `jenis_kegiatan` | Ya |
| Why | `tujuan` / latar belakang resmi | Ya |
| Who | `penyelenggara`, `peserta`; jumlah dan pihak hadir opsional | Ya |
| Where | `lokasi_lengkap`, `lokasi_dateline` | Ya |
| When | `tanggal`; waktu opsional | Ya |
| How | `urutan_kegiatan`; respons, hasil, dan tindak lanjut opsional | Ya |
| Detail dinamis | materi, jenis lomba/pemenang, prosesi, layanan, agenda, atau detail lain | Tidak |
| Kutipan | `{id, nama, jabatan, isi}` dengan approval versi asli/rapih | Tidak |
| Publikasi | `kontributor`; foto wajib hanya saat export | Ya |

> Kenapa `lokasi_dateline` dipisah dari `lokasi_lengkap`: dari 2 contoh artikel lo, dateline pembuka kadang "DEPOK (KEMENAG)" kadang "CILODONG (KEMENAG)" — tergantung kecamatan tempat kegiatan, bukan selalu "DEPOK". Lihat CONTENT_STYLE_GUIDE.md.

## 8. Functional Requirements

- **FR1** — Form input sesuai §7, dengan validasi field wajib.
- **FR2** — Generate dan audit fakta dua tahap via Gemini, dengan maksimal satu perbaikan otomatis.
- **FR3** — Preview ordered blocks, checklist 5W+1H, approval kutipan, dan autosave browser tujuh hari.
- **FR4** — Export ke `.docx` dengan format persis sesuai ARCHITECTURE.md (margin, font, spacing, justify, quote italic).
- **FR5** — Upload foto saat export dan embed proporsional tanpa distorsi.
- **FR6** — Password bersama, cookie session, same-origin guard, dan Redis rate-limit untuk deployment publik.
- **FR7** — Artikel memiliki minimal lima paragraf di luar kutipan; setiap paragraf membawa fungsi dan fakta berbeda. Input yang terlalu tipis ditolak, bukan dipanjangkan dengan kalimat generik.

## 9. Non-Functional Requirements

- **Biaya:** mengikuti free tier Vercel, Gemini, dan Upstash; tidak ada database aplikasi karena V2 stateless.
- **Kecepatan:** waktu mengikuti dua audit AI; UI harus menunjukkan status proses dan tidak mengulang tanpa batas.
- **Reliability format:** file yang keluar harus selalu bisa dibuka normal di Word tanpa "repair document" warning.
- **Akses:** dilindungi password sederhana (bukan sistem login kompleks) karena bakal di-deploy ke URL publik Vercel tapi cuma dipakai internal.

## 10. Sinergi dengan Project Lain (catatan, bukan scope V2)

Project "Kemenag Depok Public Insight" lo (media monitoring + sentiment dashboard) butuh data press release resmi sebagai salah satu sumber. Tool ini, kalau nanti disambung ke Neon Postgres yang sama, bisa jadi **sumber data otomatis** buat dashboard itu — tiap press release yang di-generate otomatis kelog. Ini bukan requirement sekarang, tapi taruh di ROADMAP biar arsitekturnya nggak nabrak nanti.

## 11. Keputusan & Asumsi (Konfirmasi sebelum handoff ke coding agent)

Ini keputusan yang gw ambil buat brainstorming ini — kalau ada yang mau diganti, bilang sebelum lanjut ke ARCHITECTURE:

1. **Interface: web form (Next.js)**, bukan Discord bot / CLI. Alasan lengkap di ARCHITECTURE.md §1.
2. **Project terpisah** dari Public Insight (bukan module di dalamnya) — biar bisa langsung jalan sekarang tanpa nunggu Public Insight keluar dari fase observasi.
3. **Format docx: generate programmatic** (pakai library `docx`), bukan isi-template Word — alasan di ARCHITECTURE.md §3.
4. Foto kegiatan wajib saat export, terpasang otomatis tepat di bawah judul, dan rasio asli harus dipertahankan.

## 12. Success Metrics

- Waktu bikin 1 press release: dari ~30-45 menit (tulis + format manual) jadi **< 5 menit** (isi form + review).
- 0 kasus "format harus dibenerin manual" setelah export.
- Draf hasil AI bisa dipakai dengan **edit minor** (bukan ditulis ulang dari nol) — indikator gaya bahasanya udah pas.
