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

## 3. Konfigurasi Berkas Soal (Google Drive)

Buka **`server/config.js`** dan ganti `driveFileId` untuk setiap mapel dengan ID berkas Google Drive Anda:

```js
examFiles: {
    indonesia: {
        title: "Bahasa Indonesia",
        driveFileId: "1ABCxyz...", // ganti dengan ID berkas publik Anda
    },
    // ...
}
```

Cara mendapatkan ID:
- Buka berkas di Google Drive → *Share* → set **"Anyone with the link"** → *Viewer*.
- Klik *Share* → *Copy link* → link berbentuk `https://drive.google.com/file/d/<FILE_ID>/view` → ambil bagian `<FILE_ID>`.

Server mengambil PDF dari Google Drive di sisi server lalu mengalirkannya ke browser. Kekuatan keamanan:

- Tautan asli Google Drive **tidak pernah** dikirim ke frontend.
- Response diberi `Content-Disposition: inline`, `Cache-Control: no-store`, dan disajikan hanya untuk siswa yang sesinya sudah **presensi + token valid**.
- Jika pengambilan Google Drive gagal, sistem memakai **fallback PDF demo** agar alur tetap berjalan.

### Konfigurasi via environment variables

```bash
set DRIVE_ID_INDONESIA=<file_id>
set DRIVE_ID_MATEMATIKA=<file_id>
set DRIVE_ID_IPA=<file_id>
npm start
```

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