# Content Style Guide V2 — Press Release Kemenag Depok

Dokumen ini menjadi acuan editorial. Prompt operasional yang benar-benar dikirim ke Gemini berada di `lib/prompt.ts`; perubahan aturan produksi harus dijaga konsisten di kedua tempat.

## 1. Prinsip utama

- Artikel hanya boleh memakai fakta yang ada di input pengguna.
- Input harus memuat What, Who, Where, When, Why, dan How sebelum generate.
- Kutipan bersifat opsional. Ketiadaannya menjadi peringatan, bukan alasan untuk mengarang ucapan.
- Panjang artikel adaptif 5–8 paragraf faktual di luar kutipan. Jika detail pendukung belum cukup, minta pengguna melengkapinya; jangan membuat paragraf generik untuk mengejar jumlah.
- Artikel selalu direview manusia sebelum export dan tidak pernah dipublikasikan otomatis.

## 2. Struktur artikel V2

Urutan dokumen final:

1. Judul faktual dan ringkas.
2. Foto kegiatan di bawah judul; rasio asli dipertahankan.
3. `paragraph/lead` yang dimulai `[LOKASI_DATELINE] (KEMENAG) –`.
4. Ordered blocks berupa `paragraph/body` dan `quote` yang dapat berseling.
5. `paragraph/closing` yang diturunkan dari tujuan, hasil, makna, atau tindak lanjut yang benar-benar tersedia.
6. `Kontributor : [nama]`.

Aturan struktur:

- Lead wajib memuat nama/jenis kegiatan, penyelenggara dan peserta, lokasi, serta tanggal.
- Lead berfokus pada What, Who, Where, dan When. Why dan How wajib muncul dalam dua paragraf isi paling awal.
- Minimal ada tiga `paragraph/body`: konteks/tujuan, peserta serta tahap awal, kemudian tahap lanjutan/respons/hasil/detail yang tersedia.
- Blok pertama harus `lead`; blok terakhir harus `closing`.
- Quote block pertama ditempatkan setelah lead dan dua paragraf isi awal.
- Setiap kutipan input dirujuk tepat satu kali.
- Dua quote block tidak boleh berdampingan; sisipkan paragraf faktual di antaranya.
- Blok quote tidak menyimpan teks kutipan. Ia hanya menyimpan `quoteId` dan gaya atribusi; teks dirender server dari pilihan yang telah disetujui.

## 3. Gaya bahasa

- Gunakan kosakata baku yang lazim menurut KBBI dan ejaan bahasa Indonesia, tetapi pertahankan kalimat yang natural, konkret, dan tidak kaku.
- Hindari bahasa sensasional, birokratis kosong, dan frasa khas tulisan AI. Ungkapan seperti “berlangsung lancar”, “sangat antusias”, “sukses digelar”, “wujud nyata”, “komitmen kuat”, atau pola “tidak hanya ... tetapi juga” hanya boleh dipakai jika didukung input.
- Setiap paragraf membawa satu fokus yang berbeda. Jangan mengulang nama lembaga, tujuan, dan urutan kegiatan hanya dengan susunan kata baru.
- Gunakan satu sampai tiga kalimat per paragraf, hindari kalimat lebih dari 55 kata, spasi sebelum tanda baca, elipsis, tanda seru berulang, dan en dash di luar dateline.
- Pertahankan ejaan nama orang, jabatan, organisasi, kegiatan, lokasi, tanggal, waktu, serta seluruh angka.
- Kata tugas pada judul ditulis dengan huruf kecil kecuali berada di awal.
- Dateline memakai kapital dan en dash: `DEPOK (KEMENAG) –` atau kecamatan yang sesuai lokasi.
- Atribusi lengkap dipakai ketika narasumber belum diperkenalkan. Atribusi pronominal hanya boleh dipakai setelah identitasnya jelas.
- Penutup tidak boleh menciptakan komitmen, keberlanjutan, hasil, atau dampak baru.

