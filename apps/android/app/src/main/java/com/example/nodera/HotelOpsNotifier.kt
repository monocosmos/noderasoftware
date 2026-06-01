package com.example.nodera

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.os.Build
import androidx.core.app.NotificationCompat

object HotelOpsNotifier {
    const val CHANNEL_SOUND_TRANSIENT = "hotelops_sound_transient"
    const val CHANNEL_SILENT_TRANSIENT = "hotelops_silent_transient"
    const val CHANNEL_SHIFT_STATUS = "hotelops_shift_status"
    const val CHANNEL_WORK_ORDERS = CHANNEL_SOUND_TRANSIENT
    const val CHANNEL_REMINDERS = CHANNEL_SILENT_TRANSIENT
    const val CHANNEL_APP_UPDATES = CHANNEL_SOUND_TRANSIENT
    const val CHANNEL_SERVICE = CHANNEL_SILENT_TRANSIENT
    private const val SHIFT_NOTIFICATION_ID = 20260531

    fun ensureChannels(context: Context) {
        // Android 8+ bildirimleri kanal bazinda yonetir. HotelOps tarafinda
        // kullaniciya acik uc kategori vardir: sesli gecici, sessiz gecici,
        // ve vardiya boyunca kalan sessiz kalici bildirim.
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return

        val notificationManager = context.getSystemService(NotificationManager::class.java)
        val defaultSound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION)
        val soundAttributes = AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_NOTIFICATION)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build()

        val soundTransientChannel = NotificationChannel(
            CHANNEL_SOUND_TRANSIENT,
            "Sesli gecici bildirimler",
            NotificationManager.IMPORTANCE_HIGH
        ).apply {
            description = "Kullaniciya ses ve titresimle dusen gecici HotelOps bildirimleri."
            setSound(defaultSound, soundAttributes)
            enableVibration(true)
        }

        val silentTransientChannel = NotificationChannel(
            CHANNEL_SILENT_TRANSIENT,
            "Sessiz gecici bildirimler",
            NotificationManager.IMPORTANCE_LOW
        ).apply {
            description = "Ses ve titresim olmadan gosterilen gecici HotelOps bildirimleri."
            setSound(null, null)
            enableVibration(false)
            setShowBadge(false)
        }

        val shiftStatusChannel = NotificationChannel(
            CHANNEL_SHIFT_STATUS,
            "Vardiya kalici bildirimi",
            NotificationManager.IMPORTANCE_LOW
        ).apply {
            description = "Aktif vardiya boyunca sessiz ve kalici gosterilen bildirim."
            setSound(null, null)
            enableVibration(false)
            setShowBadge(false)
        }

        notificationManager.createNotificationChannels(
            listOf(soundTransientChannel, silentTransientChannel, shiftStatusChannel)
        )

        listOf("hotelops_work_orders", "hotelops_reminders", "hotelops_app_updates", "hotelops_service")
            .forEach { notificationManager.deleteNotificationChannel(it) }
    }

    fun showOperationNotification(context: Context, id: String, title: String, body: String, silent: Boolean = false) {
        // FCM'den gelen is/ariza bildirimleri varsayilan olarak sesli gecici
        // kanaldan gosterilir; backend sessiz isterse gecici sessiz kanal kullanilir.
        // Bildirime tiklaninca uygulama acilir ve kullanici panelini gorur.
        ensureChannels(context)

        val intent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val pendingIntent = PendingIntent.getActivity(
            context,
            id.hashCode(),
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val channelId = if (silent) CHANNEL_SILENT_TRANSIENT else CHANNEL_SOUND_TRANSIENT
        val priority = if (silent) NotificationCompat.PRIORITY_LOW else NotificationCompat.PRIORITY_HIGH
        val notification = NotificationCompat.Builder(context, channelId)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(title.ifBlank { "HotelOps" })
            .setContentText(body.ifBlank { "Yeni is bildirimi var." })
            .setStyle(NotificationCompat.BigTextStyle().bigText(body.ifBlank { "Yeni is bildirimi var." }))
            .setContentIntent(pendingIntent)
            .setAutoCancel(true)
            .setPriority(priority)
            .setSilent(silent)
            .setCategory(NotificationCompat.CATEGORY_MESSAGE)
            .build()

        val notificationManager = context.getSystemService(NotificationManager::class.java)
        notificationManager.notify(id.hashCode(), notification)
    }

    fun showAppUpdateNotification(context: Context, title: String, body: String) {
        // Bu bildirim sadece uygulama manifest kontrolu eski APK tespit ederse
        // kullanilir; "arka planda calisiyor" gibi surekli servis bildirimi degildir.
        ensureChannels(context)

        val intent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val pendingIntent = PendingIntent.getActivity(
            context,
            "hotelops-app-update".hashCode(),
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(context, CHANNEL_SOUND_TRANSIENT)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setContentIntent(pendingIntent)
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_STATUS)
            .build()

        val notificationManager = context.getSystemService(NotificationManager::class.java)
        notificationManager.notify("hotelops-app-update".hashCode(), notification)
    }

    fun showShiftNotification(context: Context, employeeName: String, departmentName: String, startedAtMillis: Long) {
        ensureChannels(context)

        val intent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val pendingIntent = PendingIntent.getActivity(
            context,
            SHIFT_NOTIFICATION_ID,
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val bodyParts = listOf(employeeName, departmentName).filter { it.isNotBlank() }
        val body = bodyParts.joinToString(" - ").ifBlank { "Vardiya devam ediyor." }
        val notification = NotificationCompat.Builder(context, CHANNEL_SHIFT_STATUS)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle("Vardiya aktif")
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setAutoCancel(false)
            .setOnlyAlertOnce(true)
            .setShowWhen(true)
            .setWhen(startedAtMillis.takeIf { it > 0L } ?: System.currentTimeMillis())
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_STATUS)
            .build()

        val notificationManager = context.getSystemService(NotificationManager::class.java)
        notificationManager.notify(SHIFT_NOTIFICATION_ID, notification)
    }

    fun cancelShiftNotification(context: Context) {
        val notificationManager = context.getSystemService(NotificationManager::class.java)
        notificationManager.cancel(SHIFT_NOTIFICATION_ID)
    }
}
