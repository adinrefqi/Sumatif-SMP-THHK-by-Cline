package com.thhk.exambrowser

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioManager
import android.media.MediaPlayer
import android.media.RingtoneManager
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.view.View
import android.view.animation.AlphaAnimation
import android.view.animation.Animation

/**
 * Alarm keras + flash merah saat pelanggaran keamanan terdeteksi.
 * Efek: suara dering + getar + layar berkedip merah 3x.
 */
object AlarmManager {

    private var player: MediaPlayer? = null
    private var lastTriggerMs: Long = 0

    /**
     * Mainkan alarm. Cooldown 3 detik agar tidak spam event.
     */
    fun trigger(context: Context, overlayView: View? = null) {
        val now = System.currentTimeMillis()
        if (now - lastTriggerMs < 3000) return
        lastTriggerMs = now

        playSound(context)
        vibrate(context)
        flashOverlay(overlayView)
    }

    private fun playSound(context: Context) {
        try {
            val uri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
            if (uri == null) return
            val mp = MediaPlayer()
            mp.setDataSource(context, uri)
            mp.setAudioAttributes(
                AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ALARM)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build()
            )
            mp.isLooping = false
            mp.setOnCompletionListener { it.release(); if (player === it) player = null }
            mp.setOnErrorListener { p, _, _ -> p.release(); if (player === p) player = null; true }
            mp.prepare()
            mp.start()
            player = mp
        } catch (e: Exception) {
            // Abaikan - alarm tidak wajib jika audio bermasalah
        }
    }

    private fun vibrate(context: Context) {
        try {
            val vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val vm = context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager
                vm.defaultVibrator
            } else {
                @Suppress("DEPRECATION")
                context.getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
            }
            if (vibrator.hasVibrator()) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    vibrator.vibrate(
                        VibrationEffect.createWaveform(
                            longArrayOf(0, 500, 200, 500, 200, 500),
                            -1
                        )
                    )
                } else {
                    @Suppress("DEPRECATION")
                    vibrator.vibrate(longArrayOf(0, 500, 200, 500, 200, 500), -1)
                }
            }
        } catch (e: Exception) {
            // Abaikan
        }
    }

    private fun flashOverlay(overlayView: View?) {
        if (overlayView == null) return
        overlayView.post {
            try {
                overlayView.visibility = View.VISIBLE
                val anim = AlphaAnimation(0.0f, 0.55f)
                anim.duration = 250
                anim.repeatMode = Animation.REVERSE
                // Flash merah 3x (naik-turun = 2*250ms = 500ms per siklus; 3 siklus = trim)
                anim.repeatCount = 5
                anim.setAnimationListener(object : Animation.AnimationListener {
                    override fun onAnimationStart(a: Animation) {}
                    override fun onAnimationRepeat(a: Animation) {}
                    override fun onAnimationEnd(a: Animation) {
                        overlayView.visibility = View.GONE
                        overlayView.alpha = 0.0f
                    }
                })
                overlayView.startAnimation(anim)
            } catch (e: Exception) {
                overlayView.visibility = View.GONE
            }
        }
    }
}