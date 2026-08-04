# 📱 Panduan Setup 70 HP Siswa — Exambrowser THHK

> Dokumen ini untuk tim IT/pengawas SMP Tunas Hidup Harapan Kita.
> Panduan instalasi APK `Exambrowser THHK` di 70 HP pribadi siswa beserta aktivasi izin keamanan.

---

## 1. Persiapan

### Yang dibutuhkan
| Barang | Keterangan |
|--------|-----------|
| File APK | `android/app/build/outputs/apk/release/app-release.apk` (±1.7 MB) |
| Kabel USB / aplikasi kirim file (ShareIt, Xender, atau WhatsApp) | Untuk transfer APK ke HP |
| Google Drive | Alternatif hosting APK untuk dibagikan via link |
| HP siswa | Android 7.0 (API 24) ke atas |
| PIN Admin & Guru | Default: **Admin `1234`**, **Guru `5678`** — ganti saat setup sekolah |

### Cara transfer APK ke HP (pilih salah satu)
1. **Kabel USB** → colok HP ke laptop → salin `app-release.apk` ke folder Download HP → buka file di HP.
2. **Google Drive** → upload `app-release.apk` ke Drive → Share link → buka link di HP → unduh.
3. **WhatsApp / ShareIt** → kirim file ke grup pengawas → unduh di masing-masing HP.

> ⚠️ Jika HP memblokir instalasi dari sumber tidak dikenal, ikuti Langkah 2 di bawah.

---

## 2. Instal APK

1. Buka file `app-release.apk` yang sudah di-transfer.
2. Jika muncul peringatan **"Instal aplikasi dari sumber tidak dikenal?"**:
   - Tap **Setelan / Settings** → aktifkan **"Izinkan dari sumber ini" (Allow from this source)**.
   - Kembali → tap **Install**.
3. Tunggu hingga selesai → tap **Selesai** (jangan langsung Buka dulu).
4. Pastikan ikon **"Exambrowser THHK"** muncul di layar HP.

---

## 3. Aktivasi Keamanan (WAJIB — 3 Izin)

> Langkah ini paling penting. Tanpa izin ini, aplikasi tetap berjalan TETAPI keamanan anti-keluar & anti-floating TIDAK aktif.

### A. Buka Aplikasi & Atur PIN (sekali saja)
1. Buka **Exambrowser THHK**.
2. Akan muncul dialog **"⚠️ Pengaturan Keamanan Diperlukan"** → tap **Buka Pengaturan**.
3. Buka tabel di bawah untuk aktivasi izin.

### B. Aktivasi 3 Izin

| # | Izin | Cara Aktivasi | Lokasi Menu |
|---|------|---------------|-------------|
| 1 | **Layanan Aksesibilitas** | Setelan → Aksesibilitas → **"Keamanan Ujian Exambrowser THHK"** → aktifkan → **OK** | Setelan → Aksesibilitas |
| 2 | **Muncul di atas aplikasi lain** (Overlay) | Setelan → Aplikasi → **Exambrowser THHK** → **Muncul di atas aplikasi lain** → aktifkan | Setelan → Aplikasi → Exambrowser THHK |
| 3 | **Akses Penggunaan Aplikasi** (opsional, untuk deteksi lebih kuat) | Setelan → Keamanan/Privasi → **Akses penggunaan aplikasi** → **Exambrowser THHK** → aktifkan | Setelan → Keamanan → Akses penggunaan |

> **Catatan per merk** (menu bisa berbeda):
> - **Xiaomi/Redmi/Poco**: Setelan → Aplikasi → Kelola aplikasi → Exambrowser THHK → Izin lain → aktifkan "Tampil di atas aplikasi lain" & "Akses penggunaan". Aktifkan juga **"Tampilkan di latar"** di Setelan → Baterai → Preferensi aplikasi.
> - **Samsung**: Setelan → Aplikasi → Exambrowser THHK → Izin → "Muncul di atas aplikasi lain". Aksesibilitas di Setelan → Aksesibilitas → Layanan terinstal.
> - **OPPO/realme**: Setelan → Aplikasi → Exambrowser THHK → "Muncul di atas aplikasi lain". Untuk penggunaan: Setelan → Keamanan → Lainnya → Akses penggunaan aplikasi.
> - **vivo**: Setelan → Aplikasi → Manajemen aplikasi → Exambrowser THHK → Izin → "Tampil di atas aplikasi lain".
> - **Huawei**: Setelan → Aplikasi → Aplikasi → Exambrowser THHK → Izin → "Tampilkan di atas aplikasi lain".

### C. Verifikasi
- Buka kembali **Exambrowser THHK**.
- Jika dialog keamanan tidak muncul lagi → ✅ semua izin aktif.
- Jika masih muncul → ada izin yang belum aktif, ulangi langkah B.

