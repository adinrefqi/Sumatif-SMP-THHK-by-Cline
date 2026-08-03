package com.thhk.exambrowser

import android.content.Context
import android.content.SharedPreferences

/**
 * Penyimpanan lokal untuk konfigurasi keamanan aplikasi.
 * PIN admin & guru disimpan ter-hash sederhana agar tidak plain-text.
 */
object Prefs {
    private const val FILE = "exambrowser_prefs"

    // Kunci
    private const val KEY_ADMIN_PIN_HASH = "admin_pin_hash"
    private const val KEY_TEACHER_PIN_HASH = "teacher_pin_hash"
    private const val KEY_ACCESSIBILITY_ENABLED = "accessibility_enabled"
    private const val KEY_OVERLAY_PERMISSION = "overlay_permission"
    private const val KEY_EXAM_MODE = "exam_mode_active"
    private const val KEY_PORTAL_URL = "portal_url"

    // PIN default (ganti saat setup sekolah)
    const val DEFAULT_ADMIN_PIN = "1234"
    const val DEFAULT_TEACHER_PIN = "5678"

    private fun prefs(ctx: Context): SharedPreferences =
        ctx.getSharedPreferences(FILE, Context.MODE_PRIVATE)

    private fun hash(input: String): String =
        // Hash sederhana SHA-256 (hex). Cukup untuk PIN pendek.
        java.security.MessageDigest.getInstance("SHA-256")
            .digest(input.toByteArray())
            .joinToString("") { "%02x".format(it) }

    fun getAdminPin(ctx: Context): String {
        val p = prefs(ctx)
        val h = p.getString(KEY_ADMIN_PIN_HASH, null)
        if (h == null) {
            val def = hash(DEFAULT_ADMIN_PIN)
            p.edit().putString(KEY_ADMIN_PIN_HASH, def).apply()
            return DEFAULT_ADMIN_PIN
        }
        return h // disimpan hashed; bandingkan via checkAdminPin
    }

    fun checkAdminPin(ctx: Context, pin: String): Boolean {
        val stored = prefs(ctx).getString(KEY_ADMIN_PIN_HASH, null)
            ?: hash(DEFAULT_ADMIN_PIN)
        return stored == hash(pin)
    }

    fun setAdminPin(ctx: Context, pin: String) {
        prefs(ctx).edit().putString(KEY_ADMIN_PIN_HASH, hash(pin)).apply()
    }

    fun checkTeacherPin(ctx: Context, pin: String): Boolean {
        val stored = prefs(ctx).getString(KEY_TEACHER_PIN_HASH, null)
            ?: hash(DEFAULT_TEACHER_PIN)
        return stored == hash(pin)
    }

    fun setTeacherPin(ctx: Context, pin: String) {
        prefs(ctx).edit().putString(KEY_TEACHER_PIN_HASH, hash(pin)).apply()
    }

    fun isAccessibilityEnabled(ctx: Context): Boolean =
        prefs(ctx).getBoolean(KEY_ACCESSIBILITY_ENABLED, false)

    fun setAccessibilityEnabled(ctx: Context, enabled: Boolean) {
        prefs(ctx).edit().putBoolean(KEY_ACCESSIBILITY_ENABLED, enabled).apply()
    }

    fun hasOverlayPermission(ctx: Context): Boolean =
        prefs(ctx).getBoolean(KEY_OVERLAY_PERMISSION, false)

    fun setOverlayPermission(ctx: Context, granted: Boolean) {
        prefs(ctx).edit().putBoolean(KEY_OVERLAY_PERMISSION, granted).apply()
    }

    fun isExamMode(ctx: Context): Boolean =
        prefs(ctx).getBoolean(KEY_EXAM_MODE, false)

    fun setExamMode(ctx: Context, active: Boolean) {
        prefs(ctx).edit().putBoolean(KEY_EXAM_MODE, active).apply()
    }

    fun getPortalUrl(ctx: Context): String =
        prefs(ctx).getString(KEY_PORTAL_URL, null)
            ?: ctx.getString(R.string.portal_url)

    fun setPortalUrl(ctx: Context, url: String) {
        prefs(ctx).edit().putString(KEY_PORTAL_URL, url).apply()
    }
}