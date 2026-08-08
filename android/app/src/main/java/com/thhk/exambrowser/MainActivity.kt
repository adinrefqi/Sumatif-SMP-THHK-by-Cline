package com.thhk.exambrowser

import android.annotation.SuppressLint
import android.app.ActivityManager
import android.app.NotificationManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.media.AudioManager
import android.net.Uri
import android.net.http.SslError
import android.os.BatteryManager
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.webkit.CookieManager
import android.webkit.SslErrorHandler
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import com.thhk.exambrowser.databinding.ActivityMainBinding
import com.thhk.exambrowser.databinding.DialogSecurityMenuBinding
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Aktivitas utama: WebView kiosk portal ujian.
 *
 * Keamanan (tanpa izin sensitif - aman dari Google Play Protect):
 * - FLAG_SECURE: anti screenshot & rekam layar
 * - Immersive fullscreen: sembunyikan status bar & nav bar
 * - Lock Task Mode (Screen Pinning): fitur resmi Android untuk mode kiosk.
 * - Anti floating apps: deteksi kehilangan fokus -> alarm + layar hitam + force close
 * - Blokir notifikasi: Do Not Disturb (izin ACCESS_NOTIFICATION_POLICY, normal)
 * - Jam & baterai di halaman ujian
 * - Deteksi headset & dual layar
 * - Reset portal saat app kembali fokus (fitur 4)
 */
