# 📋 Catatan Pekerjaan — Exambrowser THHK

> Dokumen ini mencatat seluruh pekerjaan, masalah, perbaikan, dan build APK.
> Dibuat: 7 Agustus 2026

---

## 📦 Riwayat Versi

| Versi | VersionCode | Tanggal | Deskripsi |
|-------|-------------|---------|-----------|
| 1.6.0 | 9 | 7-Agu-2026 | Sinkronisasi Android ↔ Web: deteksi keluar paksa → notifikasi dashboard admin/pengawas |
| 1.5.1 | 8 | 7-Agu-2026 | Chip jam/baterai estetik, matikan back, tambah tombol OFF ⏻ |
| 1.5.0 | 7 | 7-Agu-2026 | Alarm 95%, reset saat kembali, jam+baterai, deteksi headset & dual layar, blokir notifikasi |
| 1.4.0 | 6 | 7-Agu-2026 | Fitur anti-floating apps (deteksi kehilangan fokus → alarm + layar hitam + force close) |
| 1.3.1 | 5 | 7-Agu-2026 | Alarm 85% + force close saat keluar + fix "keluar balik lagi" |
| 1.3.0 | 4 | 7-Agu-2026 | Fix bug "keluar tapi balik lagi" (guard isExiting) |
| 1.2.0 | 3 | 7-Agu-2026 | Bersihkan semua izin sensitif (anti Play Protect). Ganti ke Lock Task Mode |
| 1.1.0 | 2 | 4-Agu-2026 | Versi sebelumnya (TERBLOKIR Google Play Protect) |
| 1.0.0 | 1 | — | Versi awal |

---

## 🚨 Masalah Utama yang Ditemukan

### 1. APK diblokir Google Play Protect (Masalah Awal)
**Gejala**: Notifikasi "Aplikasi ini dapat meminta akses ke data sensitif... resiko pencurian identitas atau penipuan keuangan" saat instal.

**Penyebab**: APK v1.1.0 memakai kombinasi izin yang menyerupai spyware/malware:
- `AccessibilityService` (canRetrieveWindowContent + canTakeScreenshot + canPerformGestures)
- `SYSTEM_ALERT_WINDOW` (overlay)
- `PACKAGE_USAGE_STATS`
- `Foreground service specialUse`

**Solusi (v1.2.0)**:
- Hapus SEMUA izin sensitif dari `AndroidManifest.xml`
- Hapus file: `ExamAccessibilityService.kt`, `ExamGuardService.kt`, `AlarmManager.kt`, `accessibility_service_config.xml`
- Ganti keamanan dengan **Lock Task Mode (Screen Pinning)** — fitur kiosk RESMI Android
- Hanya tersisa izin normal: `INTERNET`, `ACCESS_NETWORK_STATE`, `VIBRATE`

### 2. Bug "Keluar Tapi Balik Lagi" (v1.2.0)
**Gejala**: Setelah PIN benar → pilih "Keluar Aplikasi" → app keluar sebentar → langsung balik lagi terkunci.

**Penyebab**: Callback `onResume()` dan `onWindowFocusChanged(true)` selalu memanggil `enterLockTaskMode()` tanpa terkecuali. Saat `finishAffinity()`, callback lifecycle dipanggil sekilas → `startLockTask()` lagi → terkunci kembali.

**Solusi (v1.3.0)**:
- Tambah flag `private var isExiting = false`
- Guard `onResume()`: hanya re-lock jika `!isExiting`
- Guard `onWindowFocusChanged()`: hanya re-lock jika `!isExiting`
- Set `isExiting = true` SEBELUM `stopLockTask()` di menu "Nonaktifkan Mode Ujian" & "Keluar Aplikasi"

### 3. Revisi: Alarm 85% + Force Close (v1.3.1)
**Permintaan**: Saat keluar aplikasi, otomatis bunyi alarm 85% + force close paksa.

**Implementasi**:
- Buat file baru `AlarmUtils.kt`:
  - `playAlarm()` — MediaPlayer + RingtoneManager + AudioManager untuk volume 85%
  - `playAlarmAndForceClose()` — alarm 85% + delay 1,5 detik + `killProcess()`
- Panggil `AlarmUtils.playAlarmAndForceClose(this)` saat pilih "Keluar Aplikasi"

### 7. Sinkronisasi Android ↔ Web (v1.6.0)
**Permintaan**: Sinkronkan aplikasi Android dengan apps web - terutama jika siswa keluar aplikasi secara paksa (melepas sematan/screen pinning) agar muncul notifikasi di dashboard admin & pengawas.

