# Deployment non-Vercel

Target utama aplikasi ini adalah **Render Web Service** dengan runtime Native Node.js di region Singapura. Render menginstal dependency, menjalankan build Next.js, dan menyalakan aplikasi langsung dari repository GitHub. Docker, WSL, dan virtual machine tidak diperlukan.

## Yang perlu tersedia

1. Repository GitHub yang berisi source code aplikasi dan `render.yaml`.
2. Akun Render yang terhubung ke repository GitHub.
3. Project Gemini API dan minimal satu API key aktif.
4. Database Upstash Redis dengan REST API aktif.

Aplikasi tidak membutuhkan database SQL, object storage, maupun persistent disk. Draf tersimpan selama tujuh hari di penyimpanan lokal browser. Foto hanya dikirim saat membuat DOCX dan tidak disimpan oleh aplikasi.

## Jangan ikut di-deploy

- `.env.local` atau file `.env` lain
- `node_modules`
- `.next`
- file hasil tes di `artifacts`
- dokumen sumber yang berada di folder Downloads

Semua item tersebut sudah dikecualikan dari Git atau dibuat ulang oleh Render saat build. Jangan menaruh API key atau token Redis di source code, `render.yaml`, README, maupun commit Git.

## 1. Siapkan Gemini

1. Buat atau pilih project Gemini API.
2. Aktifkan billing bila naskah mungkin memuat informasi personal, sensitif, atau belum publik. Pada layanan Gemini tanpa billing, input dan output dapat dipakai Google untuk peningkatan produk.
3. Buat API key dan simpan sebagai `GEMINI_API_KEY_PRIMARY`.
4. Key cadangan bersifat opsional dan dapat ditambahkan setelah deploy sebagai `GEMINI_API_KEY_BACKUP_1` dan `GEMINI_API_KEY_BACKUP_2`.

Model produksi sudah ditentukan oleh Blueprint:

- `GEMINI_MODEL_PRIMARY=gemini-3.6-flash`
- `GEMINI_MODEL_FALLBACK=gemini-3.5-flash-lite`

## 2. Siapkan Upstash Redis

1. Buat satu database Redis di Upstash.
2. Pilih region yang dekat dengan Singapura jika tersedia.
3. Buka bagian REST API dan salin dua nilai berikut:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`

Redis hanya menyimpan counter rate-limit. Naskah, kutipan, foto, dan API key tidak disimpan di Redis.

## 3. Push source code ke GitHub

Sebelum push, jalankan:

```powershell
npm ci
npm run lint
npx tsc --noEmit --incremental false
npm run test:v2
npm run build
git diff --check
```

Periksa `git status`, lalu commit hanya perubahan source/configuration yang memang akan dirilis. `.env.local` harus tetap tidak muncul dalam daftar commit.

Workflow `.github/workflows/ci.yml` akan mengulang lint, type-check, tes V2, build, browser E2E, dan audit dependensi di GitHub. Render disetel agar auto-deploy hanya berjalan setelah pemeriksaan GitHub berhasil.

## 4. Deploy Blueprint di Render

1. Login ke Render.
2. Pilih **New > Blueprint**.
3. Hubungkan GitHub dan pilih repository aplikasi ini.
4. Render akan membaca `render.yaml` dari root repository.
5. Isi secret yang diminta:

| Environment variable | Isi |
|---|---|
| `GEMINI_API_KEY_PRIMARY` | API key Gemini |
| `UPSTASH_REDIS_REST_URL` | URL REST dari Upstash |
| `UPSTASH_REDIS_REST_TOKEN` | Token REST dari Upstash |

Blueprint menggunakan instance `free` agar deployment pilot tidak langsung menimbulkan biaya. Free instance bukan pilihan produksi yang selalu siap: setelah 15 menit tanpa traffic, instance akan tidur dan permintaan pertama dapat menunggu sekitar satu menit. Jika alur sudah lolos smoke test dan akan dipakai rutin oleh kantor, ubah `plan: free` menjadi `plan: starter`, commit, lalu sinkronkan ulang Blueprint.

## 5. Verifikasi setelah online

1. Buka `https://NAMA-SERVICE.onrender.com/api/health`.
2. Hasil yang benar adalah status HTTP 200 dengan isi:

```json
{"status":"ok"}
```

Jika hasilnya HTTP 503, periksa kembali seluruh secret. Endpoint tidak menguji kuota Gemini secara langsung agar health check tidak menghabiskan kuota.

Lanjutkan smoke test melalui domain Render:

1. Buka URL aplikasi dan pastikan form generator langsung tampil.
2. Isi satu kegiatan uji yang tidak mengandung data rahasia.
3. Generate draf dan tunggu sampai audit selesai.
4. Review seluruh fakta.
5. Unggah foto uji dan download DOCX.
6. Buka DOCX serta pastikan judul, foto, paragraf, kutipan, dan kontributor tampil benar.

## 6. Operasional

- Setiap push ke branch utama menjalankan GitHub Actions. Deploy baru berjalan setelah checks lulus.
- Cek log Render jika generate menerima 502/503/504 atau memerlukan waktu terlalu lama.
- Rotasi API key/token segera jika pernah masuk commit atau dibagikan di tempat publik.
- Pantau kuota Gemini serta penggunaan Upstash.
- Jangan aktifkan preview deployment yang membawa secret produksi.

## Alternatif hosting tanpa Docker lokal

Jika Render tidak dapat digunakan, Railway juga dapat membangun aplikasi Node.js langsung dari repository dengan build command `npm ci && npm run build` dan start command `npm run start -- -H 0.0.0.0 -p $PORT`. Tetap gunakan environment variable/secret milik platform dan jangan mengunggah `.env.local`.

## Rollback

Jika versi baru bermasalah, buka halaman **Deploys** pada service Render lalu pilih deploy terakhir yang stabil dan lakukan rollback. Jangan menghapus Upstash saat rollback agar counter rate-limit tetap tersedia.
