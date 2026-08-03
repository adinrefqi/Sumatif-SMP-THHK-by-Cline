# PRD — Portal Ujian Sumatif SMP THHK & Rencana Aplikasi Android

> Dokumen ringkasan seluruh kegiatan + rencana lanjutan.
> Dibuat agar mudah dibaca kembali saat sesi dilanjutkan.

---

## 1. Ringkasan Proyek

**Aplikasi**: Portal Ujian Sumatif berbasis browser aman untuk SMP Tunas Hidup Harapan Kita.
**Arsitektur**: GitHub (sumber kode) → Vercel (hosting serverless) → Supabase (database).
**Fitur utama**: Proxy PDF Google Drive (URL asli tidak terlihat siswa), penampil PDF Canvas (PDF.js), presensi wajib, gerbang token, Berita Acara pengawas, Live Monitor real-time, pelacakan aktivitas mencurigakan.

---

## 2. Status Infrastruktur (✅ SELESAI & LIVE)

| Layanan | Detail |
|---------|--------|
| **GitHub** | https://github.com/adinrefqi/Sumatif-SMP-THHK-by-Cline |
| **Vercel (live)** | https://portal-sumatif-thhk.vercel.app (auto-deploy dari branch `main`) |
| **Supabase** | Project `lphulmkqihujlycxbbzn` — env vars `SUPABASE_URL` + `SUPABASE_ANON_KEY` tersimpan di Vercel |

### Riwayat commit penting
| Commit | Isi |
|--------|-----|
| `e6ec707` | Initial commit + setup Vercel/Supabase |
| `d0201ae` | Fix sesi persisten serverless (state alur ujian di tabel users) |
| `452e17e` | 19 mapel asli SMP THHK |
| `b14778c` | +27 siswa Kelas 9 |
| `83725df` | +14 siswa Kelas 8 |
| `ab3568f` | +10 siswa Kelas 7 |
| `1e435e1` | +8 pengawas SMP THHK |
| `8a55aa1` | +akun admin super user (admin/admin123, tanpa Berita Acara) |
| `99549bd` | +GOOGLE-DRIVE-GUIDE.md |
| `cbfdd48` | PDF berbeda per kelas (struktur exams class_name) |

---

## 3. Struktur Database Supabase

| Tabel | Fungsi | Status |
|-------|--------|--------|
| `users` | Sesi & autentikasi + state alur ujian (`attendance_done`, `berita_acara_done`, `token_valid`, `exam_key`, `token_label`) | ✅ |
| `exam_tokens` | Token ujian (TOKEN9A/B/C ter-seed) | ✅ |
| `attendance` | Presensi siswa | ✅ |
| `berita_acara` | Berita Acara pengawas | ✅ |
| `tracking_activity` | Log aktivitas real-time | ✅ |
| `exams` | **76 baris**: 19 mapel × 4 level (`''` default, `7`, `8`, `9`) — PDF berbeda per kelas | ✅ |

### Migrasi SQL yang sudah dijalankan di Supabase
| Migrasi | Isi |
|---------|-----|
| `schema.sql` | Tabel inti + RLS |
| `003_add_state_columns_only.sql` | Kolom state alur ujian di `users` |
| `004_add_exams_table.sql` | Tabel `exams` (versi awal 19 mapel) |
| `005_update_exams_smp_thhk.sql` | 19 mapel SMP THHK |
| `006_add_class_level_to_exams.sql` | **PDF per kelas** — class_name + 76 baris |

---

## 4. Akun Terdaftar (semua password `thhk2026`, kecuali disebut)

| Jenis | Username | Jumlah |
|-------|----------|--------|
| **Admin super user** | `admin` / `admin123` (tanpa Berita Acara) | 1 |
| **Pengawas SMP THHK** | `adin`, `sunedi`, `faizal`, `atmo`, `thevea`, `widaningsih`, `dyfa`, `morys` | 8 |
| **Siswa Kelas 9** (9A=9, 9B=10, 9C=8) | `calvin`, `celine`, ... `yuriko` | 27 |
| **Siswa Kelas 8** (8A=7, 8B=7) | `cathleen`, ... `vincentius` | 14 |
| **Siswa Kelas 7** (7A=10) | `aerilyn`, ... `velove` | 10 |
| Demo (dapat dihapus nanti) | `siswa1/2/3` (password `rahasia123`) | 3 |

---

## 5. Cara Mengisi PDF Soal (3 Langkah)

1. **Upload PDF** ke Google Drive → **Share** → "Anyone with the link" → **Viewer**
2. **Salin File ID** dari link (`/d/<FILE_ID>/view`)
3. **Tempel ke Supabase** → Table Editor → `exams` → kolom `drive_file_id`
   - Untuk PDF per kelas: pilih baris dengan `class_name = '7'/'8'/'9'` sesuai kelas siswa
   - Panduan lengkap ada di **`GOOGLE-DRIVE-GUIDE.md`**

> ⭐ Prioritas sistem: tabel `exams` > env var Vercel > PDF demo.

---

## 6. Rencana Aplikasi Android (✅ SEDANG DIKERJAKAN)

