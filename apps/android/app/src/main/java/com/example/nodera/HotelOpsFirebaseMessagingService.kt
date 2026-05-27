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
        val id = message.messageId
            ?: message.data["notificationId"]
            ?: message.data["workOrderCode"]
            ?: System.currentTimeMillis().toString()
        val title = message.notification?.title ?: message.data["title"] ?: "HotelOps"
        val body = message.notification?.body ?: message.data["body"] ?: "Yeni is bildirimi var."

        HotelOpsNotifier.showOperationNotification(applicationContext, id, title, body)
    }
}