class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private lateinit var webView: WebView

    private var filePathCallback: ValueCallback<Array<Uri>>? = null

    private var backPressStartMs: Long = 0

    /**
     * Flag untuk mencegah re-lock saat pengguna sedang keluar/menonaktifkan mode ujian.
     * Tanpa flag ini, callback onResume/onWindowFocusChanged akan memanggil
     * startLockTask() lagi → aplikasi "keluar tapi balik lagi".
     */
    private var isExiting = false

    /**
     * Flag untuk reset portal saat app kembali from background (fitur 4).
     */
    private var wasInBackground = false

    private val mainHandler = Handler(Looper.getMainLooper())
    private var clockRunnable: Runnable? = null

    private var lastHeadsetWarningMs: Long = 0
    private var lastDualScreenWarningMs: Long = 0

    companion object {
        const val PORTAL_HOST = "portal-sumatif-thhk.vercel.app"
    }

    /* ---------------------------------------------------------
     * BroadcastReceiver untuk deteksi headset (fitur 30)
     * --------------------------------------------------------- */
    private val headsetReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            if (intent == null) return
            when (intent.action) {
                Intent.ACTION_HEADSET_PLUG -> {
                    if (!isExiting && Prefs.isExamMode(this@MainActivity)) {
                        handleHeadsetDetected()
                    }
                }
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)
        webView = binding.webView

        // 🔒 Anti screenshot & rekam layar
        window.setFlags(
            WindowManager.LayoutParams.FLAG_SECURE,
            WindowManager.LayoutParams.FLAG_SECURE
        )

        // ⏰ Layar tetap menyala selama aplikasi terbuka (tanpa izin tambahan)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        // ☀️ Set kecerahan layar ke 60% (berlaku untuk window aplikasi ini,
        // tidak memerlukan izin WRITE_SETTINGS)
        val layoutParams = window.attributes
        layoutParams.screenBrightness = 0.6f
        window.attributes = layoutParams

        // Optimasi visual
        window.setBackgroundDrawableResource(R.color.window_background)

        setupWebView()
        setupImmersiveMode()
        setupTouchBlockers()

        // 🔒 Mode kiosk: Lock Task Mode (Screen Pinning) - fitur resmi Android.
        enterLockTaskMode()

        // 🕐 Jam + baterai di halaman ujian (fitur 23 & 24)
        startClockAndBattery()

        // 🚫 Blokir notifikasi: aktifkan Do Not Disturb (fitur blokir notifikasi)
        enableNotificationBlock()

        // 🎧 Deteksi headset (fitur 30)
        registerHeadsetReceiver()

        // ⏻ Tombol OFF: matikan app via PIN
        setupPowerOffButton()

        // Muat portal
        loadPortal()
    }

    /* ---------------------------------------------------------
     * Tombol OFF (pengganti tombol back/swipe back)
     * --------------------------------------------------------- */
    private fun setupPowerOffButton() {
        binding.powerOffButton.setOnClickListener {
            if (!isExiting) {
                showPinDialog(
                    title = getString(R.string.pin_admin_title),
                    hint = getString(R.string.pin_admin_hint),
                    onSuccess = { openSettings() }
                )
            }
        }
    }

    /* ---------------------------------------------------------
     * Jam & Baterai (fitur 23 & 24)
     * --------------------------------------------------------- */
    private fun startClockAndBattery() {
        updateClockAndBattery()
        clockRunnable = object : Runnable {
            override fun run() {
                updateClockAndBattery()
                mainHandler.postDelayed(this, 1000)
            }
        }
        mainHandler.postDelayed(clockRunnable!!, 1000)
    }

    private fun updateClockAndBattery() {
        try {
            // Jam (fitur 24) - format HH:mm agar kecil di chip pojok
            val fmt = SimpleDateFormat("HH:mm", Locale.getDefault())
            binding.examClock.text = fmt.format(Date())

            // Baterai (fitur 23)
            val bm = getSystemService(Context.BATTERY_SERVICE) as BatteryManager
            val level = bm.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY)
            val status = bm.getIntProperty(BatteryManager.BATTERY_PROPERTY_STATUS)
            val charging = status == BatteryManager.BATTERY_STATUS_CHARGING ||
                status == BatteryManager.BATTERY_STATUS_FULL
            binding.examBattery.text = if (charging) "⚡$level%" else "$level%"
        } catch (e: Exception) {
            // Abaikan
        }
    }

    /* ---------------------------------------------------------
     * Blokir Notifikasi (Do Not Disturb)
     * --------------------------------------------------------- */
    private fun enableNotificationBlock() {
        try {
            val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            if (nm.isNotificationPolicyAccessGranted) {
                // Aktifkan Do Not Disturb total: blokir semua notifikasi & suara
                nm.setInterruptionFilter(NotificationManager.INTERRUPTION_FILTER_NONE)
            }
        } catch (e: Exception) {
            // Abaikan - beberapa perangkat tidak mendukung
        }
    }

    private fun disableNotificationBlock() {
        try {
            val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            if (nm.isNotificationPolicyAccessGranted) {
                nm.setInterruptionFilter(NotificationManager.INTERRUPTION_FILTER_ALL)
            }
        } catch (e: Exception) {
            // Abaikan
        }
    }

    /* ---------------------------------------------------------
     * Deteksi Headset (fitur 30)
     * --------------------------------------------------------- */
    private fun registerHeadsetReceiver() {
        val filter = IntentFilter()
        filter.addAction(Intent.ACTION_HEADSET_PLUG)
        registerReceiver(headsetReceiver, filter)
    }

    private fun handleHeadsetDetected() {
        val now = System.currentTimeMillis()
        if (now - lastHeadsetWarningMs < 10000) return
        lastHeadsetWarningMs = now

        TrackEventTask(this, "headset_dipakai", "Headset terdeteksi saat ujian").execute()
        AlarmUtils.playAlarmAndForceClose(this)
    }

    /* ---------------------------------------------------------
     * Mode kiosk: Lock Task Mode (Screen Pinning)
     * --------------------------------------------------------- */
    private fun enterLockTaskMode() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            val am = getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
            if (!am.isInLockTaskMode) {
                try {
                    startLockTask()
                } catch (e: Exception) {
                    // Beberapa perangkat/ROM tidak mendukung - lanjutkan tanpa pinning.
                    // Immersive + FLAG_SECURE tetap aktif.
                }
            }
        }
    }

    private fun exitLockTaskMode() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            try {
                val am = getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
                if (am.isInLockTaskMode) {
                    stopLockTask()
                }
            } catch (e: Exception) {
                // Abaikan
            }
        }
    }

    /* ---------------------------------------------------------
     * Setup WebView
     * --------------------------------------------------------- */
    @SuppressLint("SetJavaScriptEnabled")
    private fun setupWebView() {
        val settings = webView.settings
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.databaseEnabled = true
        settings.cacheMode = WebSettings.LOAD_DEFAULT
        settings.allowFileAccess = false
        settings.allowContentAccess = false
        settings.allowUniversalAccessFromFileURLs = false
        settings.allowFileAccessFromFileURLs = false
        settings.mediaPlaybackRequiresUserGesture = true
        settings.mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
        settings.setSupportZoom(false)
        settings.builtInZoomControls = false
        settings.displayZoomControls = false
        settings.textZoom = 100
        settings.loadWithOverviewMode = true
        settings.useWideViewPort = true

        // Cookie: izinkan third-party cookies agar sesi portal berfungsi
        CookieManager.getInstance().setAcceptCookie(true)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true)
        }

        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(
                view: WebView?,
                request: WebResourceRequest?
            ): Boolean {
                val url = request?.url?.toString() ?: return false
                return handleUrlNavigation(url)
            }

            @Suppress("DEPRECATION")
            override fun shouldOverrideUrlLoading(view: WebView?, url: String?): Boolean {
                return handleUrlNavigation(url ?: return false)
            }

            override fun onReceivedSslError(
                view: WebView?,
                handler: SslErrorHandler?,
                error: SslError?
            ) {
                // Jangan izinkan koneksi tidak aman (SSL error) - keamanan ujian
                handler?.cancel()
                Toast.makeText(this@MainActivity, R.string.ssl_error, Toast.LENGTH_LONG).show()
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onProgressChanged(view: WebView?, newProgress: Int) {
                binding.progressBar.progress = newProgress
                binding.progressBar.visibility =
                    if (newProgress < 100) View.VISIBLE else View.GONE
            }

            override fun onShowFileChooser(
                webView: WebView?,
                filePathCallback: ValueCallback<Array<Uri>>?,
                fileChooserParams: FileChooserParams?
            ): Boolean {
                // 🔒 Blokir upload file (anti bocor soal keluar).
                this@MainActivity.filePathCallback = filePathCallback
                webView?.postDelayed({
                    this@MainActivity.filePathCallback?.onReceiveValue(null)
                    this@MainActivity.filePathCallback = null
                }, 200)
                // Kirim event pelanggaran
                TrackEventTask(this@MainActivity, "blokir_upload", "Coba upload file di blokir").execute()
                return true
            }

            override fun onConsoleMessage(message: android.webkit.ConsoleMessage?): Boolean {
                return true
            }
        }
    }

    /**
     * Cegah navigasi keluar domain portal.
     */
    private fun handleUrlNavigation(url: String): Boolean {
        val uri = try {
            Uri.parse(url)
        } catch (e: Exception) {
            return true
        }

        val host = uri.host ?: return true

        // Blokir semua protokol non-http(s)
        if (uri.scheme != "https" && uri.scheme != "http") {
            TrackEventTask(this, "navigasi_diblokir", "Protokol: ${uri.scheme} - $url").execute()
            return true
        }

        // Izinkan host portal utama (termasuk subdomain Vercel)
        val allowed = host == PORTAL_HOST || host.endsWith(".vercel.app") ||
            host.endsWith(".supabase.co") ||
            host.contains("thhk")

        if (!allowed) {
            // ⚠️ Coba keluar ke domain lain - blokir + kirim ke Live Monitor
            TrackEventTask(this, "keluar_domain", "Coba buka: $url").execute()
            return true
        }

        // Untuk target _blank atau window.open, muat di WebView yang sama
        return false
    }

    /* ---------------------------------------------------------
     * Immersive fullscreen
     * --------------------------------------------------------- */
    private fun setupImmersiveMode() {
        WindowCompat.setDecorFitsSystemWindows(window, false)
        val controller = WindowCompat.getInsetsController(window, binding.root)
        controller.hide(WindowInsetsCompat.Type.systemBars())
        controller.systemBarsBehavior =
            WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE

        binding.root.setOnSystemUiVisibilityChangeListener { visibility ->
            if (visibility and View.SYSTEM_UI_FLAG_FULLSCREEN == 0) {
                // User coba swipe system UI - langsung sembunyikan lagi
                binding.root.postDelayed({
                    controller.hide(WindowInsetsCompat.Type.systemBars())
                }, 100)
            }
        }
    }

    /* ---------------------------------------------------------
     * Blokir sentuhan yang mencurigakan (copy-paste)
     * --------------------------------------------------------- */
    private fun setupTouchBlockers() {
        // Blokir aksi salin/tempel dari menu konteks WebView
        webView.setOnCreateContextMenuListener { _, _, _ ->
            // Tidak melakukan apa-apa = menu konteks tidak muncul
        }

        // Blokir paste dari clipboard saat fokus di WebView
        webView.setOnLongClickListener { true }
    }

    /* ---------------------------------------------------------
     * Muat portal
     * --------------------------------------------------------- */
    private fun loadPortal() {
        val url = Prefs.getPortalUrl(this)
        webView.loadUrl(url)
    }

    /**
     * Fitur 4: Reset/refresh portal saat app kembali dari background.
     */
    private fun resetExamIfReturned() {
        if (wasInBackground && !isExiting && Prefs.isExamMode(this)) {
            wasInBackground = false
            webView.reload()
            TrackEventTask(this, "kembali_dari_background", "App kembali fokus, portal di-reset").execute()
        }
    }

    /* ---------------------------------------------------------
     * Back button -> MATIKAN TOTAL (satu-satunya keluar: tombol OFF ⏻)
     * --------------------------------------------------------- */
    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        // 🚫 Back/swipe back DINONAKTIFKAN SEPENUHNYA.
        // Tidak bisa keluar aplikasi dengan tombol back.
        // Satu-satunya cara keluar: tombol OFF ⏻ → PIN.
        if (!isExiting && Prefs.isExamMode(this)) {
            TrackEventTask(this, "back_diblokir", "Tombol back ditekan, tidak berfungsi").execute()
            Toast.makeText(this, "Gunakan tombol OFF untuk keluar", Toast.LENGTH_SHORT).show()
        }
        // JANGAN panggil super - blokir back button total
    }

    /* ---------------------------------------------------------
     * Dialog PIN
     * --------------------------------------------------------- */
    private fun showPinDialog(title: String, hint: String, onSuccess: () -> Unit) {
        val input = EditText(this).apply {
            this.hint = hint
            inputType = android.text.InputType.TYPE_CLASS_NUMBER or
                android.text.InputType.TYPE_NUMBER_VARIATION_PASSWORD
            gravity = Gravity.CENTER
            textSize = 20f
        }

        val container = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(48, 24, 48, 8)
            addView(input, LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ))
        }

        AlertDialog.Builder(this)
            .setTitle(title)
            .setView(container)
            .setPositiveButton(R.string.btn_unlock) { _, _ ->
                val pin = input.text.toString()
                var ok = Prefs.checkAdminPin(this, pin)
                if (!ok) ok = Prefs.checkTeacherPin(this, pin)
                if (ok) {
                    onSuccess()
                } else {
                    // PIN salah -> track
                    TrackEventTask(this, "pin_salah", "Percobaan PIN salah").execute()
                    Toast.makeText(this, R.string.pin_wrong, Toast.LENGTH_SHORT).show()
                }
            }
            .setNegativeButton(R.string.btn_cancel, null)
            .setCancelable(false)
            .show()
    }

    private fun openSettings() {
        val binding = DialogSecurityMenuBinding.inflate(layoutInflater)
        val dialog = AlertDialog.Builder(this)
            .setView(binding.root)
            .setCancelable(true)
            .create()

        binding.menuChangeUrl.setOnClickListener {
            dialog.dismiss()
            showPortalUrlDialog()
        }

        binding.menuExitApp.setOnClickListener {
            dialog.dismiss()
            // 🔒 Tandai sedang keluar SEBELUM lepas lock task,
            // mainkan alarm 95%, lalu force close paksa.
            isExiting = true
            Prefs.setExamMode(this, false)
            exitLockTaskMode()
            disableNotificationBlock()
            finishAffinity()
            // 📢 Alarm 95% + force close otomatis
            AlarmUtils.playAlarmAndForceClose(this)
        }

        binding.menuClose.setOnClickListener {
            dialog.dismiss()
        }

        dialog.show()
    }

    private fun showPortalUrlDialog() {
        val input = EditText(this).apply {
            setText(Prefs.getPortalUrl(this@MainActivity))
            gravity = Gravity.CENTER
        }
        AlertDialog.Builder(this)
            .setTitle("Ubah URL Portal")
            .setView(input)
            .setPositiveButton(R.string.btn_save) { _, _ ->
                val newUrl = input.text.toString().trim()
                if (newUrl.startsWith("https://")) {
                    Prefs.setPortalUrl(this, newUrl)
                    loadPortal()
                } else {
                    Toast.makeText(this, "URL harus https://", Toast.LENGTH_SHORT).show()
                }
            }
            .setNegativeButton(R.string.btn_cancel, null)
            .show()
    }

    /* ---------------------------------------------------------
     * Deteksi dual layar (fitur 12) & anti split-screen
     * --------------------------------------------------------- */
    private fun checkDualScreen() {
        try {
            if (isInMultiWindowMode) {
                val now = System.currentTimeMillis()
                if (now - lastDualScreenWarningMs < 10000) return
                lastDualScreenWarningMs = now

                TrackEventTask(this, "dual_screen", "Mode layar ganda/split-screen terdeteksi").execute()
                AlarmUtils.playAlarmAndForceClose(this)
            }
        } catch (e: Exception) {
            // Abaikan
        }
    }

    /* ---------------------------------------------------------
     * Lifecycle
     * --------------------------------------------------------- */
    override fun onStop() {
        super.onStop()
        // 🚨 Sinkronisasi: siswa meninggalkan app (keluar paksa / force-unpin /
        // tekan Home / pindah app / notification shade). Kirim event ke
        // Live Monitor admin & pengawas.
        if (!isExiting && Prefs.isExamMode(this)) {
            TrackEventTask(this, "keluar_paksa", "Siswa keluar aplikasi secara paksa (lock task dilepas)").execute()
        }
    }

    override fun onResume() {
        super.onResume()
        // Pastikan immersive selalu aktif
        binding.root.postDelayed({
            WindowCompat.getInsetsController(window, binding.root)
                .hide(WindowInsetsCompat.Type.systemBars())
        }, 50)

        // Pastikan lock task aktif saat kembali ke app — KECUALI sedang keluar
        if (!isExiting) {
            enterLockTaskMode()
        }

        // 🔄 Fitur 4: reset portal jika kembali dari background
        resetExamIfReturned()

        // 📱 Fitur 12: cek dual screen/split-screen
        checkDualScreen()
    }

    override fun onMultiWindowModeChanged(isInMultiWindowMode: Boolean, newConfig: android.content.res.Configuration) {
        super.onMultiWindowModeChanged(isInMultiWindowMode, newConfig)
        if (isInMultiWindowMode && !isExiting && Prefs.isExamMode(this)) {
            checkDualScreen()
        }
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) {
            WindowCompat.getInsetsController(window, binding.root)
                .hide(WindowInsetsCompat.Type.systemBars())
            // Jangan re-lock saat pengguna sedang keluar
            if (!isExiting) {
                enterLockTaskMode()
            }
        } else {
            // 🚫 Anti floating apps / notifikasi: app kehilangan fokus = ada window lain
            // muncul di atas (chat head, PiP, bubble, overlay, notification shade).
            // Ini sinyal mencurigakan - siswa mungkin memakai floating window
            // untuk mencontek.
            if (!isExiting && Prefs.isExamMode(this)) {
                wasInBackground = true
                handlePossibleFloatingWindow()
            }
        }
    }

    /**
     * 🚫 Tangani kemungkinan floating window/overlay menutupi app.
     * - Kirim event ke Live Monitor
     * - Mainkan alarm 95%
     * - Tampilkan layar penutup hitam (anti baca isi floating)
     * - Force close setelah alarm terdengar
     */
    private var lastFloatingPunishMs: Long = 0
    private fun handlePossibleFloatingWindow() {
        val now = System.currentTimeMillis()
        // Cooldown 5 detik agar tidak spam force close saat notifikasi singkat
        if (now - lastFloatingPunishMs < 5000) return
        lastFloatingPunishMs = now

        // Kirim event pelanggaran ke Live Monitor
        TrackEventTask(this, "floating_app", "Deteksi floating window/overlay saat ujian").execute()

        // 📢 Alarm 95% + layar hukuman hitam + force close
        AlarmUtils.punishFloatingApp(this, binding.floatingPunishmentOverlay)
    }

    override fun onDestroy() {
        super.onDestroy()
        clockRunnable?.let { mainHandler.removeCallbacks(it) }
        AlarmUtils.stop()
        try {
            unregisterReceiver(headsetReceiver)
        } catch (e: Exception) {
            // Abaikan
        }
        filePathCallback?.onReceiveValue(null)
        filePathCallback = null
        webView.destroy()
    }
}