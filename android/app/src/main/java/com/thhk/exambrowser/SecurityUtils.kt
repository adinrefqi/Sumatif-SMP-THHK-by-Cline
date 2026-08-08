package com.thhk.exambrowser

import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import java.io.File

/**
 * Utilitas keamanan: deteksi root/emulator.
 * (Fungsi aksesibilitas & overlay telah dihapus - diganti Lock Task Mode.)
 */
object SecurityUtils {

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
     * Cek apakah package terinstal di perangkat.
     */
    fun isPackageInstalled(ctx: Context, packageName: String): Boolean {
        return try {
            ctx.packageManager.getPackageInfo(packageName, 0)
            true
        } catch (e: PackageManager.NameNotFoundException) {
            false
        }
    }
}