---

## 4. Uji Coba Singkat (wajib dilakukan oleh pengawas)

| Uji | Cara | Hasil yang Diharapkan |
|-----|------|----------------------|
| Buka aplikasi | Tap ikon Exambrowser THHK | Portal ujian terbuka, tampil fullscreen tanpa status bar |
| Tekan Home | Tekan tombol Home | Aplikasi langsung kembali ke portal + alarm berbunyi (jika aksesibilitas aktif) |
| Buka aplikasi lain | Coba buka WhatsApp/Chrome | Kembali ke portal + alarm + tercatat di Live Monitor |
| Screenshot | Tekan tombol power + volume bawah | Layar hitam (screenshot diblokir) |
| Back | Tekan tombol Back | Muncul dialog PIN Admin |
| Notifikasi | Geser dari atas | Nav bar/status bar tersembunyi (immersive) |

> Jika uji coba gagal (misal bisa keluar aplikasi), **cek ulang izin Aksesibilitas di Langkah 3**.

---

## 5. PIN Penting (untuk pengawas)

| PIN | Nilai Default | Fungsi |
|-----|---------------|--------|
| **PIN Admin** | `1234` | Keluar aplikasi, buka pengaturan, ubah URL portal, nonaktifkan mode ujian |
| **PIN Guru** | `5678` | (Cadangan — dapat dipakai untuk menyelesaikan ujian) |

> ⚠️ **Ganti PIN sebelum ujian!** Cara ganti PIN saat ini hanya melalui kode (sumber terbuka). Untuk keperluan sekolah, hubungi tim IT untuk mengubah default PIN di `Prefs.kt` lalu build ulang APK jika ingin PIN unik per perangkat.

---

## 6. Saat Hari Ujian

1. **Sebelum ujian** (15 menit):
   - Semua siswa membuka **Exambrowser THHK**.
   - Pastikan portal login terbuka.
   - Pengawas memverifikasi di **Live Monitor** bahwa semua siswa sudah login.
2. **Selama ujian**:
   - Siswa **tidak boleh menekan Home/Recent/Back** — aplikasi akan membunyikan alarm.
   - Jika alarm berbunyi, pengawas mendekati siswa dan memeriksa.
   - Semua pelanggaran tercatat real-time di **Live Monitor** (`/monitor`).
3. **Selesai ujian**:
   - Pengawas memasukkan **PIN Admin** → pilih **"Nonaktifkan Mode Ujian"** atau **"Keluar Aplikasi"**.

---

## 7. Troubleshooting

| Masalah | Solusi |
|---------|--------|
| APK tidak bisa diinstal | Aktifkan "Instal dari sumber tidak dikenal" di Setelan → Keamanan |
| Dialog keamanan terus muncul | Ada izin yang belum aktif — cek Aksesibilitas & Overlay |
| Aplikasi bisa keluar saat tekan Home | Layanan Aksesibilitas belum aktif — aktifkan di Setelan → Aksesibilitas |
| Alarm tidak berbunyi | Cek volume & mode getar HP |
| Portal tidak terbuka | Cek koneksi internet; pastikan URL portal benar (default: `https://portal-sumatif-thhk.vercel.app`) |
| Layar bisa di-screenshot | Mode ujian belum aktif / FLAG_SECURE tidak jalan — pastikan versi APK terbaru |

---

## 8. File APK & Build

| Komponen | Lokasi |
|----------|--------|
| APK Release signed | `android/app/build/outputs/apk/release/app-release.apk` |
| Keystore signing | `android/app/thhk-release.jks` (**JANGAN di-commit / dibagikan!**) |
| Password keystore | Di `android/app/key.properties` (**JANGAN di-commit!**) |
| Build ulang APK | `cd android && gradlew assembleRelease` |

> 🔐 **PENTING**: Jaga `thhk-release.jks` dan `key.properties` dengan aman. Jika hilang, APK tidak bisa di-update dengan tanda tangan yang sama dan semua HP harus di-install ulang.

---

## 9. Checklist Sebelum Ujian (untuk pengawas per kelas)

```
[ ] Semua HP sudah terinstall Exambrowser THHK
[ ] Semua HP sudah aktivasi 3 izin (Aksesibilitas, Overlay, Akses penggunaan)
[ ] Uji coba Home/Screenshot/Back sukses di semua HP
[ ] Koneksi internet siswa stabil
[ ] PIN Admin & Guru sudah disepakati tim pengawas
[ ] Live Monitor dibuka di ruang pengawas
[ ] PDF soal sudah diisi di Supabase (lihat GOOGLE-DRIVE-GUIDE.md)