# Portal Ujian Sumatif — SMP Tunas Hidup Harapan Kita

Portal web untuk Penilaian Sumatif berbasis browser yang **aman**, dengan:

- ✅ **Proxy PDF Google Drive** — frontend/siswa tidak pernah melihat URL asli berkas soal.
- ✅ **Penampil PDF Canvas (PDF.js)** — tanpa tombol download, tanpa menu klik kanan, tanpa pop-out.
- ✅ **Alur validasi administratif wajib**:
  - **Pengawas** → pop-up **Berita Acara** yang tidak bisa ditutup sebelum disubmit.
  - **Siswa** → pop-up **Daftar Hadir/Presensi** wajib, lalu **gerbang token** dari pengawas.
- ✅ **Pelacakan aktivitas real-time** — `PDF Dibuka`, `Ganti Halaman`, `PDF Ditutup`, `Aktivitas Mencurigakan`, dan lain-lain tampil langsung di **Live Monitor** pengawas.
- ✅ Desain responsif & profesional dengan identitas **Yayasan Tunas Hidup Harapan Kita** (biru tua + emas), siap dikunci di dalam **Exam Browser Android**.

---

## 1. Mulai Cepat (Mode Demo)

```bash
npm install
npm start
```

Buka **http://localhost:3000**

### Akun demonstrasi

| Peran | Username | Password | Keterangan |
|-------|----------|----------|------------|
| Pengawas | `pengawas` | `thhk2026` | Memunculkan modal **Berita Acara** wajib |
| Siswa | `siswa1` | `rahasia123` | Kelas 9A — Bahasa Indonesia |
| Siswa | `siswa2` | `rahasia123` | Kelas 9A — Matematika |
| Siswa | `siswa3` | `rahasia123` | Kelas 9B — IPA |

### Token ujian demo

| Token | Mapel |
|-------|-------|
| `TOKEN9A` | Bahasa Indonesia |
| `TOKEN9B` | Matematika |
| `TOKEN9C` | IPA |

> Token diberikan oleh **pengawas** di ruang ujian. Siswa harus memakai token yang sesuai mapelnya.

Mode demo memakai penyimpanan **in-memory** (data hilang saat server restart) dan PDF contoh yang digenerate otomatis (`pdfkit`) ketika berkas Google Drive belum dikonfigurasi.

---

## 2. Alur Kerja

### Pengawas (Supervisor)

1. **Login** dengan kredensial pengawas.
2. Muncul **Pop-Up Berita Acara** wajib → tidak bisa ditutup (tidak ada tombol ✕, not tutup via klik luar, `Escape` diblokir).
3. Isi form (ruang, tanggal, waktu, jumlah pengawas/peserta, kejadian khusus, catatan) → **Submit**.
4. **Dashboard Live Monitor** terbuka: statistik, tabel siswa aktif, riwayat aktivitas real-time (refresh tiap 4 detik), dan tabel Berita Acara.

### Siswa

1. **Login** tanpa SSO.
2. Muncul **Pop-Up Daftar Hadir** wajib → tidak bisa ditutup sebelum submit.
3. Setelah presensi → **Gerbang Token**.
4. Token valid → **Penampil PDF** (canvas) terbuka; event `Buka PDF` terkirim.
5. Tombol **Selesai Ujian** → event `Tutup PDF` + `Selesai Ujian` terkirim → layar terima kasih.
6. Jika siswa meninggalkan halaman / pindah tab → sistem mengirim event `Tutup PDF` otomatis via beacon.

---

## 3. Konfigurasi Berkas Soal (Google Drive) — 20 Mata Pelajaran

Aplikasi mendukung **20 mata pelajaran** (lihat daftar di bawah). Setiap mapel bisa memiliki PDF soal sendiri di Google Drive.

### 3.1 Cara Upload PDF ke Google Drive

1. Buka **https://drive.google.com** → **New → File upload** (atau *drag & drop* file PDF soal).
2. Klik **kanan file** → **Share** → ubah akses menjadi **"Anyone with the link"** → pilih **Viewer** → **Done**.
3. Klik **Share → Copy link** — link akan berbentuk:
   ```
   https://drive.google.com/file/d/<FILE_ID>/view
   ```
4. Ambil bagian **`<FILE_ID>`** (karakter di antara `/d/` dan `/view`).
   Contoh: dari `https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz/view`
   → File ID-nya adalah `1AbCdEfGhIjKlMnOpQrStUvWxYz`

