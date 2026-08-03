package com.thhk.exambrowser

import android.content.Context
import android.os.AsyncTask
import android.webkit.CookieManager
import org.json.JSONObject
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL

/**
 * Kirim event pelanggaran ke endpoint /api/track di server portal.
 * Memakai session cookie dari WebView (yang sama dengan cookie login siswa)
 * agar event tercatat dengan identitas siswa yang benar di Live Monitor.
 *
 * Server: POST /api/track, body { event, detail, page }
 * Cookie: thhk_sumatif_session=<token> (HttpOnly, diambil dari CookieManager)
 */
class TrackEventTask(
    private val context: Context,
    private val event: String,
    private val detail: String = ""
) : AsyncTask<Void, Void, Boolean>() {

    override fun doInBackground(vararg params: Void?): Boolean {
        return try {
            val baseUrl = Prefs.getPortalUrl(context).trimEnd('/')
            val url = URL("$baseUrl/api/track")

            val conn = url.openConnection() as HttpURLConnection
            conn.requestMethod = "POST"
            conn.connectTimeout = 5000
            conn.readTimeout = 5000
            conn.doOutput = true
            conn.setRequestProperty("Content-Type", "application/json")

            // Ambil cookie sesi dari WebView (CookieSync di API<21, CookieManager sejak 21)
            val cookie = CookieManager.getInstance().getCookie(baseUrl)
            if (!cookie.isNullOrEmpty()) {
                conn.setRequestProperty("Cookie", cookie)
            }

            // Body JSON
            val body = JSONObject()
                .put("event", event)
                .put("detail", detail)
                .put("page", 0)
                .toString()

            OutputStreamWriter(conn.outputStream).use { it.write(body) }

            val code = conn.responseCode
            conn.disconnect()
            code == 200
        } catch (e: Exception) {
            false
        }
    }
}