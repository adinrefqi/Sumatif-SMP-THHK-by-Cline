# 📱 Panduan Setup 70 HP Siswa — Exambrowser THHK

> Dokumen ini untuk tim IT/pengawas SMP Tunas Hidup Harapan Kita.
> Panduan instalasi APK `Exambrowser THHK` di 70 HP pribadi siswa.

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

> ✅ **Tanpa langkah aktivasi izin khusus!** Aplikasi v1.2.0+ menggunakan **Lock Task Mode (Screen Pinning)** — fitur resmi Android untuk mode kiosk. Tidak perlu izin Aksesibilitas, Overlay, atau Akses Penggunaan Aplikasi.

---

## 3. Cara Mengaktifkan Mode Kiosk (Sekali saat Setup)

Aplikasi otomatis mengaktifkan **Screen Pinning (Lock Task Mode)** saat dibuka. Pada beberapa perangkat, pengguna perlu mengaktifkan Screen Pinning satu kali di setelan:

1. Buka **Setelan → Keamanan → Screen pinning / Kunci tampilan** (nama menu berbeda per merk).
2. Aktifkan **"Screen pinning" / "Kunci tampilan"**.
3. Saat aplikasi ujian terbuka, ikon pin keamanan tidak perlu ditekan — aplikasi mengaktifkannya otomatis.

> **Catatan per merk** (menu bisa berbeda):
> - **Xiaomi/Redmi/Poco**: Setelan → Layar beranda → Kunci tampilan
> - **Samsung**: Setelan → Keamanan dan privasi → Izin lainnya → Kunci tampilan / Pin layar
> - **OPPO/realme**: Setelan → Keamanan → Kunci tampilan
> - **vivo**: Setelan → Keamanan/layar kunci → Kunci tampilan
> - **Huawei**: Setelan → Keamanan & privasi → Lainnya → Kunci tampilan

> Jika Screen Pinning tidak diaktifkan, aplikasi tetap berjalan normal (fullscreen + anti-screenshot + PIN admin), hanya fitur kunci penuh yang memerlukan dukungan perangkat.

---

## 4. Uji Coba Singkat (wajib dilakukan oleh pengawas)

| Uji | Cara | Hasil yang Diharapkan |
|-----|------|----------------------|
| Buka aplikasi | Tap ikon Exambrowser THHK | Portal ujian terbuka, tampil fullscreen tanpa status bar |
| Screenshot | Tekan tombol power + volume bawah | Layar hitam (screenshot diblokir) |
| Back | Tekan tombol Back | Muncul dialog PIN Admin |
| Notifikasi | Geser dari atas | Nav bar/status bar tersembunyi (immersive) |
| Anti keluar aplikasi | Tekan Home/Recent (jika Screen Pinning aktif) | Aplikasi tetap di layar (terkunci) |

---

## 5. PIN Penting (untuk pengawas)

| PIN | Nilai Default | Fungsi |
|-----|---------------|--------|
| **PIN Admin** | `1234` | Keluar aplikasi, buka pengaturan, ubah URL portal |
| **PIN Guru** | `5678` | (Cadangan — dapat dipakai untuk menyelesaikan ujian) |

> ⚠️ **Ganti PIN sebelum ujian!** Cara ganti PIN saat ini hanya melalui kode (sumber terbuka). Untuk keperluan sekolah, hubungi tim IT untuk mengubah default PIN di `Prefs.kt` lalu build ulang APK jika ingin PIN unik per perangkat.

---

## 6. Saat Hari Ujian

1. **Sebelum ujian** (15 menit):
   - Semua siswa membuka **Exambrowser THHK**.
   - Pastikan portal login terbuka.
   - Pengawas memverifikasi di **Live Monitor** bahwa semua siswa sudah login.
2. **Selama ujian**:
   - Siswa **tidak boleh menekan Back** — muncul dialog PIN.
   - Jika siswa keluar aplikasi, perilaku dicatat di server Live Monitor.
   - Semua aktivitas mencurigakan tercatat real-time di **Live Monitor** (`/monitor`).
3. **Selesai ujian**:
   - Pengawas memasukkan **PIN Admin** → pilih **"Keluar Aplikasi"**.

---

## 7. Troubleshooting

| Masalah | Solusi |
|---------|--------|
| APK tidak bisa diinstal | Aktifkan "Instal dari sumber tidak dikenal" di Setelan → Keamanan |
| Aplikasi bisa keluar saat tekan Home | Aktifkan **Screen Pinning** di setelan perangkat (lihat Langkah 3) |
| Portal tidak terbuka | Cek koneksi internet; pastikan URL portal benar (default: `https://portal-sumatif-thhk.vercel.app`) |
| Layar bisa di-screenshot | FLAG_SECURE tidak jalan pada perangkat tertentu — pastikan versi APK terbaru (v1.2.0+) |

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
[ ] Semua HP sudah mengaktifkan Screen Pinning (jika mendukung)
[ ] Uji coba Screenshot/Back sukses di semua HP
[ ] Koneksi internet siswa stabil
[ ] PIN Admin & Guru sudah disepakati tim pengawas
[ ] Live Monitor dibuka di ruang pengawas
[ ] PDF soal sudah diisi di Supabase (lihat GOOGLE-DRIVE-GUIDE.md)