### Tujuan
Membuat **APK Android kustom "Exambrowser THHK"** (WebView kiosk) untuk 70 HP pribadi siswa, dengan keamanan menyerupai RDEV Exambrowser (https://r-developer.my.id/fitur-aplikasi/).

### Keputusan yang sudah dibahas
- **BYOD** (HP pribadi siswa) → tidak bisa kiosk penuh via Device Admin; pakai **Accessibility Service** + teknik app-level
- **Target**: minSdk 24 (Android 7) → targetSdk 35 (terbaru)
- **RDEV dianalisis** — kiosk penuh via Accessibility Service + anti virtual Android + anti floating apps 99.99%
- **Keputusan**: buat custom APK sendiri yang **mengadopsi konsep RDEV** (bukan menyalin kode), fokus awalnya pada **anti floating apps** yang sangat penting

### Fitur yang akan dibuat (prioritas)
| # | Fitur | Prioritas |
|---|-------|-----------|
| 1 | **Anti Floating Apps** (Accessibility Service, 3 lapis deteksi: window state, handsake split-screen, izin overlay) | 🔥 WAJIB |
| 2 | Anti screenshot & rekam layar (`FLAG_SECURE`) | 🔥 WAJIB |
| 3 | Blokir Back → PIN admin | 🔥 WAJIB |
| 4 | Deteksi pindah app → alarm 95% + reset + kirim event ke Live Monitor | 🔥 WAJIB |
| 5 | Anti split-screen & dual app | 🔥 WAJIB |
| 6 | Blokir notifikasi & app lain | 🔥 WAJIB |
| 7 | Fullscreen immersive 95% | ✅ |
| 8 | Blokir navigasi keluar domain portal | ✅ |
| 9 | Anti copy-paste / clipboard | ✅ |
| 10 | Blokir unduhan & file chooser | ✅ |
| 11 | PIN masuk aplikasi | ✅ |
| 12 | Root/emulator detection dasar | ✅ |
| 13 | Mode "Selesai Ujian" + PIN guru | ✅ |
| 14 | QR Code sesi (opsional) | 🎯 |

### Cara kerja anti floating apps (3 lapis)
1. **Lapis 1**: `AccessibilityService.onAccessibilityEvent` → monitor `TYPE_WINDOW_STATE_CHANGED` → jika muncul package ≠ aplikasi kita → alarm + kembali ke app ujian
2. **Lapis 2**: `onWindowFocusChanged(false)` + `TYPE_WINDOWS_CHANGED` + layar masih fokus kita → deteksi floating/overlay kecil (chat head, PiP, bubble)
3. **Lapis 3**: Cek aplikasi dengan izin "Display over other apps" (`Settings.canDrawOverlays`) → lapor ke server

**Saat terdeteksi**: alarm keras + flash merah + force kembali + **kirim event ke `/api/track`** → muncul di Live Monitor pengawas + tercatat di `tracking_activity` Supabase.

### Status environment build
| Komponen | Status |
|----------|--------|
| Java 17 (OpenJDK) | ✅ Terpasang |
| Gradle Wrapper 8.9 | ✅ Terpasang (`gradlew.bat`) |
| Android SDK (platform 35) | ✅ Terpasang |
| Build APK Debug | ✅ **Berhasil** (`app-debug.apk` 5.98 MB) |
| Build APK Release signed | ⏳ Belum (perlu keystore) |

### Progres implementasi (commit `94c263f`)
- ✅ `MainActivity` WebView kiosk + `FLAG_SECURE` + immersive fullscreen
- ✅ `AccessibilityService` 3 lapis anti floating apps + anti keluar
- ✅ `ExamGuardService` foreground penjaga ujian
- ✅ Back block → PIN admin/guru (SHA-256 hash)
- ✅ Blokir upload/file chooser/unduhan/copy-paste
- ✅ Deteksi root/emulator + blokir domain keluar portal
- ✅ Track event pelanggaran ke Live Monitor via `/api/track`
- ✅ Gradle Wrapper 8.9 + fix error kompilasi `SecurityUtils`
- ✅ `.gitignore` Android (build artifacts, keystore, local.properties)

### Langkah selanjutnya (saat lanjut di ACT MODE)
1. Buat keystore signing (`keytool`) + `build.gradle.kts` signing config
2. Build APK release signed (`assembleRelease`)
3. Dokumentasi setup 70 HP (izin aksesibilitas + overlay + instal APK)
4. Uji di perangkat nyata (Xiaomi/Samsung/OPPO — perbedaan fitur kiosk)
5. Opsional: QR Code sesi

---

## 7. Pertanyaan yang Masih Menunggu Jawaban (untuk Android)

1. Kapan jadwal ujian sumatif? (menentukan urgensi)
2. Apakah anggaran memungkinkan lisensi RDEV sebagai cadangan/backup?
3. Merk HP siswa mayoritas? (Samsung/Xiaomi/OPPO/dll — fitur kiosk beda per merk)
4. Sudah ada Android Studio atau cukup setup SDK CLI?

---

## 8. Cara Melanjutkan Sesi Ini Nanti

1. **Buka Antigravity IDE** → buka folder `d:\aplikasi\Sumatif THHK by cline`
2. Lanjutkan percakapan dengan Cline → minta lanjut dari **Bagian 6 (Rencana Aplikasi Android)**
3. Sistem akan otomatis mengingat commit terakhir dan todo list yang tersimpan