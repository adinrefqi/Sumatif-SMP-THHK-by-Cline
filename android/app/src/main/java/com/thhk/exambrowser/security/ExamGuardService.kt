package com.thhk.exambrowser.security

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import com.thhk.exambrowser.MainActivity
import com.thhk.exambrowser.Prefs
import com.thhk.exambrowser.R

/**
 * Foreground service penjaga ujian.
 *
 * Tujuan:
 * - Menampilkan notifikasi permanen "ujian sedang berlangsung" (psikologis + anti hilang)
 * - Menjaga proses aplikasi tetap hidup saat siswa menekan Recent/Home
 * - Indikator visual ke pengawas bahwa ujian aktif di perangkat ini
 */
class ExamGuardService : Service() {

    companion object {
        private const val CHANNEL_ID = "exam_security"
        private const val NOTIFICATION_ID = 1001

        fun start(context: Context) {
            val intent = Intent(context, ExamGuardService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        }

        fun stop(context: Context) {
            context.stopService(Intent(context, ExamGuardService::class.java))
        }
    }

    override fun onCreate() {
        super.onCreate()
        createChannel()
        Prefs.setExamMode(this, true)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        startForeground(NOTIFICATION_ID, buildNotification())
        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun buildNotification(): Notification {
        val contentIntent = PendingIntent.getActivity(
            this,
            0,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(getString(R.string.guard_notification_title))
            .setContentText(getString(R.string.guard_notification_text))
            .setSmallIcon(R.drawable.ic_launcher_foreground)
            .setContentIntent(contentIntent)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .build()
    }

    private fun createChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                getString(R.string.guard_channel_name),
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = getString(R.string.guard_channel_desc)
                setShowBadge(false)
            }
            val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            nm.createNotificationChannel(channel)
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        Prefs.setExamMode(this, false)
    }

    override fun onTaskRemoved(rootIntent: Intent?) {
        // Siswa menutup app dari recent -> langsung restart penjaga
        super.onTaskRemoved(rootIntent)
        if (Prefs.isExamMode(this)) {
            start(this)
        }
    }
}