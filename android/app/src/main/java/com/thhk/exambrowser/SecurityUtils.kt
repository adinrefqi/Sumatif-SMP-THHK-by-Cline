package com.thhk.exambrowser

import android.accessibilityservice.AccessibilityServiceInfo
import android.app.AppOpsManager
import android.content.ComponentName
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.provider.Settings
import android.view.accessibility.AccessibilityManager
import java.io.File

/**
 * Utilitas keamanan: deteksi root/emulator, overlay, aksesibilitas.
 */
object SecurityUtils {

    /**
     * Deteksi aksesibilitas layanan kita aktif atau tidak.
     */
    fun isAccessibilityServiceEnabled(ctx: Context, serviceClass: Class<*>): Boolean {
        val am = ctx.getSystemService(Context.ACCESSIBILITY_SERVICE) as AccessibilityManager
        val expected = ComponentName(ctx, serviceClass)
        val enabled = am.getEnabledAccessibilityServiceList(
            AccessibilityServiceInfo.FEEDBACK_ALL_MASK
        )
        return enabled.any { it.resolveInfo.serviceInfo != null &&
            it.resolveInfo.serviceInfo.packageName == expected.packageName &&
            it.resolveInfo.serviceInfo.name == expected.className }
    }

    /**
     * Apakah app ini punya izin "Display over other apps".
     * Dipakai Lapis 3 deteksi floating apps.
     */
    fun canDrawOverlays(ctx: Context): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            Settings.canDrawOverlays(ctx)
        } else {
            // Pre-M: cek via AppOps (best effort)
            try {
                val appOps = ctx.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
                val mode = appOps.checkOpNoThrow(
                    AppOpsManager.OPSTR_SYSTEM_ALERT_WINDOW,
                    android.os.Process.myUid(),
                    ctx.packageName
                )
                mode == AppOpsManager.MODE_ALLOWED
            } catch (e: Exception) {
                false
            }
        }
    }

    /**
     * Deteksi emulator (dasar).
     */
    fun isEmulator(): Boolean {
        val fingerprints = listOf(
            "generic", "android/sdk_gphone", "google/sdk_gphone",
            "google_sdk", "sdk_gphone", "emulator", "ranchu"
        )
        var result = Build.FINGERPRINT.lowercase().contains("generic") ||
            Build.FINGERPRINT.lowercase().contains("emulator") ||
            Build.MODEL.contains("google_sdk") ||
            Build.MODEL.lowercase().contains("emulator") ||
            Build.MODEL.contains("Android SDK built for x86") ||
            Build.MANUFACTURER.contains("Genymotion") ||
            Build.BRAND.startsWith("generic") && Build.DEVICE.startsWith("generic") ||
            Build.PRODUCT.contains("sdk")

        // Cek hardware specific
        if (!result) {
            result = (Build.HARDWARE == "goldfish" || Build.HARDWARE == "ranchu")
        }
        return result
    }

    /**
     * Deteksi root (dasar) dengan pengecekan path umum + binary su.
     */
    fun isRooted(): Boolean {
        val suPaths = listOf(
            "/system/app/Superuser.apk",
            "/sbin/su",
            "/system/bin/su",
            "/system/xbin/su",
            "/data/local/xbin/su",
            "/data/local/bin/su",
            "/system/sd/xbin/su",
            "/system/bin/failsafe/su",
            "/data/local/su",
            "/su/bin/su"
        )
        if (suPaths.any { File(it).exists() }) return true

        return try {
            val process = Runtime.getRuntime().exec(arrayOf("which", "su"))
            val reader = java.io.BufferedReader(java.io.InputStreamReader(process.inputStream))
            val line = reader.readLine()
            process.destroy()
            line != null && line.isNotEmpty()
        } catch (e: Exception) {
            false
        }
    }

    /**
     * Deteksi apakah app kita sedang di screen-pin. (Fitur opsional di beberapa merk.)
     * Catatan: tidak semua versi mendukung; gunakan best-effort.
     */
    fun isPackageInstalled(ctx: Context, packageName: String): Boolean {
        return try {
            ctx.packageManager.getPackageInfo(packageName, 0)
            true
        } catch (e: PackageManager.NameNotFoundException) {
            false
        }
    }

    // Daftar package manager/launcher yang HARUS diblokir saat ujian aktif
    val BLOCKED_PACKAGE_MARKERS = listOf(
            "com.android.settings",
            "com.android.vending",
            "com.google.android.apps.messaging",
            "com.whatsapp",
            "com.facebook.katana",
            "com.instagram.android",
            "com.tiktok",
            "com.google.android.youtube",
            "com.google.android.gm",
            "com.android.chrome",
            "com.microsoft.emmx",
            "org.mozilla.firefox",
            "com.google.android.apps.photos",
            "com.samsung.android.gallery",
            "com.miui.gallery",
            "com.google.android.dialer",
            "com.android.contacts",
            "com.google.android.apps.maps",
            "com.google.android.apps.docs",
            "com.microsoft.office.word",
            "com.microsoft.office.excel",
            "com.microsoft.office.powerpoint",
            "com.google.android.apps.classroom",
            "com.zhiliaoapp.musically",
            "com.discord",
            "com.tencent.mm", // WeChat
            "com.linecorp.LGLG", // LINE
            "com.bsb.hike", // BBM/Hike
            "com.snapchat.android",
            "com.twitter.android",
            "com.linkedin.android",
            "com.pinterest",
            "com.reddit.frontpage",
            "com.spotify.music",
            "com.google.android.play.games",
            "com.roblox.client",
            "com.mobile.legends",
            "com.tencent.ig", // PUBG Mobile
            "com.miHoYo.", // Genshin dll
            "com.activision.callofduty.shooter",
            "com.supercell.clashofclans",
            "com.supercell.brawlstars",
            "com.google.android.apps.authenticator2",
            "com.google.android.apps.tasks",
            "com.google.android.keep",
            "com.microsoft.onenote",
            "com.asus.calculator",
            "com.coloros.calculator",
            "com.miui.calculator",
            "com.huawei.calculator",
            "com.oneplus.calculator",
            "com.sec.android.app.popupcalculator",
            "com.android.calculator2",
            "com.google.android.calculator"
        )

    /**
     * Cek apakah package adalah app yang mencurigakan saat ujian.
     * Gunakan prefix matching agar bisa menangkap varian/keluarga.
     */
    fun isSuspiciousPackage(pkg: String): Boolean {
        val p = pkg.lowercase()
        return BLOCKED_PACKAGE_MARKERS.any { p.startsWith(it.lowercase()) }
    }
}
