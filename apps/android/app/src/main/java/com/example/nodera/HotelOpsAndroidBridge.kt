package com.example.nodera

import android.app.DownloadManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.webkit.JavascriptInterface
import android.widget.Toast

class HotelOpsAndroidBridge(context: Context) {
    private val appContext = context.applicationContext
    private val prefs = appContext.getSharedPreferences(HotelOpsPrefs.NAME, Context.MODE_PRIVATE)

    // Bu sinif WebView icindeki JavaScript'e acilan kontrollu native koprudur.
    // Web kodu Android runtime, surum ve bildirim/token islemlerini buradan okur.
    @JavascriptInterface
    fun app(): String = "Nodera HotelOps"

    @JavascriptInterface
    fun runtime(): String = "android"

    @JavascriptInterface
    fun version(): String = HotelOpsAppVersion.NAME

    @JavascriptInterface
    fun versionCode(): Int = HotelOpsAppVersion.UPDATE_CODE

    @JavascriptInterface
    fun buildNumber(): Int = HotelOpsAppVersion.BUILD

    @JavascriptInterface
    fun channel(): String = HotelOpsAppVersion.CHANNEL

    @JavascriptInterface
    fun getAuthToken(): String = prefs.getString(HotelOpsPrefs.AUTH_TOKEN, "").orEmpty()

    @JavascriptInterface
    fun setAuthToken(token: String?) {
        // Login sonrasi web tokeni kalici Android prefs'e yazilir. FCM kaydi bu
        // tokenla backend'e baglandigi icin oturum uygulama yeniden acilinca da korunur.
        val cleanToken = token?.trim().orEmpty()
        prefs.edit().apply {
            if (cleanToken.isBlank()) {
                remove(HotelOpsPrefs.AUTH_TOKEN)
            } else {
                putString(HotelOpsPrefs.AUTH_TOKEN, cleanToken)
            }
        }.apply()

        HotelOpsPushRegistrar.sync(appContext)
    }

    @JavascriptInterface
    fun clearAuthToken() {
        // Cikis yapildiginda native taraftaki tokeni de temizleriz; eski kullanici
        // adina push token kaydi yenilenmesin.
        prefs.edit()
            .remove(HotelOpsPrefs.AUTH_TOKEN)
            .apply()
    }

    @JavascriptInterface
    fun notifyAppUpdate(title: String?, body: String?) {
        // Web manifest eski APK tespit ederse sistem bildirimiyle kullaniciya
        // guncelleme hatirlatmasi yapabilir.
        HotelOpsNotifier.showAppUpdateNotification(
            appContext,
            title?.takeIf { it.isNotBlank() } ?: "HotelOps guncellemesi var",
            body?.takeIf { it.isNotBlank() } ?: "Android uygulamasinin yeni surumu hazir."
        )
    }

    @JavascriptInterface
    fun openDownloadUrl(url: String?): Boolean {
        // WebView APK indirme linklerini kendi icinde sessizce yutabilir. Guncelleme
        // butonu bu kontrollu bridge ile sadece noderasoftware indirme adreslerini
        // Android'in harici indirici/tarayici akisina teslim eder.
        return openTrustedDownload(appContext, url)
    }

    companion object {
        private const val SITE_ORIGIN = "https://noderasoftware.com"
        private const val APK_MIME_TYPE = "application/vnd.android.package-archive"
        private val pendingApkDownloads = mutableMapOf<Long, String>()
        private var downloadReceiverRegistered = false

        private val downloadReceiver = object : BroadcastReceiver() {
            override fun onReceive(context: Context, intent: Intent) {
                val downloadId = intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1L)
                val title = pendingApkDownloads.remove(downloadId) ?: return
                val manager = context.getSystemService(DownloadManager::class.java) ?: return
                val downloadedUri = manager.getUriForDownloadedFile(downloadId) ?: return

                val installIntent = Intent(Intent.ACTION_VIEW).apply {
                    setDataAndType(downloadedUri, APK_MIME_TYPE)
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                }

                runCatching { context.startActivity(installIntent) }
                    .onFailure {
                        Toast.makeText(
                            context,
                            "$title indirildi. Kurulum icin bildirimlerden acabilirsiniz.",
                            Toast.LENGTH_LONG
                        ).show()
                    }
            }
        }

        fun openTrustedDownload(context: Context, rawUrl: String?): Boolean {
            val uri = normalizeDownloadUri(rawUrl) ?: return false
            if (uri.path?.endsWith(".apk", ignoreCase = true) == true) {
                return enqueueApkDownload(context.applicationContext, uri)
            }

            val intent = Intent(Intent.ACTION_VIEW, uri).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            return runCatching { context.startActivity(intent) }.isSuccess
        }

        @Synchronized
        private fun ensureDownloadReceiver(context: Context) {
            if (downloadReceiverRegistered) return

            val filter = IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                context.registerReceiver(downloadReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
            } else {
                context.registerReceiver(downloadReceiver, filter)
            }
            downloadReceiverRegistered = true
        }

        private fun enqueueApkDownload(context: Context, uri: Uri): Boolean {
            val manager = context.getSystemService(DownloadManager::class.java) ?: return false
            val fileName = uri.lastPathSegment?.takeIf { it.isNotBlank() } ?: "HotelOps-Android-V1.apk"
            val title = "HotelOps Android $fileName"
            ensureDownloadReceiver(context)

            val request = DownloadManager.Request(uri).apply {
                setTitle(title)
                setDescription("HotelOps guncellemesi indiriliyor")
                setMimeType(APK_MIME_TYPE)
                setAllowedOverMetered(true)
                setAllowedOverRoaming(true)
                setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, fileName)
            }

            val downloadId = runCatching { manager.enqueue(request) }.getOrNull() ?: return false
            pendingApkDownloads[downloadId] = title
            Toast.makeText(context, "HotelOps guncellemesi indiriliyor.", Toast.LENGTH_SHORT).show()
            return true
        }

        private fun normalizeDownloadUri(rawUrl: String?): Uri? {
            val value = rawUrl?.trim().orEmpty()
            if (value.isBlank()) return null

            if (value.startsWith("market://details?id=com.noderasoftware.hotelops")) {
                return Uri.parse(value)
            }

            val absolute = when {
                value.startsWith("/") -> "$SITE_ORIGIN$value"
                value.startsWith("http://") || value.startsWith("https://") -> value
                else -> "$SITE_ORIGIN/$value"
            }

            val uri = runCatching { Uri.parse(absolute) }.getOrNull() ?: return null
            val host = uri.host?.lowercase() ?: return null
            val playStore = host == "play.google.com" &&
                uri.path == "/store/apps/details" &&
                uri.getQueryParameter("id") == "com.noderasoftware.hotelops"
            if (playStore) return uri

            val trustedHost = host == "noderasoftware.com" || host == "www.noderasoftware.com"
            val trustedPath = uri.path?.startsWith("/downloads/") == true
            if (!trustedHost || !trustedPath) return null

            return uri
        }
    }
}