### 3.2 Cara Menautkan PDF ke Mapel (2 Opsi)

**✅ Opsi 1 (disarankan) — Isi lewat Supabase Dashboard:**

Tanpa edit kode / tanpa redeploy. Setelah upload 20 PDF, cukup isi tabel `exams`:

1. Buka **Supabase Dashboard → Table Editor → `exams`**
2. Untuk setiap baris mapel, isi kolom **`drive_file_id`** dengan File ID dari langkah 3.1
3. Server otomatis memakai File ID tersebut (prioritas utama)

| exam_key | title | drive_file_id |
|----------|-------|---------------|
| `agama` | Pendidikan Agama & Budi Pekerti | `1AbC...` |
| `ppkn` | PPKn | `1Def...` |
| `indonesia` | Bahasa Indonesia | `1Ghi...` |
| `matematika` | Matematika | `1Jkl...` |
| `ipa` | IPA | `1Mno...` |
| `ips` | IPS | `1Pqr...` |
| `inggris` | Bahasa Inggris | `1Stu...` |
| `seni` | Seni Budaya | `1Vwx...` |
| `pjok` | PJOK | `1Yz0...` |
| `prakarya` | Prakarya | `1A11...` |
| `informatika` | Informatika | `1B22...` |
| `mulok_bahasa_daerah` | Muatan Lokal Bahasa Daerah | `1C33...` |
| `mulok_bahasa_asing` | Muatan Lokal Bahasa Asing | `1D44...` |
| `pendalaman_agama` | Pendalaman Agama | `1E55...` |
| `bimbingan_konseling` | Bimbingan Konseling | `1F66...` |
| `literasi` | Literasi Digital | `1G77...` |
| `kewirausahaan` | Kewirausahaan | `1H88...` |
| `matematika_tambahan` | Matematika Tambahan | `1I99...` |
| `ipa_tambahan` | IPA Tambahan | `1J00...` |
| `ips_tambahan` | IPS Tambahan | `1K11...` |

**✅ Opsi 2 — Isi Environment Variables di Vercel:**

Jika lebih suka env var, buka **Vercel → Project Settings → Environment Variables** dan tambahkan `DRIVE_ID_<KEY>`:

```bash
DRIVE_ID_INDONESIA=<file_id>
DRIVE_ID_MATEMATIKA=<file_id>
DRIVE_ID_IPA=<file_id>
# ... dst untuk semua mapel
```

> Prioritas: **tabel `exams` Supabase** > **env var Vercel** > **PDF demo**.

### Daftar 20 Mata Pelajaran

| # | exam_key | Mapel |
|---|----------|-------|
| 1 | `agama` | Pendidikan Agama & Budi Pekerti |
| 2 | `ppkn` | PPKn |
| 3 | `indonesia` | Bahasa Indonesia |
| 4 | `matematika` | Matematika |
| 5 | `ipa` | IPA |
| 6 | `ips` | IPS |
| 7 | `inggris` | Bahasa Inggris |
| 8 | `seni` | Seni Budaya |
| 9 | `pjok` | PJOK |
| 10 | `prakarya` | Prakarya |
| 11 | `informatika` | Informatika |
| 12 | `mulok_bahasa_daerah` | Muatan Lokal Bahasa Daerah |
| 13 | `mulok_bahasa_asing` | Muatan Lokal Bahasa Asing |
| 14 | `pendalaman_agama` | Pendalaman Agama |
| 15 | `bimbingan_konseling` | Bimbingan Konseling |
| 16 | `literasi` | Literasi Digital |
| 17 | `kewirausahaan` | Kewirausahaan |
| 18 | `matematika_tambahan` | Matematika Tambahan |
| 19 | `ipa_tambahan` | IPA Tambahan |
| 20 | `ips_tambahan` | IPS Tambahan |

> Mapel bisa ditambah/diubah di `server/config.js` + `public/js/app.js` (EXAM_LABELS) + tabel `exams`.

### Keamanan Proxy PDF

Server mengambil PDF dari Google Drive di sisi server lalu mengalirkannya ke browser. Kekuatan keamanan:

- Tautan asli Google Drive **tidak pernah** dikirim ke frontend.
- Response diberi `Content-Disposition: inline`, `Cache-Control: no-store`, dan disajikan hanya untuk siswa yang sesinya sudah **presensi + token valid**.
- Jika File ID belum diisi lalu pengambilan gagal, sistem memakai **fallback PDF demo** agar alur tetap berjalan.

