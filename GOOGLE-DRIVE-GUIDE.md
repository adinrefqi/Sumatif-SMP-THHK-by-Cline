# 🚀 Panduan Cara Meletakkan Link Google Drive (PDF Soal)

Panduan lengkap menautkan PDF soal dari Google Drive ke aplikasi, per mata pelajaran.

---

## 📌 Ringkasan (3 Langkah)

| Langkah | Apa yang dilakukan | Di mana |
|---------|-------------------|---------|
| **1** | Upload PDF ke Google Drive & jadikan publik | drive.google.com |
| **2** | Salin **File ID** dari link | Google Drive |
| **3** | Tempel File ID ke tabel `exams` (per mapel + per kelas) | Supabase Dashboard |

> ✅ **Cara ini TANPA edit kode & TANPA redeploy** — cukup isi tabel, PDF langsung muncul.

---

## 🏫 KONSEP PENTING: 1 Mapel bisa punya PDF Berbeda per Kelas

Sistem mendukung **1 mapel dengan PDF berbeda untuk Kelas 7, 8, dan 9**:

| Mapel | Kolom `class_name` di Supabase | PDF yang dipakai |
|-------|-------------------------------|------------------|
| Matematika | `7` | Soal Matematika Kelas 7 |
| Matematika | `8` | Soal Matematika Kelas 8 |
| Matematika | `9` | Soal Matematika Kelas 9 |
| Matematika | *(kosong)* | PDF default (fallback bila level tidak diisi) |

**Cara kerja otomatisnya:**
- Siswa login → sistem tahu kelasnya (contoh: `calvin` = **9A**)
- Siswa membuka mapel `matematika` → server mencari File ID dengan `class_name = '9'`
- Jika ada → kirim PDF Matematika Kelas 9
- Jika **tidak ada** → pakai baris `class_name = ''` (default) → jika kosong juga → PDF demo

---

## 📝 Langkah 1 — Upload PDF & Jadikan Publik

1. Buka **https://drive.google.com** (login dengan akun Google sekolah Anda)
2. Klik **New** → **File upload** → pilih file PDF soal
   *Atau cukup **drag & drop** file PDF ke halaman Google Drive*

3. Setelah terupload, **klik kanan file** → **Share**

4. Di jendela Share:
   - Klik **"Restricted"** → ganti menjadi **"Anyone with the link"**
   - Setel akses menjadi **"Viewer"** (hanya bisa melihat, tidak bisa edit)
   - Klik **Done**

---

## 📝 Langkah 2 — Salin File ID dari Link

1. Di Google Drive, **klik kanan file** → **Share** → **Copy link**

2. Link akan berbentuk seperti ini:
   ```
   https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz/view?usp=sharing
   ```

3. **File ID** adalah bagian di antara `/d/` dan `/view`:
   ```
   https://drive.google.com/file/d/ 1AbCdEfGhIjKlMnOpQrStUvWxYz /view
                                    ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                                    ← INI File ID yang dicopy
   ```
   Contoh File ID: `1AbCdEfGhIjKlMnOpQrStUvWxYz`

4. Simpan File ID ini untuk langkah berikutnya.

---

## 📝 Langkah 3 — Tempel ke Supabase

1. Buka **https://supabase.com/dashboard** → pilih project **`lphulmkqihujlycxbbzn`**

2. Klik menu kiri **Table Editor** → pilih tabel **`exams`**

3. Cari baris **mapel** yang sesuai, contoh:
   | exam_key | title | drive_file_id |
   |----------|-------|---------------|
   | `indonesia` | Bahasa Indonesia | ⬅️ isi di sini |
   | `matematika` | Matematika | ⬅️ isi di sini |
   | `ipa` | IPA | ⬅️ isi di sini |

4. **Klik kolom `drive_file_id`** pada baris mapel yang ingin diisi → tempel **File ID** dari Langkah 2 → tekan Enter

5. Ulangi untuk semua mapel yang punya PDF soal

6. **Selesai!** ✅ Siswa yang membuka soal mapel tersebut akan otomatis menerima PDF dari Google Drive — tanpa edit kode, tanpa redeploy.

---

## 🗺️ Daftar 19 Mapel SMP THHK (untuk diisi di tabel `exams`)

| exam_key | Mapel | drive_file_id |
|----------|-------|---------------|
| `agama_katolik` | Agama Katolik | |
| `agama_kristen` | Agama Kristen | |
| `agama_islam` | Agama Islam | |
| `agama_buddha` | Agama Buddha | |
| `agama_konghucu` | Agama Konghucu | |
| `pancasila` | Pendidikan Pancasila | |
| `indonesia` | Bahasa Indonesia | |
| `ipa` | IPA | |
| `tik` | TIK | |
| `matematika` | Matematika | |
| `ips` | IPS | |
| `inggris` | Bahasa Inggris | |
| `seni` | Seni Budaya | |
| `bahasa_jawa` | Bahasa Jawa | |
| `penjas` | PenJas | |
| `mandarin` | Bahasa Mandarin | |
| `bk` | BK | |
| `native_mandarin` | Native Mandarin | |
| `coding` | Coding | |

---

## ⚠️ Catatan Penting

### 1. File harus berstatus **"Anyone with the link" → Viewer**
Jika tidak, server tidak bisa mengunduh PDF. Cara cek: buka link tersebut di browser **mode incognito** — jika bisa dibuka, maka server juga bisa.

### 2. Ukuran file
Untuk performa terbaik, usahakan PDF di bawah **10 MB**. File terlalu besar akan lambat dimuat siswa.

### 3. Jika diisi File ID yang salah / file tidak bisa diakses
Sistem akan otomatis memakai **PDF demo** sebagai fallback — alur ujian tetap berjalan, tapi isinya PDF contoh (bukan soal asli).

### 4. Alternatif: Env Variables di Vercel (kurang disarankan)
Cara ini juga bisa (bukan melalui Supabase), tapi harus redeploy/redeploy saat ganti file:
- Buka **Vercel → Project → Settings → Environment Variables**
- Tambahkan `DRIVE_ID_INDONESIA=<File ID>`, `DRIVE_ID_MATEMATIKA=<File ID>`, dst.
- Redeploy

> ⭐ **Prioritas sistem**: File ID di tabel `exams` Supabase **selalu menang** dibanding env var.

---

## 🧪 Cara Menguji

1. Buka **https://portal-sumatif-thhk.vercel.app**
2. Login siswa yang mapelnya sudah diisi File ID (contoh: `calvin` / `thhk2026` — Bahasa Indonesia)
3. Isi presensi → masukkan token (`TOKEN9A`)
4. PDF dari Google Drive akan muncul di penampil aman

Jika PDF demo yang muncul (bukan soal asli), berarti File ID belum diisi atau file tidak publik.