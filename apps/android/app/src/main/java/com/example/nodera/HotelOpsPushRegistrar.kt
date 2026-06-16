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
        if (authToken.isBlank()) {
            rememberRegistrationFailure(appContext, 0, "auth-token-missing")
            return
        }

        try {
            FirebaseApp.initializeApp(appContext)
            FirebaseMessaging.getInstance().token.addOnCompleteListener { task ->
                if (!task.isSuccessful) {
                    rememberRegistrationFailure(
                        appContext,
                        0,
                        "fcm-token-failed:${task.exception?.javaClass?.simpleName ?: "unknown"}"
                    )
                    return@addOnCompleteListener
                }
                val fcmToken = task.result.orEmpty()
                if (fcmToken.isBlank()) {
                    rememberRegistrationFailure(appContext, 0, "fcm-token-empty")
                    return@addOnCompleteListener
                }
                prefs.edit().putString(HotelOpsPrefs.FCM_TOKEN, fcmToken).apply()
                register(appContext, authToken, fcmToken)
            }
        } catch (error: IllegalStateException) {
            rememberRegistrationFailure(appContext, 0, "firebase-not-configured:${error.javaClass.simpleName}")
            // Firebase is not configured until app/google-services.json is added.
        } catch (error: Exception) {
            rememberRegistrationFailure(appContext, 0, "firebase-init-failed:${error.javaClass.simpleName}")
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
                    .put("appVersion", HotelOpsAppVersion.NAME)
                    .put("appBuild", HotelOpsAppVersion.UPDATE_CODE)

                // Push token kaydi HTTPS API'ye yapilir; Firebase sadece cihaz
                // tokenini verir, kullanici ve yetki bilgisi bizim backend'dedir.
                connection.requestMethod = "POST"
                connection.connectTimeout = 10000
                connection.readTimeout = 10000
                connection.doOutput = true
                connection.setRequestProperty("Authorization", "Bearer $authToken")
                connection.setRequestProperty("Content-Type", "application/json")
                connection.setRequestProperty("Accept", "application/json")
                connection.setRequestProperty("User-Agent", "NoderaHotelOpsAndroid/${HotelOpsAppVersion.UPDATE_CODE}")
                connection.outputStream.use { output ->
                    output.write(payload.toString().toByteArray(Charsets.UTF_8))
                }
                val status = connection.responseCode
                if (status in 200..299) {
                    connection.inputStream?.close()
                    rememberRegistrationSuccess(context, status)
                } else {
                    val errorBody = runCatching {
                        connection.errorStream?.use { stream ->
                            stream.readBytes().toString(Charsets.UTF_8).take(160)
                        }.orEmpty()
                    }.getOrDefault("")
                    rememberRegistrationFailure(context, status, "http-$status $errorBody".trim())
                }
            } catch (error: Exception) {
                rememberRegistrationFailure(context, 0, error.javaClass.simpleName)
                // Token registration will be retried on next app open, login, or FCM token refresh.
            } finally {
                connection.disconnect()
            }
        }
    }

    private fun rememberRegistrationSuccess(context: Context, status: Int) {
        context.applicationContext
            .getSharedPreferences(HotelOpsPrefs.NAME, Context.MODE_PRIVATE)
            .edit()
            .putLong(HotelOpsPrefs.PUSH_REGISTER_LAST_ATTEMPT_AT, System.currentTimeMillis())
            .putLong(HotelOpsPrefs.PUSH_REGISTER_LAST_OK_AT, System.currentTimeMillis())
            .putInt(HotelOpsPrefs.PUSH_REGISTER_LAST_STATUS, status)
            .remove(HotelOpsPrefs.PUSH_REGISTER_LAST_ERROR)
            .apply()
    }

    private fun rememberRegistrationFailure(context: Context, status: Int, error: String) {
        context.applicationContext
            .getSharedPreferences(HotelOpsPrefs.NAME, Context.MODE_PRIVATE)
            .edit()
            .putLong(HotelOpsPrefs.PUSH_REGISTER_LAST_ATTEMPT_AT, System.currentTimeMillis())
            .putInt(HotelOpsPrefs.PUSH_REGISTER_LAST_STATUS, status)
            .putString(HotelOpsPrefs.PUSH_REGISTER_LAST_ERROR, error.take(220))
            .apply()
    }
}