---

## 4. Mode Produksi (Supabase)

Adaptor **Supabase** sudah disiapkan di `server/store.js`. Aktifkan dengan mengisi env sebagai berikut:

```bash
set SUPABASE_URL=https://xxxx.supabase.co
set SUPABASE_ANON_KEY=eyJ...
npm start
```

Server akan memakai tabel (default, dapat diubah di `server/config.js`):

| Tabel | Tujuan |
|-------|--------|
| `users` | Sesi & autentikasi |
| `exam_tokens` | Token ujian |
| `attendance` | Presensi siswa |
| `berita_acara` | Berita Acara pengawas |
| `tracking_activity` | Log aktivitas real-time |

> Catatan: adaptor saat ini memakai session cache in-memory sebagai lapisan bersama; sesuaikan query CRUD pada `SupabaseStore` dengan skema tabel Anda untuk produksi penuh.

---

## 5. Keamanan yang Diterapkan

| Lapisan | Implementasi |
|---------|--------------|
| Sesi | Cookie `HttpOnly`, `SameSite=Strict`, `Max-Age 8 jam` |
| Proxy PDF | Server mengambil Google Drive; URL asli tidak terekspos |
| Otorisasi | Hanya sesi siswa dengan `presensi + token valid` yang dapat memuat PDF |
| Anti-download | `Content-Disposition: inline`, `no-store`, no-cache |
| Canvas only | PDF dirender ke `<canvas>` (PDF.js), tanpa elemen `<iframe>`/viewer eksternal |
| Anti klik kanan | `contextmenu` diblokir |
| Anti shortcut | `F12`, `Ctrl+Shift+I/J/C/K`, `Ctrl+U`, `PrintScreen` diblokir |
| Anti salin | `copy`, `cut`, `paste`, `dragstart`, `drop` diblokir saat viewer aktif |
| Anti bypass | `Escape` tidak menutup modal wajib; modal wajib tidak punya tombol ✕/klik luar |
| Deteksi keluar | `beforeunload` + `visibilitychange` mengirim `pdf_tutup` via `navigator.sendBeacon` |
| Header HTTP | `X-Frame-Options: SAMEORIGIN`, `nosniff`, `Referrer-Policy: no-referrer`, `Permissions-Policy` |

---

## 6. Struktur Proyek

```
├── package.json
├── README.md
├── server/
│   ├── config.js        # kredensial, Google Drive IDs, token, opsi keamanan
│   ├── index.js         # server Express + seluruh endpoint API
│   ├── store.js         # data layer (Memory demo / Supabase)
│   └── pdfgen.js        # generator PDF demo (pdfkit)
├── scripts/
│   └── gen-logo.js      # pembuat public/logo.svg
└── public/
    ├── index.html       # SPA: login, modal wajib, live monitor, viewer
    ├── logo.svg
    ├── css/style.css
    └── js/app.js        # logika klien + integrasi PDF.js
```

---

## 7. Deployment (GitHub → Vercel → Supabase)

Aplikasi dirancang untuk di-deploy ke **Vercel** (serverless Node.js) dengan **Supabase** sebagai database. Berikut panduan lengkapnya.

### 7.1 Prasyarat

| Layanan | Akun yang dibutuhkan |
|---------|----------------------|
| GitHub | Akun GitHub untuk menyimpan kode |
| Vercel | Akun Vercel (bisa login dengan GitHub) |
| Supabase | Akun Supabase (bisa login dengan GitHub) |

### 7.2 Siapkan Database Supabase

1. Buka **https://supabase.com** → login → **New Project**.
2. Buat project baru (pilih region terdekat, misal `Singapore`).
3. Masuk ke **SQL Editor** → **New query** → paste isi file **`supabase/schema.sql`** → **Run**.
   - Skrip ini membuat tabel: `users`, `exam_tokens`, `attendance`, `berita_acara`, `tracking_activity` + indeks + RLS policy.
4. Buka **Settings → API** — catat nilai:
   - `Project URL` (contoh: `https://abcdefgh.supabase.co`)
   - `anon public` key (contoh: `eyJhbGciOi...`)
5. (Opsional) Buka **Table Editor → exam_tokens** → **Insert row** untuk menambahkan token awal:
   - `TOKEN9A` → exam_key `indonesia`
   - `TOKEN9B` → exam_key `matematika`
   - `TOKEN9C` → exam_key `ipa`