## 4. Aturan anti-fabrikasi

AI dilarang menambah atau mengubah:

- nama, jabatan, organisasi, lokasi, tanggal, waktu, dan angka;
- tujuan, hasil, pemenang, tindak lanjut, suasana, respons peserta, atau kejadian yang tidak tertulis;
- kutipan atau pernyataan baru;
- kesimpulan kausal dan penilaian yang tidak didukung data.

Field opsional yang kosong harus dilewati. Parafrasa hanya boleh memperbaiki alur kalimat tanpa memperluas makna. Draf diaudit oleh panggilan AI kedua bertemperatur nol dan pemeriksaan deterministik. Satu revisi otomatis diperbolehkan; hasil yang masih gagal audit harus ditolak.

## 5. Kutipan dan persetujuan manusia

- Server menyimpan `original` persis dari input; AI tidak dapat menimpanya.
- AI hanya membuat `cleaned` untuk pembetulan kapitalisasi, ejaan, pemisahan kata, dan tanda baca ringan.
- Nama, angka, negasi, serta makna kutipan tidak boleh berubah.
- Pengguna memilih `original` atau `cleaned`, lalu menyetujuinya.
- Mengedit versi cleaned membatalkan persetujuan.
- Export diblokir selama ada quote block yang referensinya tidak valid atau kutipannya belum disetujui.
- Kutipan final dicetak italic dan justify.

## 6. Fakta dinamis per jenis kegiatan

| Jenis | Detail yang dianjurkan |
|---|---|
| Bimbingan/sosialisasi/seminar | Pemateri dan poin materi |
| Lomba/perayaan | Jenis lomba dan hasil/pemenang bila sudah resmi |
| Upacara/ziarah/peringatan | Urutan prosesi dan makna peringatan |
| Pelayanan/bakti sosial/kebersihan | Bentuk layanan dan penerima manfaat |
| Rapat/kunjungan/koordinasi | Agenda dan kesepakatan |
| Lainnya | Detail tambahan yang dapat diverifikasi |

Ketiadaan hasil, pemenang, atau tindak lanjut tidak boleh diubah menjadi klaim bahwa data tersebut “akan diumumkan” atau “akan dilaksanakan”.

## 7. Kontrak ordered blocks

Kontrak aplikasi setelah adapter server:

```json
{
  "version": 2,
  "judul": "...",
  "blocks": [
    { "id": "block-1", "type": "paragraph", "role": "lead", "text": "..." },
    { "id": "block-2", "type": "paragraph", "role": "body", "text": "..." },
    { "id": "block-3", "type": "paragraph", "role": "body", "text": "..." },
    { "id": "block-4", "type": "quote", "quoteId": "quote-1", "attributionStyle": "full" },
    { "id": "block-5", "type": "paragraph", "role": "body", "text": "..." },
    { "id": "block-6", "type": "paragraph", "role": "closing", "text": "..." }
  ],
  "quoteReviews": [],
  "checklist": [],
  "warnings": [],
  "faktaDigunakan": [],
  "audit": { "passed": true, "repaired": false, "violations": [] }
}
```

Respons mentah model memakai placeholder field agar JSON schema stabil, lalu server membuang placeholder tersebut dan membangun ID blok, original quote, checklist, serta ringkasan fakta sendiri.

## 8. Golden cases

- BRUS: satu kutipan; lead memuat 30 peserta, lokasi, dan tanggal; Why/How muncul pada isi awal.
- Lomba: jenis lomba, jumlah peserta, dan pemenang hanya ditulis jika tersedia di input.
- GEBER MAS: dateline `CILODONG`, dua kutipan H. Dede Supriatna dipisahkan paragraf faktual, lalu penutup dan kontributor. Struktur serta rasio foto dibandingkan dengan PDF acuan melalui `npm run test:golden`.

PDF GEBER MAS merupakan referensi pola dan fidelitas, bukan instruksi untuk menyalin klaim yang tidak ada dalam input baru.
