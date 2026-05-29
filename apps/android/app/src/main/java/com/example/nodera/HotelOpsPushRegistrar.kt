package com.example.nodera

import android.content.Context
import com.google.firebase.FirebaseApp
import com.google.firebase.messaging.FirebaseMessaging
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors

object HotelOpsPushRegistrar {
    private const val REGISTER_URL = "https://noderasoftware.com/api/push-devices"
    private val executor = Executors.newSingleThreadExecutor()

    fun sync(context: Context) {
        // Login tokeni yoksa cihaz backend'e kaydedilmez. Token geldiginde FCM
        // tokeni alinip Raspberry Pi API'ye gonderilir.
        val appContext = context.applicationContext
        val prefs = appContext.getSharedPreferences(HotelOpsPrefs.NAME, Context.MODE_PRIVATE)
        val authToken = prefs.getString(HotelOpsPrefs.AUTH_TOKEN, "").orEmpty()
        if (authToken.isBlank()) return

        try {
            FirebaseApp.initializeApp(appContext)
            FirebaseMessaging.getInstance().token.addOnCompleteListener { task ->
                if (!task.isSuccessful) return@addOnCompleteListener
                val fcmToken = task.result.orEmpty()
                if (fcmToken.isBlank()) return@addOnCompleteListener
                prefs.edit().putString(HotelOpsPrefs.FCM_TOKEN, fcmToken).apply()
                register(appContext, authToken, fcmToken)
            }
        } catch (_: IllegalStateException) {
            // Firebase is not configured until app/google-services.json is added.
        } catch (_: Exception) {
            // Keep the WebView flow alive even if push setup is unavailable.
        }
    }

    fun register(context: Context, authToken: String, fcmToken: String) {
        if (authToken.isBlank() || fcmToken.isBlank()) return

        executor.execute {
            val connection = (URL(REGISTER_URL).openConnection() as HttpURLConnection)
            try {
                val payload = JSONObject()
                    .put("platform", "ANDROID")
                    .put("fcmToken", fcmToken)
                    .put("appVersion", "${HotelOpsAppVersion.NAME} ${HotelOpsAppVersion.CHANNEL}")
                    .put("appBuild", HotelOpsAppVersion.BUILD)

                // Push token kaydi HTTPS API'ye yapilir; Firebase sadece cihaz
                // tokenini verir, kullanici ve yetki bilgisi bizim backend'dedir.
                connection.requestMethod = "POST"
                connection.connectTimeout = 10000
                connection.readTimeout = 10000
                connection.doOutput = true
                connection.setRequestProperty("Authorization", "Bearer $authToken")
                connection.setRequestProperty("Content-Type", "application/json")
                connection.setRequestProperty("Accept", "application/json")
                connection.setRequestProperty("User-Agent", "NoderaHotelOpsAndroid/${HotelOpsAppVersion.UPDATE_CODE} HotelOpsAndroidVersion/${HotelOpsAppVersion.NAME} HotelOpsAndroidBuild/${HotelOpsAppVersion.BUILD} HotelOpsAndroidChannel/${HotelOpsAppVersion.CHANNEL}")
                connection.outputStream.use { output ->
                    output.write(payload.toString().toByteArray(Charsets.UTF_8))
                }
                connection.inputStream.close()
            } catch (_: Exception) {
                // Token registration will be retried on next app open, login, or FCM token refresh.
            } finally {
                connection.disconnect()
            }
        }
    }
}
