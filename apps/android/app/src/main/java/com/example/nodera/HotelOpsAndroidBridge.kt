package com.example.nodera

import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import android.util.Base64
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
    fun getAuthToken(): String = prefs.getString(HotelOpsPrefs.AUTH_TOKEN, "").orEmpty()

    @JavascriptInterface
    fun setAuthToken(token: String?) {
        // Login sonrasi web tokeni kalici Android prefs'e yazilir. FCM kaydi bu
        // tokenla backend'e baglandigi icin oturum uygulama yeniden acilinca da korunur.
        val cleanToken = token?.trim().orEmpty()
        prefs.edit().apply {
            if (cleanToken.isBlank()) {
                remove(HotelOpsPrefs.AUTH_TOKEN)
                HotelOpsShiftStatus.end(appContext)
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
        HotelOpsShiftStatus.end(appContext)
    }

    @JavascriptInterface
    fun startShift(employeeName: String?, departmentName: String?): Boolean {
        HotelOpsShiftStatus.start(appContext, employeeName, departmentName)
        return true
    }

    @JavascriptInterface
    fun endShift(): Boolean {
        HotelOpsShiftStatus.end(appContext)
        return true
    }

    @JavascriptInterface
    fun isShiftActive(): Boolean = HotelOpsShiftStatus.isActive(appContext)

    @JavascriptInterface
    fun shiftStartedAt(): Long = HotelOpsShiftStatus.startedAt(appContext)

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

    @JavascriptInterface
    fun saveImageToGallery(dataUrl: String?, fileName: String?): Boolean {
        return saveMediaDataUrl(appContext, dataUrl, fileName, "image/jpeg")
    }

    @JavascriptInterface
    fun saveMediaToGallery(dataUrl: String?, fileName: String?, mimeType: String?): Boolean {
        return saveMediaDataUrl(appContext, dataUrl, fileName, mimeType)
    }

    companion object {
        private const val SITE_ORIGIN = "https://noderasoftware.com"
        private const val DEFAULT_IMAGE_MIME_TYPE = "image/jpeg"

        fun openTrustedDownload(context: Context, rawUrl: String?): Boolean {
            val uri = normalizeDownloadUri(rawUrl) ?: return false
            val intent = Intent(Intent.ACTION_VIEW, uri).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            return runCatching { context.startActivity(intent) }.isSuccess
        }

        private fun saveMediaDataUrl(context: Context, rawDataUrl: String?, rawFileName: String?, rawMimeType: String?): Boolean {
            val parsed = parseDataUrl(rawDataUrl, rawMimeType) ?: return false
            val resolver = context.contentResolver
            val isVideo = parsed.mimeType.startsWith("video/", ignoreCase = true)
            val collection = if (isVideo) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    MediaStore.Video.Media.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY)
                } else {
                    MediaStore.Video.Media.EXTERNAL_CONTENT_URI
                }
            } else {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    MediaStore.Images.Media.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY)
                } else {
                    MediaStore.Images.Media.EXTERNAL_CONTENT_URI
                }
            }

            val displayName = mediaDisplayName(rawFileName, parsed.mimeType, isVideo)
            val values = ContentValues().apply {
                put(MediaStore.MediaColumns.DISPLAY_NAME, displayName)
                put(MediaStore.MediaColumns.MIME_TYPE, parsed.mimeType)
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    val directory = if (isVideo) Environment.DIRECTORY_MOVIES else Environment.DIRECTORY_PICTURES
                    put(MediaStore.MediaColumns.RELATIVE_PATH, "$directory/HotelOps")
                    put(MediaStore.MediaColumns.IS_PENDING, 1)
                }
            }

            val uri = runCatching { resolver.insert(collection, values) }.getOrNull() ?: return false
            return runCatching {
                resolver.openOutputStream(uri)?.use { output ->
                    output.write(parsed.bytes)
                    output.flush()
                } ?: error("MediaStore output stream acilamadi")

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    values.clear()
                    values.put(MediaStore.MediaColumns.IS_PENDING, 0)
                    resolver.update(uri, values, null, null)
                }

                val label = if (isVideo) "Video kaydedildi." else "Fotograf kaydedildi."
                Toast.makeText(context, label, Toast.LENGTH_SHORT).show()
                true
            }.getOrElse {
                runCatching { resolver.delete(uri, null, null) }
                Toast.makeText(context, "Medya kaydedilemedi.", Toast.LENGTH_SHORT).show()
                false
            }
        }

        private data class ParsedMediaDataUrl(val mimeType: String, val bytes: ByteArray)

        private fun parseDataUrl(rawDataUrl: String?, fallbackMimeType: String?): ParsedMediaDataUrl? {
            val dataUrl = rawDataUrl?.trim().orEmpty()
            if (!dataUrl.startsWith("data:", ignoreCase = true)) return null

            val commaIndex = dataUrl.indexOf(',')
            if (commaIndex <= 5) return null

            val metadata = dataUrl.substring(5, commaIndex)
            val base64 = dataUrl.substring(commaIndex + 1)
            if (!metadata.contains(";base64", ignoreCase = true) || base64.isBlank()) return null

            val dataMimeType = metadata.substringBefore(";").takeIf { it.contains("/") }
            val mimeType = (fallbackMimeType?.trim()?.takeIf { it.contains("/") }
                ?: dataMimeType
                ?: DEFAULT_IMAGE_MIME_TYPE)

            val bytes = runCatching { Base64.decode(base64, Base64.DEFAULT) }.getOrNull() ?: return null
            if (bytes.isEmpty()) return null

            return ParsedMediaDataUrl(mimeType, bytes)
        }

        private fun mediaDisplayName(rawFileName: String?, mimeType: String, isVideo: Boolean): String {
            val fallbackExtension = when {
                mimeType.contains("png", ignoreCase = true) -> "png"
                mimeType.contains("webp", ignoreCase = true) -> "webp"
                mimeType.contains("quicktime", ignoreCase = true) -> "mov"
                mimeType.contains("webm", ignoreCase = true) -> "webm"
                isVideo -> "mp4"
                else -> "jpg"
            }
            val fallbackName = if (isVideo) "hotelops-video" else "hotelops-foto"
            val cleaned = rawFileName
                ?.substringAfterLast('/')
                ?.substringAfterLast('\\')
                ?.replace(Regex("[^A-Za-z0-9._ -]"), "_")
                ?.trim('.', ' ')
                ?.takeIf { it.isNotBlank() }
                ?: "$fallbackName-${System.currentTimeMillis()}.$fallbackExtension"

            return if (cleaned.contains('.')) cleaned else "$cleaned.$fallbackExtension"
        }

        private fun normalizeDownloadUri(rawUrl: String?): Uri? {
            val value = rawUrl?.trim().orEmpty()
            if (value.isBlank()) return null

            val absolute = when {
                value.startsWith("/") -> "$SITE_ORIGIN$value"
                value.startsWith("http://") || value.startsWith("https://") -> value
                else -> "$SITE_ORIGIN/$value"
            }

            val uri = runCatching { Uri.parse(absolute) }.getOrNull() ?: return null
            val host = uri.host?.lowercase() ?: return null
            val trustedHost = host == "noderasoftware.com" || host == "www.noderasoftware.com"
            val trustedPath = uri.path?.startsWith("/downloads/") == true
            if (!trustedHost || !trustedPath) return null

            return uri
        }
    }
}