### 7.3 Push Kode ke GitHub

```bash
git init
git add .
git commit -m "Initial commit: Portal Sumatif THHK"
git branch -M main
git remote add origin https://github.com/<USERNAME>/<REPO-NAME>.git
git push -u origin main
```

> Ganti `<USERNAME>` dan `<REPO-NAME>` dengan akun GitHub Anda.

### 7.4 Deploy ke Vercel

**Cara A — Import dari GitHub (disarankan):**

1. Buka **https://vercel.com** → **Add New** → **Project**.
2. Pilih repo GitHub yang tadi di-push → **Import**.
3. Vercel otomatis mendeteksi pengaturan dari `vercel.json` (build & route Express).
4. Di bagian **Environment Variables**, tambahkan:

| Key | Nilai |
|-----|-------|
| `SUPABASE_URL` | Project URL Supabase Anda |
| `SUPABASE_ANON_KEY` | anon public key Supabase Anda |
| `DRIVE_ID_INDONESIA` | File ID PDF Bahasa Indonesia (opsional) |
| `DRIVE_ID_MATEMATIKA` | File ID PDF Matematika (opsional) |
| `DRIVE_ID_IPA` | File ID PDF IPA (opsional) |

5. Klik **Deploy** → tunggu hingga selesai → aplikasi live di `https://<project>.vercel.app`.

**Cara B — Vercel CLI:**

```bash
npm install -g vercel
vercel login
vercel --prod
```

### 7.5 Konfigurasi Environment Variables (Vercel)

Semua kredensial **jangan** disimpan di `server/config.js` untuk produksi. Vercel akan menyuntikkan env vars secara otomatis:

| Variable | Fungsi |
|----------|--------|
| `SUPABASE_URL` | URL project Supabase |
| `SUPABASE_ANON_KEY` | Key anon Supabase |
| `DRIVE_ID_INDONESIA` | ID Google Drive PDF Bahasa Indonesia |
| `DRIVE_ID_MATEMATIKA` | ID Google Drive PDF Matematika |
| `DRIVE_ID_IPA` | ID Google Drive PDF IPA |

Jika env vars tidak diisi, aplikasi berjalan dalam **mode demo** (data in-memory + PDF contoh).

### 7.6 Verifikasi Deployment

1. Buka URL aplikasi di Vercel.
2. Login sebagai **pengawas** (`pengawas` / `thhk2026`) → muncul modal Berita Acara → submit.
3. Login sebagai **siswa** (`siswa1` / `rahasia123`) → presensi → masukkan token (`TOKEN9A`) → PDF terbuka.
4. Cek **Supabase Dashboard → Table Editor** — data presensi & berita acara tersimpan di tabel.

### 7.7 Catatan Penting (Serverless Vercel)

- **Sesi in-memory:** Vercel memakai serverless functions yang bisa `cold start`. Sesi login tersimpan in-memory per instance sehingga pengguna mungkin perlu login ulang saat instance berganti. Untuk produksi skala besar, pertimbangkan:
  - Menyimpan sesi di tabel `users` dengan validasi token di setiap request, atau
  - Memakai JWT stateless.
- **Proxy PDF Google Drive:** Tetap berfungsi di Vercel karena server yang mengambil PDF, bukan browser. Pastikan Google Drive file berstatus **publik (viewer)**.
- **Fallback demo:** Jika `DRIVE_ID_*` tidak diisi atau unduhan gagal, sistem memakai PDF contoh agar alur ujian tetap berjalan.
- **Batasan serverless:** Function Vercel Hobby plan punya batas durasi eksekusi (~10 detik pada Hobby). Pengambilan PDF dari Google Drive diberi timeout 8 detik agar tidak melewati batas.

### 7.8 Deployment ke Platform Lain (Opsional)

Contoh di platform Node biasa (Railway, Render, atau server VPS):

```bash
npm install --production
npm start
```

Pastikan:

- Port memakai `process.env.PORT` (sudah diatur di `server/config.js`).
- Berkas Google Drive berstatus **publik (viewer)**.
- Frontend disajikan langsung oleh Express (`public/`) — tidak ada pemisahan origin yang mengekspos URL PDF.

---

## 8. Lisensi

MIT © SMP Tunas Hidup Harapan Kita — digunakan untuk keperluan Penilaian Sumatif sekolah.