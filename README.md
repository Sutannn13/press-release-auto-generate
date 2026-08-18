# Kemenag Depok — Press Release Generator V2

Tool internal Humas Kementerian Agama Kota Depok untuk mengubah fakta terstruktur 5W+1H menjadi draf press release yang diaudit, direview manusia, dan diekspor ke DOCX berformat resmi.

## Fitur utama

- Form 5W+1H inti dengan panel dinamis untuk bimbingan, lomba, upacara, pelayanan, rapat, dan kegiatan lain.
- Preflight kelengkapan fakta dan artikel adaptif 5–8 paragraf faktual, dengan quote block tambahan bila tersedia.
- Audit editorial menolak paragraf tipis, pengulangan, tanda baca janggal, dan frasa generik yang tidak didukung input.
- Generate → audit fakta AI → maksimal satu perbaikan → audit ulang.
- Ordered blocks yang mendukung paragraf di antara beberapa kutipan.
- Kutipan asli terkunci, versi rapih terpisah, dan persetujuan manusia wajib.
- Preview editable, checklist 5W+1H, autosave browser tujuh hari, serta reset draf.
- DOCX A4/Calibri 12/justify dengan foto proporsional dan kutipan italic.
- Password bersama, sesi cookie delapan jam, same-origin guard, dan Upstash Redis rate-limit.

## Menjalankan lokal

1. Salin `.env.example` menjadi `.env.local` dan isi seluruh variabel.
2. Jalankan `npm install`.
3. Jalankan `npm run dev` lalu buka `http://localhost:3000`.

`SESSION_SECRET` minimal 32 karakter. Login sengaja gagal dengan status 503 jika password, session secret, atau Redis belum dikonfigurasi.

## Verifikasi

```bash
npm run lint
npx tsc --noEmit --incremental false
npm run test:v2
npm run test:browser
npm run test:gemini:live
npm run test:golden
npm run build
npm audit --omit=dev
```

Live test memakai kuota Gemini dan menghasilkan maksimal empat panggilan model per kasus apabila satu perbaikan diperlukan. Browser test memakai Microsoft Edge lokal dan memock respons generate/export; route asli tetap diuji oleh `test:v2`. Golden test membutuhkan PDF GEBER MAS di lokasi Downloads semula, atau path lain melalui `GEBER_REFERENCE_PDF`.

## Prinsip operasional

- Tidak ada auto-publish; manusia selalu melakukan review akhir.
- Kutipan, hasil, pemenang, atau tindak lanjut yang kosong tidak boleh dikarang.
- Redis hanya untuk rate-limit. Draf teks tersimpan lokal di browser, bukan database.
- Foto tidak disimpan oleh autosave dan harus dipilih kembali setelah refresh.