**Cara kerja**:
- **Android** (`MainActivity.kt`): Tambah `onStop()` → kirim event `keluar_paksa` ke `/api/track` via `TrackEventTask` (dengan cookie sesi siswa yang sama → identitas siswa terdeteksi otomatis)
- **Server** (`server/index.js`): Endpoint `/api/track` & `/api/monitor` sudah ada — event masuk ke tabel tracking & Live Monitor
- **Web** (`public/js/app.js`):
  - Tambah `EVENT_LABELS` untuk semua event dari Android (keluar_paksa, floating_app, back_diblokir, etc.)
  - Tambah `VIOLATION_EVENTS` (set event pelanggaran serius)
  - Tambah `checkForViolationAlerts()` — deteksi event pelanggaran BARU → tampilkan toast notifikasi menonjol `🚨 NamaSiswa — KELUAR PAKSA` di dashboard
  - Update `loadMonitor()` (polling 4 detik) → panggil `checkForViolationAlerts()`

**Hasil**: Saat siswa melepas screen pinning / keluar paksa dari APK Android, dalam ≤4 detik muncul notifikasi `🚨` di dashboard Live Monitor admin & pengawas beserta nama siswa, kelas, dan detail.

### 6. Perbaikan Tampilan & Tombol OFF (v1.5.1)
**Permintaan**: Tampilan jam/baterai kurang estetik (menutupi webview), matikan fitur back/swipe back, ganti dengan tombol OFF.

**Implementasi**:
- `bg_status_chip.xml` & `bg_power_button.xml` (BARU): drawable untuk chip status & tombol power
- `activity_main.xml`: Chip jam/baterai diperkecil di pojok kanan atas (transparan 40%, format `HH:mm` + `87%`), tambah `powerOffButton` ⏻ di pojok kanan bawah
- `AndroidManifest.xml`: `enableOnBackInvokedCallback="false"` (matikan predictive back Android 13+)
- `MainActivity.kt`:
  - Tombol back **DINONAKTIFKAN SEPENUHNYA** (hanya toast "Gunakan tombol OFF")
  - `setupPowerOffButton()` — tombol OFF ⏻ → dialog PIN → menu keluar
  - Jam format `HH:mm` (tidak lagi `HH:mm:ss`) agar chip kecil
  - Baterai tanpa emoji besar (hanya `87%` / `⚡87%`)

### 5. Fitur Tambahan Keamanan (v1.5.0)
**Permintaan**: Alarm 95%, reset saat kembali, jam+baterai, deteksi headset & dual layar, blokir notifikasi.

