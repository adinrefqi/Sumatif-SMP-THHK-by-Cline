package com.thhk.exambrowser

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioManager
import android.media.MediaPlayer
import android.media.RingtoneManager
import android.view.View
import android.animation.Animator
import android.animation.AnimatorListenerAdapter
import android.animation.ValueAnimator
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/**
 * Utilitas alarm keras saat pelanggaran/keluar aplikasi.
 *
 * Tidak memerlukan izin sensitif apa pun:
 * - MediaPlayer + RingtoneManager (bawaan Android)
 * - AudioManager untuk mengatur volume alarm 85%
 * - Tidak butuh AccessibilityService / overlay / usage stats
 */
object AlarmUtils {

    private var player: MediaPlayer? = null
    private var forceCloseJob: Job? = null

    /**
     * Mainkan suara alarm default Android dengan volume [volumePercent] persen.
     * Default 95% sesuai permintaan (fitur #13).
     */
    fun playAlarm(context: Context, volumePercent: Int = 95) {
        try {
            stop()

            val uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
                ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)
                ?: return

            val mp = MediaPlayer()
            mp.setDataSource(context, uri)
            mp.setAudioAttributes(
                AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ALARM)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build()
            )
            mp.isLooping = true
            mp.setOnCompletionListener { it.release(); if (player === it) player = null }
            mp.setOnErrorListener { p, _, _ -> p.release(); if (player === p) player = null; true }

            // Set volume alarm ke persentase yang diminta (default 85%)
            val am = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
            val maxVol = am.getStreamMaxVolume(AudioManager.STREAM_ALARM)
            val targetVol = (maxVol * volumePercent / 100).coerceAtLeast(1)
            am.setStreamVolume(AudioManager.STREAM_ALARM, targetVol, 0)

            mp.prepare()
            mp.start()
            player = mp
        } catch (e: Exception) {
            // Abaikan - alarm tidak wajib jika audio bermasalah
        }
    }

    /**
     * Hentikan alarm yang sedang berbunyi.
     */
    fun stop() {
        try {
            player?.stop()
            player?.release()
            player = null
        } catch (e: Exception) {
            // Abaikan
        }
        forceCloseJob?.cancel()
        forceCloseJob = null
    }

    /**
     * Mainkan alarm 85%, lalu force close aplikasi secara paksa setelah
     * alarm terdengar sebentar (agar pengawas mendengar).
     */
    fun playAlarmAndForceClose(context: Context) {
        playAlarm(context, 95)
        forceCloseJob = CoroutineScope(Dispatchers.Main).launch {
            // Biarkan alarm berbunyi ~1.5 detik agar terdengar pengawas
            delay(1500)
            android.os.Process.killProcess(android.os.Process.myPid())
        }
    }

    /**
     * Anti floating apps: mainkan alarm 85% + tampilkan layar hukuman hitam
     * (menutup seluruh isi layar sehingga floating window tidak bisa dibaca),
     * lalu force close aplikasi.
     */
    fun punishFloatingApp(context: Context, punishmentOverlay: View) {
        // Matikan semua alarm yang mungkin masih berbunyi, lalu mainkan baru
        playAlarm(context, 95)

        // Tampilkan layar penutup hitam di atas WebView (di dalam Activity sendiri)
        punishmentOverlay.post {
            try {
                punishmentOverlay.visibility = View.VISIBLE
                punishmentOverlay.alpha = 0f

                val anim = ValueAnimator.ofFloat(0f, 1f)
                anim.duration = 300
                anim.addUpdateListener { va ->
                    punishmentOverlay.alpha = va.animatedValue as Float
                }
                anim.addListener(object : AnimatorListenerAdapter() {
                    override fun onAnimationEnd(animation: Animator) {
                        // Layar hitam sudah penuh -> alarm tetap berbunyi,
                        // lalu force close setelah total ~3 detik
                        forceCloseJob = CoroutineScope(Dispatchers.Main).launch {
                            delay(2500)
                            android.os.Process.killProcess(android.os.Process.myPid())
                        }
                    }
                })
                anim.start()
            } catch (e: Exception) {
                // Gagal animasi - langsung force close
                forceCloseJob = CoroutineScope(Dispatchers.Main).launch {
                    delay(2500)
                    android.os.Process.killProcess(android.os.Process.myPid())
                }
            }
        }
    }
}
