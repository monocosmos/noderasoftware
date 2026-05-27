package com.example.nodera

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat

object HotelOpsNotifier {
    const val CHANNEL_WORK_ORDERS = "hotelops_work_orders"
    const val CHANNEL_REMINDERS = "hotelops_reminders"
    const val CHANNEL_APP_UPDATES = "hotelops_app_updates"
    const val CHANNEL_SERVICE = "hotelops_service"

    fun ensureChannels(context: Context) {
        // Android 8+ bildirimleri kanal bazinda yonetir. Is bildirimleri yuksek
        // onemli, uygulama guncellemesi orta onemli, servis durumu ise sessizdir.
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return

        val notificationManager = context.getSystemService(NotificationManager::class.java)

        val workOrdersChannel = NotificationChannel(
            CHANNEL_WORK_ORDERS,
            "Is bildirimleri",
            NotificationManager.IMPORTANCE_HIGH
        ).apply {
            description = "Yeni is, ariza ve operasyon bildirimleri."
            enableVibration(true)
        }

        val remindersChannel = NotificationChannel(
            CHANNEL_REMINDERS,
            "Hatirlatmalar",
            NotificationManager.IMPORTANCE_DEFAULT
        ).apply {
            description = "Bakim, takvim ve takip hatirlatmalari."
        }

        val appUpdatesChannel = NotificationChannel(
            CHANNEL_APP_UPDATES,
            "Uygulama guncellemeleri",
            NotificationManager.IMPORTANCE_DEFAULT
        ).apply {
            description = "APK surum guncelleme hatirlatmalari."
        }

        val serviceChannel = NotificationChannel(
            CHANNEL_SERVICE,
            "Servis durumu",
            NotificationManager.IMPORTANCE_MIN
        ).apply {
            description = "HotelOps arka plan servis durumu."
            setShowBadge(false)
        }

        notificationManager.createNotificationChannels(
            listOf(workOrdersChannel, remindersChannel, appUpdatesChannel, serviceChannel)
        )
    }

    fun showOperationNotification(context: Context, id: String, title: String, body: String) {
        // FCM'den gelen is/ariza bildirimleri ana operasyon kanalindan gosterilir.
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

        val notification = NotificationCompat.Builder(context, CHANNEL_WORK_ORDERS)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(title.ifBlank { "HotelOps" })
            .setContentText(body.ifBlank { "Yeni is bildirimi var." })
            .setStyle(NotificationCompat.BigTextStyle().bigText(body.ifBlank { "Yeni is bildirimi var." }))
            .setContentIntent(pendingIntent)
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
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

        val notification = NotificationCompat.Builder(context, CHANNEL_APP_UPDATES)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setContentIntent(pendingIntent)
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setCategory(NotificationCompat.CATEGORY_STATUS)
            .build()

        val notificationManager = context.getSystemService(NotificationManager::class.java)
        notificationManager.notify("hotelops-app-update".hashCode(), notification)
    }
}