**Implementasi**:
- **Alarm 95%** (#13): Volume alarm diubah dari 85% → 95% di `AlarmUtils.kt`
- **Reset saat kembali** (#4): `resetExamIfReturned()` — reload portal jika app kembali dari background
- **Jam & baterai** (#23, #24): Overlay `examStatusBar` dengan jam `HH:mm:ss` + level baterai + indikator charging (update tiap 1 detik)
- **Deteksi headset** (#30): `BroadcastReceiver` untuk `ACTION_HEADSET_PLUG`
- **Deteksi dual layar** (#12): `isInMultiWindowMode` + `onMultiWindowModeChanged`
- **Blokir notifikasi**: `ACCESS_NOTIFICATION_POLICY` (izin normal) + Do Not Disturb (`INTERRUPTION_FILTER_NONE`)

### 4. Fitur Anti Floating Apps (v1.4.0)
**Permintaan**: Tambah fitur anti floating apps karena bisa dipakai siswa untuk mencontek.

**Cara kerja**:
- Deteksi `onWindowFocusChanged(false)` — sinyal ada window lain (chat head, PiP, bubble, overlay) muncul di atas app
- Tanpa AccessibilityService / overlay / usage stats (aman Play Protect)

**Implementasi**:
- `activity_main.xml`: tambah `floatingPunishmentOverlay` — layar hukuman hitam (di dalam Activity, bukan SYSTEM_ALERT_WINDOW)
- `strings.xml`: string `floating_detected`
- `colors.xml`: tambah `alarm_red`
- `AlarmUtils.kt`: tambah `punishFloatingApp()` — alarm 85% + animasi layar hitam + force close setelah 3 detik
- `MainActivity.kt`: `onWindowFocusChanged(false)` → `handlePossibleFloatingWindow()` dengan cooldown 5 detik → kirim ke Live Monitor + alarm + layar hukuman + force close

---

## 📁 Perubahan File (Semua Versi)

### v1.2.0 — Bersihkan Izin Sensitif
| File | Aksi |
|------|------|
| `android/app/src/main/AndroidManifest.xml` | Tulis ulang — hapus semua izin sensitif & service |
| `android/app/src/main/java/com/thhk/exambrowser/MainActivity.kt` | Tulis ulang — ganti ke Lock Task Mode |
| `android/app/src/main/java/com/thhk/exambrowser/SecurityUtils.kt` | Sederhanakan — hapus fungs aksesibilitas/overlay |
| `android/app/src/main/java/com/thhk/exambrowser/Prefs.kt` | Sederhanakan — hapus fungsi aksesibilitas/overlay |
| `android/app/src/main/res/values/strings.xml` | Hapus string accessibility/guard |
| `android/app/src/main/res/layout/activity_main.xml` | Hapus `alarmFlashOverlay` |
| `android/app/src/main/res/values/colors.xml` | Hapus `alarm_red` |
| `android/app/src/main/java/com/thhk/exambrowser/security/ExamAccessibilityService.kt` | **DIHAPUS** |
| `android/app/src/main/java/com/thhk/exambrowser/security/ExamGuardService.kt` | **DIHAPUS** |
| `android/app/src/main/java/com/thhk/exambrowser/AlarmManager.kt` | **DIHAPUS** |
| `android/app/src/main/res/xml/accessibility_service_config.xml` | **DIHAPUS** |
| `android/SETUP-70-HP.md` | Perbarui — tanpa 3 izin, pakai Screen Pinning |
| `android/app/build.gradle.kts` | versionCode 3, versionName 1.2.0 |

### v1.3.0 — Fix Bug "Keluar Balik Lagi"
| File | Aksi |
|------|------|
| `android/app/src/main/java/com/thhk/exambrowser/MainActivity.kt` | Tambah flag `isExiting` + guard lifecycle + set di openSettings |
| `android/app/build.gradle.kts` | versionCode 4, versionName 1.3.0 |

### v1.3.1 — Alarm 85% + Force Close
| File | Aksi |
|------|------|
| `android/app/src/main/java/com/thhk/exambrowser/AlarmUtils.kt` | **BARU** — alarm + force close |
| `android/app/src/main/java/com/thhk/exambrowser/MainActivity.kt` | Panggil `AlarmUtils.playAlarmAndForceClose()` |
| `android/app/build.gradle.kts` | versionCode 5, versionName 1.3.1 |

### v1.4.0 — Anti Floating Apps
| File | Aksi |
|------|------|
| `android/app/src/main/res/layout/activity_main.xml` | Tambah `floatingPunishmentOverlay` layar hukuman hitam |
| `android/app/src/main/res/values/strings.xml` | Tambah string `floating_detected` |
| `android/app/src/main/res/values/colors.xml` | Tambah warna `alarm_red` |
| `android/app/src/main/java/com/thhk/exambrowser/AlarmUtils.kt` | Tambah `punishFloatingApp()` |
| `android/app/src/main/java/com/thhk/exambrowser/MainActivity.kt` | Deteksi `onWindowFocusChanged(false)` → hukuman floating |
| `android/app/build.gradle.kts` | versionCode 6, versionName 1.4.0 |

### v1.5.0 — Fitur Keamanan Tambahan
| File | Aksi |
|------|------|
| `android/app/src/main/AndroidManifest.xml` | Tambah izin `ACCESS_NOTIFICATION_POLICY` (normal) |
| `android/app/src/main/res/layout/activity_main.xml` | Tambah `examStatusBar` (jam + baterai) |
| `android/app/src/main/java/com/thhk/exambrowser/AlarmUtils.kt` | Ubah volume alarm 85% → 95% |
| `android/app/src/main/java/com/thhk/exambrowser/MainActivity.kt` | Tambah: jam+baterai, reset saat kembali, deteksi headset, deteksi dual layar, blokir notifikasi |
| `android/app/build.gradle.kts` | versionCode 7, versionName 1.5.0 |

### v1.5.1 — Perbaikan Tampilan & Tombol OFF
| File | Aksi |
|------|------|
| `android/app/src/main/res/drawable/bg_status_chip.xml` | **BARU** - chip transparan untuk jam/baterai |
| `android/app/src/main/res/drawable/bg_power_button.xml` | **BARU** - tombol power merah |
| `android/app/src/main/res/layout/activity_main.xml` | Chip jam/baterai kecil di pojok kanan atas + tombol OFF ⏻ |
| `android/app/src/main/AndroidManifest.xml` | `enableOnBackInvokedCallback="false"` |
| `android/app/src/main/java/com/thhk/exambrowser/MainActivity.kt` | Matikan back total, setupPowerOffButton(), jam HH:mm |
| `android/app/build.gradle.kts` | versionCode 8, versionName 1.5.1 |

### v1.6.0 — Sinkronisasi Android ↔ Web
| File | Aksi |
|------|------|
| `android/app/src/main/java/com/thhk/exambrowser/MainActivity.kt` | Tambah `onStop()` → kirim event `keluar_paksa` |
| `public/js/app.js` | Tambah `EVENT_LABELS`, `VIOLATION_EVENTS`, `checkForViolationAlerts()` |
| `android/app/build.gradle.kts` | versionCode 9, versionName 1.6.0 |

---

## 🛠️ Perbaikan Lingkungan Build

| Masalah | Solusi |
|---------|--------|
| `local.properties` menunjuk SDK yang tidak ada | Ubah ke `D:\Android\Sdk` |
| Build-Tools 34 tidak terinstal | Set `buildToolsVersion = "35.0.0"` (sudah ada) |
| Gradle 8.9 belum terunduh | Otomatis terunduh saat build pertama |

---

## 📊 Hasil Verifikasi APK (aapt/apkanalyzer)

### Izin yang tersisa (100% normal & aman):
```
android.permission.INTERNET
android.permission.ACCESS_NETWORK_STATE
android.permission.VIBRATE
com.thhk.exambrowser.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION (internal AndroidX)
```

### Izin yang TIDAK ADA (dipastikan):
```
✗ BIND_ACCESSIBILITY_SERVICE  ✓ TIDAK ADA
✗ SYSTEM_ALERT_WINDOW         ✓ TIDAK ADA
✗ PACKAGE_USAGE_STATS         ✓ TIDAK ADA
✗ FOREGROUND_SERVICE          ✓ TIDAK ADA
✗ POST_NOTIFICATIONS          ✓ TIDAK ADA
✗ <service> apa pun            ✓ TIDAK ADA
```

---

## 🔑 Informasi Penting Aplikasi

| Item | Nilai |
|------|-------|
| **Package** | `com.thhk.exambrowser` |
| **Min SDK** | 24 (Android 7.0) |
| **Target SDK** | 35 (Android 15) |
| **Compile SDK** | 35 |
| **Build Tools** | 35.0.0 |
| **URL Portal** | `https://portal-sumatif-thhk.vercel.app` |
| **PIN Admin (default)** | `1234` |
| **PIN Guru (default)** | `5678` |

### Alur Keluar Aplikasi (v1.3.1)
```
Back → PIN benar (1234/5678) → Menu Keamanan → "Keluar Aplikasi"
→ 📢 Alarm berbunyi 85%
→ 1,5 detik
→ 💥 Force close (killProcess)
→ App tertutup paksa ✅
```

---

## 🚀 Build APK

```bash
# Clean + build
cd android
gradlew.bat clean assembleRelease

# Tanpa clean (lebih cepat)
gradlew.bat assembleRelease

# Hasil
app/build/outputs/apk/release/app-release.apk
```

---

## ✅ Checklist Kondisi Saat Ini

- [x] APK v1.6.0 ter-build sukses (6m 55s)
- [x] Sinkronisasi Android ↔ Web AKTIF (keluar paksa → notifikasi dashboard)
- [x] Chip jam/baterai estetik (tidak menutupi webview)
- [x] Tombol back/swipe back MATI total
- [x] Tombol OFF ⏻ aktif di pojok kanan bawah
- [x] Google Play Protect TIDAK memblokir (hanya izin normal)
- [x] Bug "keluar tapi balik lagi" TERATASI
- [x] Alarm 95% + force close AKTIF saat keluar
- [x] Anti floating apps AKTIF (deteksi kehilangan fokus → alarm + layar hitam + force close)
- [x] Blokir notifikasi AKTIF (Do Not Disturb)
- [x] Reset portal saat kembali dari background AKTIF
- [x] Jam + baterai di halaman ujian AKTIF
- [x] Deteksi headset AKTIF
- [x] Deteksi dual layar AKTIF
- [x] PIN Admin `1234` / Guru `5678`
- [x] Anti-screenshot (FLAG_SECURE)
- [x] Immersive fullscreen
- [x] Blokir keluar domain portal
- [x] Blokir upload & copy-paste
- [x] Tracking ke Live Monitor
- [x] Lock Task Mode kiosk
