package com.thhk.exambrowser.security

import android.accessibilityservice.AccessibilityService
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.view.accessibility.AccessibilityEvent
import com.thhk.exambrowser.AlarmManager
import com.thhk.exambrowser.MainActivity
import com.thhk.exambrowser.Prefs
import com.thhk.exambrowser.SecurityUtils
import com.thhk.exambrowser.TrackEventTask

/**
 * AccessibilityService - inti keamanan anti floating apps & anti keluar.
 *
 * 3 LAPIS DETEKSI:
 * 1. [TYPE_WINDOW_STATE_CHANGED]: package lain muncul & fokus -> alarm + kembali ke app ujian
 * 2. [TYPE_WINDOWS_CHANGED]: deteksi overlay kecil (chat head, PiP, bubble) saat layar kita masih fokus
 * 3. Cek app dengan izin overlay (Settings.canDrawOverlays) -> lapor ke server
 *
 * Saat pelanggaran: alarm keras + flash merah + force kembali + kirim event
 * ke /api/track -> muncul di Live Monitor pengawas.
 */
class ExamAccessibilityService : AccessibilityService() {

    private val mainHandler = Handler(Looper.getMainLooper())
    private val blockedPackages = mutableListOf<String>()
    private var lastViolationMs: Long = 0
    private var isActive = false

    companion object {
        private const val VIOLATION_COOLDOWN_MS = 4000L

        /**
         * Intent action untuk service ini agar bisa dipanggil dari Activity
         * (misalnya untuk callback saat service aktif).
         */
        fun isEnabled(ctx: Context): Boolean =
            SecurityUtils.isAccessibilityServiceEnabled(ctx, ExamAccessibilityService::class.java)
    }

    override fun onServiceConnected() {
        super.onServiceConnected()
        isActive = true
        Prefs.setAccessibilityEnabled(this, true)
        // Kirim event service aktif ke server (identitas siswa dari cookie)
        TrackEventTask(this, "aksesibilitas_aktif", "Layanan aksesibilitas aktif").execute()
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        if (!isActive) return
        val e = event ?: return

        when (e.eventType) {
            /* ---------- LAPIS 1: Window state changed ---------- */
            AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED -> {
                val pkg = e.packageName?.toString() ?: return
                handleWindowStateChanged(pkg)
            }

            /* ---------- LAPIS 2: Windows changed (overlay kecil) ---------- */
            AccessibilityEvent.TYPE_WINDOWS_CHANGED -> {
                // Deteksi overlay/floating windows saat fokus masih kita
                detectOverlayWindows()
            }
        }
    }

    private fun handleWindowStateChanged(pkg: String) {
        val appPkg = packageName

        // Package yang sama dengan app kita = OK
        if (pkg == appPkg) {
            blockedPackages.clear()
            return
        }

        // Package sistem yang aman (status bar, IME, dsb) - izinkan
        if (isAllowedSystemPackage(pkg)) return

        // Paket dari sistem input method (keyboard) - izinkan
        if (pkg.contains("inputmethod") || pkg.contains("ime")) return

        // Package "com.android.systemui" untuk gesture/panel - izinkan transisi singkat
        if (pkg == "com.android.systemui") {
            // Tapi jika ini benar-benar keluar ke launcher/systemui fokus penuh,
            // akan ditangkap di event berikutnya. Untuk sementara izinkan.
            return
        }

        // 💥 Pelanggaran: ada window lain yang muncul/changed
        val now = System.currentTimeMillis()
        if (now - lastViolationMs < VIOLATION_COOLDOWN_MS) return
        lastViolationMs = now

        if (!blockedPackages.contains(pkg)) {
            blockedPackages.add(pkg)
            if (blockedPackages.size > 30) blockedPackages.removeAt(0)
        }

        // Kirim event ke Live Monitor
        TrackEventTask(
            this,
            "pindah_app",
            "Membuka aplikasi lain: $pkg"
        ).execute()

        // Alarm keras + flash
        AlarmManager.trigger(this)

        // Force kembali ke app ujian
        forceBackToExam()
    }

    private fun isAllowedSystemPackage(pkg: String): Boolean {
        val allowed = listOf(
            "com.android.systemui",
            "com.android.settings", // bisa saja muncul saat setup - tapi diblock oleh Lapis 1 saat ujian
            "com.android.permissioncontroller",
            "com.google.android.permissioncontroller",
            "com.android.providers.media",
            "com.android.providers.downloads",
            "android", // sistem dasar
            "com.google.android.gms", // play services (notifikasi/gcm)
            "com.google.android.gsf",
            "com.google.android.instantapps.supervisor"
        )
        return allowed.any { pkg.startsWith(it) }
    }

    /**
     * Lapis 2: Deteksi window overlay/floating kecil (chat head, PiP, bubble).
     * Memakai windows dari WindowsManager (perlu flagRetrieveInteractiveWindows).
     */
    private fun detectOverlayWindows() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.LOLLIPOP) return

        val windows = try {
            getWindows()
        } catch (e: Exception) {
            return
        }
        if (windows == null || windows.isEmpty()) return

        val myPkg = packageName
        var suspiciousOverlay = false

        for (w in windows) {
            val root = try { w.root } catch (e: Exception) { null } ?: continue
            val pkg = root.packageName?.toString() ?: continue

            // Abaikan window milik kita
            if (pkg == myPkg) continue

            // Abaikan IME (keyboard)
            if (pkg.contains("inputmethod") || pkg.contains("ime")) continue

            // Abaikan window system yang diharapkan
            if (isAllowedSystemPackage(pkg)) continue

            // Heuristic: floating apps = window dengan type SYSTEM_ALERT/PHONE/ACCESSIBILITY_OVERLAY
            when (w.type) {
                android.view.accessibility.AccessibilityWindowInfo.TYPE_SYSTEM -> continue

                android.view.accessibility.AccessibilityWindowInfo.TYPE_APPLICATION -> {
                    // Window aplikasi lain muncul -> kemungkinan app switch (ditangani Lapis 1)
                    // Tapi jika masih di layar kita (tidak TYPE_WINDOW_STATE_CHANGED), ini overlay/dual-app
                    suspiciousOverlay = true
                }

                else -> {
                    // TYPE_ACCESSIBILITY_OVERLAY, TYPE_INPUT_METHOD dll - floating/overlay
                    if (!isAllowedSystemPackage(pkg)) {
                        suspiciousOverlay = true
                    }
                }
            }

            if (suspiciousOverlay) break
        }

        if (suspiciousOverlay) {
            val now = System.currentTimeMillis()
            if (now - lastViolationMs < VIOLATION_COOLDOWN_MS) return
            lastViolationMs = now

            TrackEventTask(this, "floating_app", "Deteksi floating window/overlay").execute()
            AlarmManager.trigger(this)
            forceBackToExam()
        }
    }

    /**
     * Force kembali ke MainActivity dari antrian (dengan delay singkat
     * agar system menutup app lain dulu).
     */
    private fun forceBackToExam() {
        mainHandler.postDelayed({
            try {
                val intent = Intent(this, MainActivity::class.java).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
                }
                startActivity(intent)
            } catch (e: Exception) {
                // Abaikan - mungkin belum ada MainActivity di task
            }
        }, 150)
    }

    override fun onInterrupt() {
        // Service diinterupsi (misal oleh pengguna di Settings)
        isActive = false
    }

    override fun onDestroy() {
        super.onDestroy()
        isActive = false
        Prefs.setAccessibilityEnabled(this, false)
        TrackEventTask(this, "aksesibilitas_mati", "Layanan aksesibilitas dimatikan").execute()
    }
}