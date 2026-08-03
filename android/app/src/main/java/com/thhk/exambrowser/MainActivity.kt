package com.thhk.exambrowser

import android.annotation.SuppressLint
import android.content.Intent
import android.net.Uri
import android.net.http.SslError
import android.os.Build
import android.os.Bundle
import android.provider.Settings
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
import com.thhk.exambrowser.security.ExamAccessibilityService
import com.thhk.exambrowser.security.ExamGuardService

/**
 * Aktivitas utama: WebView kiosk portal ujian.
 *
 * Keamanan:
 * - FLAG_SECURE: anti screenshot & rekam layar
 * - Immersive fullscreen: sembunyikan status bar & nav bar
 * - Back ditekan -> wajib PIN admin
 * - Blokir navigasi keluar domain portal
 * - Blokir file chooser / unduhan / copy-paste
 * - Start foreground service + AccessibilityService
 */
class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private lateinit var webView: WebView

    private var filePathCallback: ValueCallback<Array<Uri>>? = null

    private var backPressStartMs: Long = 0

    companion object {
        const val PORTAL_HOST = "portal-sumatif-thhk.vercel.app"
        const val ACTION_FINISH_EXAM = "com.thhk.exambrowser.ACTION_FINISH_EXAM"
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

        // Optimasi visual + nonaktifkan animasi (mencegah kelemahan screenshot)
        window.setBackgroundDrawableResource(R.color.window_background)

        setupWebView()
        setupImmersiveMode()
        setupTouchBlockers()

        // Mulai foreground service penjaga ujian
        ExamGuardService.start(this)

        // Cek syarat keamanan (aksesibilitas & overlay) - tampilkan peringatan bila belum
        checkSecurityRequirements()

        // Muat portal
        loadPortal()
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

        // Hapus data sesi lama bila ada (bersihkan saat pertama kali)
        // Catatan: jangan bersihkan CookieManager karena sesi login siswa
        // disimpan di cookie WebView.

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
                // Wajib panggil onReceiveValue(null) agar WebView tidak terkunci
                // menunggu hasil file chooser. Delay singkat biar JS sempat berjalan.
                this@MainActivity.filePathCallback = filePathCallback
                webView?.postDelayed({
                    this@MainActivity.filePathCallback?.onReceiveValue(null)
                    this@MainActivity.filePathCallback = null
                }, 200)
                // Kirim event pelanggaran
                TrackEventTask(this@MainActivity, "blokir_upload", "Coba upload file di blokir").execute()
                AlarmManager.trigger(this@MainActivity, binding.alarmFlashOverlay)
                return true
            }

            override fun onConsoleMessage(message: android.webkit.ConsoleMessage?): Boolean {
                return true
            }
        }
    }

    /**
     * Cegah navigasi keluar domain portal. Izin: halaman di dalam portal
     * dan target _blank tetap dibuka di WebView (bukan browser luar).
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
            AlarmManager.trigger(this, binding.alarmFlashOverlay)
            return true
        }

        // Izinkan host portal utama (termasuk subdomain Vercel)
        val allowed = host == PORTAL_HOST || host.endsWith(".vercel.app") ||
            host.endsWith(".supabase.co") || // PDF proxy tidak langsung, tapi amankan
            host.contains("thhk")

        if (!allowed) {
            // ⚠️ Coba keluar ke domain lain - blokir + alarm + kirim ke Live Monitor
            TrackEventTask(this, "keluar_domain", "Coba buka: $url").execute()
            AlarmManager.trigger(this, binding.alarmFlashOverlay)
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
     * Keamanan: cek aksesibilitas & overlay
     * --------------------------------------------------------- */
    private fun checkSecurityRequirements() {
        val needsAccessibility = !SecurityUtils.isAccessibilityServiceEnabled(
            this,
            ExamAccessibilityService::class.java
        )
        val needsOverlay = !Settings.canDrawOverlays(this)

        if (needsAccessibility || needsOverlay) {
            AlertDialog.Builder(this)
                .setTitle("⚠️ Pengaturan Keamanan Diperlukan")
                .setMessage(
                    "Agar ujian berjalan aman, aktifkan:\n\n" +
                        "1. Layanan Aksesibilitas \"${getString(R.string.accessibility_service_label)}\"\n" +
                        (if (needsOverlay) "2. Izin \"Muncul di atas aplikasi lain\"\n" else "")
                )
                .setPositiveButton("Buka Pengaturan") { _, _ ->
                    // Buka halaman aksesibilitas
                    val intent = Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)
                    startActivity(intent)
                }
                .setNegativeButton("Nanti", null)
                .setCancelable(false)
                .show()
        }
    }

    /* ---------------------------------------------------------
     * Muat portal
     * --------------------------------------------------------- */
    private fun loadPortal() {
        val url = Prefs.getPortalUrl(this)
        webView.loadUrl(url)
    }

    /* ---------------------------------------------------------
     * Back button -> PIN admin (blokir keluar)
     * --------------------------------------------------------- */
    override fun onBackPressed() {
        // Kunci: back dari halaman pertama -> minta PIN admin
        if (webView.canGoBack()) {
            webView.goBack()
            return
        }

        val now = System.currentTimeMillis()
        if (now - backPressStartMs < 1000) {
            // 2x back cepat = tetap minta PIN (bukan keluar)
        }
        backPressStartMs = now

        // Track percobaan keluar
        TrackEventTask(this, "coba_keluar", "Back ditekan saat ujian").execute()
        AlarmManager.trigger(this, binding.alarmFlashOverlay)

        showPinDialog(
            title = getString(R.string.pin_admin_title),
            hint = getString(R.string.pin_admin_hint),
            onSuccess = { openSettings() }
        )
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
                    // PIN salah -> alarm + track
                    TrackEventTask(this, "pin_salah", "Percobaan PIN salah").execute()
                    AlarmManager.trigger(this, binding.alarmFlashOverlay)
                    Toast.makeText(this, R.string.pin_wrong, Toast.LENGTH_SHORT).show()
                }
            }
            .setNegativeButton(R.string.btn_cancel, null)
            .setCancelable(false)
            .show()
    }

    private fun openSettings() {
        AlertDialog.Builder(this)
            .setTitle("Menu Keamanan")
            .setItems(
                arrayOf(
                    "Buka Pengaturan (Accessibility/Overlay)",
                    "Ubah URL Portal",
                    "Nonaktifkan Mode Ujian",
                    "Keluar Aplikasi"
                )
            ) { _, which ->
                when (which) {
                    0 -> {
                        val intent = Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)
                        startActivity(intent)
                    }
                    1 -> showPortalUrlDialog()
                    2 -> {
                        Prefs.setExamMode(this, false)
                        ExamGuardService.stop(this)
                        Toast.makeText(this, "Mode ujian dinonaktifkan", Toast.LENGTH_SHORT).show()
                    }
                    3 -> finishAffinity()
                }
            }
            .setNegativeButton("Tutup", null)
            .show()
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
     * Lifecycle
     * --------------------------------------------------------- */
    override fun onResume() {
        super.onResume()
        // Pastikan immersive selalu aktif
        binding.root.postDelayed({
            WindowCompat.getInsetsController(window, binding.root)
                .hide(WindowInsetsCompat.Type.systemBars())
        }, 50)
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) {
            WindowCompat.getInsetsController(window, binding.root)
                .hide(WindowInsetsCompat.Type.systemBars())
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        filePathCallback?.onReceiveValue(null)
        filePathCallback = null
        webView.destroy()
    }
}