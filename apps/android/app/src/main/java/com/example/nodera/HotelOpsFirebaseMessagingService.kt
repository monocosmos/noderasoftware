package com.example.nodera

import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

class HotelOpsFirebaseMessagingService : FirebaseMessagingService() {
    override fun onNewToken(token: String) {
        super.onNewToken(token)
        // Firebase token yenilenirse son web login tokeniyle tekrar backend'e
        // bildiririz; boylece bildirim teslimati token rotasyonunda kopmaz.
        val prefs = getSharedPreferences(HotelOpsPrefs.NAME, MODE_PRIVATE)
        val authToken = prefs.getString(HotelOpsPrefs.AUTH_TOKEN, "").orEmpty()
        prefs.edit().putString(HotelOpsPrefs.FCM_TOKEN, token).apply()
        HotelOpsPushRegistrar.register(applicationContext, authToken, token)
    }

    override fun onMessageReceived(message: RemoteMessage) {
        super.onMessageReceived(message)

        // Backend hem notification hem data payload gonderebilir. Hangisi geldiyse
        // ondan baslik/metin uretip Android sistem bildirimi olarak gosteriyoruz.
        val messageType = message.data["type"].orEmpty()
        val channel = message.data["channel"].orEmpty()
        val id = message.messageId
            ?: message.data["notificationId"]
            ?: message.data["workOrderCode"]
            ?: System.currentTimeMillis().toString()
        val title = message.notification?.title ?: message.data["title"] ?: "HotelOps"
        val body = message.notification?.body ?: message.data["body"] ?: "Yeni is bildirimi var."
        val delivery = message.data["delivery"].orEmpty()
        val androidChannelId = message.data["androidChannelId"].orEmpty()
        val silent = delivery.equals("silent", ignoreCase = true)
            || androidChannelId == HotelOpsNotifier.CHANNEL_SILENT_TRANSIENT
            || channel.equals("SILENT", ignoreCase = true)
            || channel.startsWith("SILENT_", ignoreCase = true)
            || channel.endsWith("_SILENT", ignoreCase = true)
            || message.data["silent"].equals("true", ignoreCase = true)

        if (messageType.equals("app_update", ignoreCase = true) || channel.equals("APP_UPDATE", ignoreCase = true)) {
            HotelOpsNotifier.showAppUpdateNotification(applicationContext, title, body)
            return
        }

        HotelOpsNotifier.showOperationNotification(applicationContext, id, title, body, silent)
    }
}
