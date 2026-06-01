package com.example.nodera

import android.Manifest
import android.app.Activity
import android.annotation.SuppressLint
import android.content.ClipData
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.net.Uri
import android.net.http.SslError
import android.os.Build
import android.os.Bundle
import android.provider.MediaStore
import android.view.Gravity
import android.view.ViewGroup
import android.view.animation.AlphaAnimation
import android.view.animation.Animation
import android.view.animation.ScaleAnimation
import android.webkit.PermissionRequest
import android.webkit.SslErrorHandler
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebChromeClient.FileChooserParams
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import android.widget.ImageView
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.core.graphics.Insets
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import java.io.File

class MainActivity : ComponentActivity() {

    private lateinit var webView: WebView
    private lateinit var root: FrameLayout
    private var systemBarInsets: Insets = Insets.NONE

    private val siteUrl = "https://noderasoftware.com/hotel/"
    private val notificationPermissionRequest = 4101
    private val cameraPermissionRequest = 4102
    private val fileChooserRequest = 4103
    private var pendingFilePathCallback: ValueCallback<Array<Uri>>? = null
    private var pendingCameraPhotoUri: Uri? = null
    private var pendingCameraPermissionRequest: PermissionRequest? = null
    private var pendingFileChooserCapture = false
    private var pendingFileChooserAllowMultiple = false

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        configureSystemBars()
        // Uygulama acilir acilmaz bildirim kanallari ve FCM kaydi hazirlanir.
        // Kullanici daha once login olduysa native prefs'teki token sync tarafinda kullanilir.
        requestNotificationPermissionIfNeeded()
        HotelOpsNotifier.ensureChannels(this)
        HotelOpsShiftStatus.restore(this)
        HotelOpsPushRegistrar.sync(this)

        root = FrameLayout(this).apply {
            layoutParams = ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
            setBackgroundColor(Color.rgb(5, 10, 25))
        }

        ViewCompat.setOnApplyWindowInsetsListener(root) { view, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
            systemBarInsets = bars
            applySystemBarMargins()
            WindowInsetsCompat.CONSUMED
        }

        setContentView(root)
        ViewCompat.requestApplyInsets(root)
        showSplashThenLoadWebView()
    }

    private fun configureSystemBars() {
        // Android 15+ edge-to-edge davranisinda WebView sistem barlarinin altina
        // girebilir. Decor'u manuel yonetip WebView'e guvenli alan margin'i
        // verdigimiz icin status ve navigation bar icerigi kapatmaz.
        WindowCompat.setDecorFitsSystemWindows(window, false)
        window.statusBarColor = Color.TRANSPARENT
        window.navigationBarColor = Color.TRANSPARENT

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            window.isNavigationBarContrastEnforced = false
        }

        WindowInsetsControllerCompat(window, window.decorView).apply {
            isAppearanceLightStatusBars = false
            isAppearanceLightNavigationBars = false
        }
    }

    private fun applySystemBarMargins() {
        if (!::webView.isInitialized) return

        val params = webView.layoutParams as? FrameLayout.LayoutParams ?: return
        if (
            params.leftMargin == systemBarInsets.left &&
            params.topMargin == systemBarInsets.top &&
            params.rightMargin == systemBarInsets.right &&
            params.bottomMargin == systemBarInsets.bottom
        ) {
            return
        }

        params.setMargins(
            systemBarInsets.left,
            systemBarInsets.top,
            systemBarInsets.right,
            systemBarInsets.bottom
        )
        webView.layoutParams = params
    }

    private fun showSplashThenLoadWebView() {
        // Kisa splash ekrani WebView yuklenirken bos beyaz ekran hissini gizler;
        // sonrasinda tum deneyim canli HotelOps web arayuzunden gelir.
        val logo = ImageView(this).apply {
            setImageResource(R.mipmap.ic_launcher)
            adjustViewBounds = true
            scaleType = ImageView.ScaleType.FIT_CENTER
            layoutParams = FrameLayout.LayoutParams(260, 260, Gravity.CENTER)
        }

        val fade = AlphaAnimation(0.25f, 1f).apply {
            duration = 900
            repeatMode = Animation.REVERSE
            repeatCount = Animation.INFINITE
        }

        val pulse = ScaleAnimation(
            0.92f, 1.08f,
            0.92f, 1.08f,
            Animation.RELATIVE_TO_SELF, 0.5f,
            Animation.RELATIVE_TO_SELF, 0.5f
        ).apply {
            duration = 900
            repeatMode = Animation.REVERSE
            repeatCount = Animation.INFINITE
        }

        logo.startAnimation(fade)
        logo.startAnimation(pulse)

        root.addView(logo)

        root.postDelayed({
            logo.clearAnimation()
            root.removeView(logo)
            setupWebView()
        }, 2200)
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun setupWebView() {
        // Debug kapali tutulur; APK profesyonel uygulama gibi davransin, uzun
        // basma ve yatay kaydirma da web hissini azaltmak icin kapatilir.
        WebView.setWebContentsDebuggingEnabled(false)

        webView = WebView(this).apply {
            layoutParams = FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )

            setLayerType(WebView.LAYER_TYPE_HARDWARE, null)

            webChromeClient = object : WebChromeClient() {
                override fun onPermissionRequest(request: PermissionRequest?) {
                    request ?: return

                    runOnUiThread {
                        val originAllowed = isTrustedWebOrigin(request.origin?.toString())
                        val videoResources = request.resources
                            ?.filter { it == PermissionRequest.RESOURCE_VIDEO_CAPTURE }
                            ?.toTypedArray()
                            ?: emptyArray()

                        if (!originAllowed || videoResources.isEmpty()) {
                            request.deny()
                            return@runOnUiThread
                        }

                        if (hasCameraPermission()) {
                            request.grant(videoResources)
                            return@runOnUiThread
                        }

                        pendingCameraPermissionRequest?.deny()
                        pendingCameraPermissionRequest = request
                        requestPermissions(arrayOf(Manifest.permission.CAMERA), cameraPermissionRequest)
                    }
                }

                override fun onShowFileChooser(
                    webView: WebView?,
                    filePathCallback: ValueCallback<Array<Uri>>?,
                    fileChooserParams: FileChooserParams?
                ): Boolean {
                    filePathCallback ?: return false

                    pendingFilePathCallback?.onReceiveValue(null)
                    pendingFilePathCallback = filePathCallback

                    val capture = fileChooserParams?.isCaptureEnabled == true
                    val allowMultiple = fileChooserParams?.mode == FileChooserParams.MODE_OPEN_MULTIPLE
                    pendingFileChooserCapture = capture
                    pendingFileChooserAllowMultiple = allowMultiple

                    if (capture && !hasCameraPermission()) {
                        requestPermissions(arrayOf(Manifest.permission.CAMERA), cameraPermissionRequest)
                        return true
                    }

                    return launchFileChooser(capture, allowMultiple)
                }
            }

            webViewClient = object : WebViewClient() {
                override fun onPageFinished(view: WebView?, url: String?) {
                    super.onPageFinished(view, url)
                    injectHotelOpsShellBridge()
                }

                override fun onReceivedError(
                    view: WebView?,
                    request: WebResourceRequest?,
                    error: WebResourceError?
                ) {
                    super.onReceivedError(view, request, error)

                    if (request?.isForMainFrame == true) {
                        showConnectionError()
                    }
                }

                @Suppress("DEPRECATION")
                override fun onReceivedError(
                    view: WebView?,
                    errorCode: Int,
                    description: String?,
                    failingUrl: String?
                ) {
                    super.onReceivedError(view, errorCode, description, failingUrl)
                    showConnectionError()
                }

                override fun onReceivedSslError(
                    view: WebView?,
                    handler: SslErrorHandler?,
                    error: SslError?
                ) {
                    handler?.cancel()
                    showConnectionError()
                }
            }

            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.useWideViewPort = true
            settings.loadWithOverviewMode = false
            settings.textZoom = 100

            settings.setSupportZoom(false)
            settings.builtInZoomControls = false
            settings.displayZoomControls = false

            settings.allowContentAccess = true
            settings.allowFileAccess = true
            settings.cacheMode = WebSettings.LOAD_DEFAULT
            settings.mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
            settings.layoutAlgorithm = WebSettings.LayoutAlgorithm.NORMAL
            settings.userAgentString = "${settings.userAgentString} NoderaHotelOpsAndroid/${HotelOpsAppVersion.UPDATE_CODE} HotelOpsAndroidVersion/${HotelOpsAppVersion.NAME} HotelOpsAndroidBuild/${HotelOpsAppVersion.BUILD} HotelOpsAndroidChannel/${HotelOpsAppVersion.CHANNEL} HotelOpsAndroid"

            isHorizontalScrollBarEnabled = false
            isVerticalScrollBarEnabled = true
            overScrollMode = WebView.OVER_SCROLL_NEVER
            isLongClickable = false
            setOnLongClickListener { true }
            setDownloadListener { url, _, _, _, _ ->
                // APK gibi dosya indirmeleri WebView icinde kalmasin; Android'in
                // guvenilir harici indirme/tarayici akisina devredilsin.
                HotelOpsAndroidBridge.openTrustedDownload(applicationContext, url)
            }
            // JavaScript bridge sadece HotelOps tarafinin ihtiyaci olan sinirli
            // fonksiyonlari acar: runtime, surum, token ve update bildirimi.
            addJavascriptInterface(HotelOpsAndroidBridge(applicationContext), "HotelOpsAndroidShell")
        }

        root.setBackgroundColor(Color.rgb(5, 10, 25))
        root.addView(webView)
        applySystemBarMargins()
        ViewCompat.requestApplyInsets(root)

        onBackPressedDispatcher.addCallback(
            this,
            object : OnBackPressedCallback(true) {
                override fun handleOnBackPressed() {
                    if (::webView.isInitialized && webView.canGoBack()) {
                        webView.goBack()
                    } else {
                        isEnabled = false
                        onBackPressedDispatcher.onBackPressed()
                    }
                }
            }
        )

        webView.loadUrl(siteUrl)
    }

    private fun requestNotificationPermissionIfNeeded() {
        // Android 13+ cihazlarda push bildirimi icin runtime izin gerekir.
        // Eski Android surumleri bu izni manifestten alir.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), notificationPermissionRequest)
        }
    }

    private fun hasCameraPermission(): Boolean {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.M ||
            ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED
    }

    private fun isTrustedWebOrigin(value: String?): Boolean {
        return runCatching {
            val uri = Uri.parse(value)
            val host = uri.host?.lowercase()
            uri.scheme == "https" && (host == "noderasoftware.com" || host == "www.noderasoftware.com")
        }.getOrDefault(false)
    }

    private fun launchFileChooser(capture: Boolean, allowMultiple: Boolean): Boolean {
        return runCatching {
            startActivityForResult(createImageChooserIntent(capture, allowMultiple), fileChooserRequest)
            true
        }.getOrElse {
            cancelPendingFileChooser()
            false
        }
    }

    private fun cancelPendingFileChooser() {
        pendingFilePathCallback?.onReceiveValue(null)
        pendingFilePathCallback = null
        pendingCameraPhotoUri = null
        pendingFileChooserCapture = false
        pendingFileChooserAllowMultiple = false
    }

    private fun createImageChooserIntent(capture: Boolean, allowMultiple: Boolean): Intent {
        val cameraIntent = if (hasCameraPermission()) createCameraCaptureIntent() else null
        if (capture && cameraIntent != null) return cameraIntent

        val contentIntent = Intent(Intent.ACTION_GET_CONTENT).apply {
            addCategory(Intent.CATEGORY_OPENABLE)
            type = "image/*"
            putExtra(Intent.EXTRA_ALLOW_MULTIPLE, allowMultiple)
        }

        return Intent.createChooser(contentIntent, "Fotoğraf seç").apply {
            if (cameraIntent != null) {
                putExtra(Intent.EXTRA_INITIAL_INTENTS, arrayOf(cameraIntent))
            }
        }
    }

    private fun createCameraCaptureIntent(): Intent? {
        val outputUri = createCameraOutputUri() ?: return null
        val intent = Intent(MediaStore.ACTION_IMAGE_CAPTURE).apply {
            putExtra(MediaStore.EXTRA_OUTPUT, outputUri)
            clipData = ClipData.newUri(contentResolver, "HotelOps camera", outputUri)
            addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION or Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }

        val cameraActivities = packageManager.queryIntentActivities(intent, PackageManager.MATCH_DEFAULT_ONLY)
        return if (cameraActivities.isNotEmpty()) {
            cameraActivities.forEach { activity ->
                grantUriPermission(
                    activity.activityInfo.packageName,
                    outputUri,
                    Intent.FLAG_GRANT_WRITE_URI_PERMISSION or Intent.FLAG_GRANT_READ_URI_PERMISSION
                )
            }
            pendingCameraPhotoUri = outputUri
            intent
        } else {
            null
        }
    }

    private fun createCameraOutputUri(): Uri? {
        return runCatching {
            val cameraDir = File(cacheDir, "camera").apply { mkdirs() }
            val imageFile = File.createTempFile("hotelops-camera-", ".jpg", cameraDir)
            FileProvider.getUriForFile(this, "${packageName}.fileprovider", imageFile)
        }.getOrNull()
    }

    @Deprecated("Android file chooser callback is still routed through WebChromeClient on older WebView APIs.")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)

        if (requestCode != fileChooserRequest) return

        val callback = pendingFilePathCallback ?: return
        val selectedUris = mutableListOf<Uri>()

        if (resultCode == Activity.RESULT_OK) {
            val clipData = data?.clipData

            if (clipData != null) {
                for (index in 0 until clipData.itemCount) {
                    clipData.getItemAt(index)?.uri?.let(selectedUris::add)
                }
            } else {
                data?.data?.let(selectedUris::add)
            }

            if (selectedUris.isEmpty()) {
                pendingCameraPhotoUri?.let(selectedUris::add)
            }
        }

        callback.onReceiveValue(selectedUris.takeIf { it.isNotEmpty() }?.toTypedArray())
        pendingCameraPhotoUri?.let {
            revokeUriPermission(it, Intent.FLAG_GRANT_WRITE_URI_PERMISSION or Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        pendingFilePathCallback = null
        pendingCameraPhotoUri = null
        pendingFileChooserCapture = false
        pendingFileChooserAllowMultiple = false
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<String>,
        grantResults: IntArray
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)

        if (requestCode != cameraPermissionRequest) return

        val granted = grantResults.firstOrNull() == PackageManager.PERMISSION_GRANTED

        pendingCameraPermissionRequest?.let { request ->
            pendingCameraPermissionRequest = null
            if (granted) {
                request.grant(arrayOf(PermissionRequest.RESOURCE_VIDEO_CAPTURE))
            } else {
                request.deny()
            }
        }

        if (pendingFilePathCallback != null) {
            if (granted) {
                launchFileChooser(pendingFileChooserCapture, pendingFileChooserAllowMultiple)
            } else {
                cancelPendingFileChooser()
            }
        }
    }

    private fun injectHotelOpsShellBridge() {
        if (!::webView.isInitialized) return

        // Web uygulamasina Android icinde calistigini, gorunen surumu ve gizli
        // build bilgisini bildiriyoruz. Event, React ilk acilista bridge'i
        // kacirsa bile sidebar surum alaninin sonradan yenilenmesini saglar.
        webView.evaluateJavascript(
            """
            (function () {
              if (window.__hotelOpsAndroidBridgeInstalled) return;
              window.__hotelOpsAndroidBridgeInstalled = true;
              window.__HOTELOPS_SHELL__ = "android";
              window.__HOTELOPS_APP_VERSION__ = "${HotelOpsAppVersion.NAME}";
              window.__HOTELOPS_APP_VERSION_CODE__ = ${HotelOpsAppVersion.UPDATE_CODE};
              window.__HOTELOPS_APP_BUILD__ = ${HotelOpsAppVersion.BUILD};
              window.__HOTELOPS_APP_CHANNEL__ = "${HotelOpsAppVersion.CHANNEL}";
              window.dispatchEvent(new CustomEvent("hotelops:native-shell-ready"));

              function syncToken() {
                try {
                  var token = localStorage.getItem("hotelops.api.token") ||
                    sessionStorage.getItem("hotelops.api.session-token") || "";
                  if (!token && window.HotelOpsAndroidShell && window.HotelOpsAndroidShell.getAuthToken) {
                    token = window.HotelOpsAndroidShell.getAuthToken() || "";
                    if (token) localStorage.setItem("hotelops.api.token", token);
                  }
                  if (window.HotelOpsAndroidShell && window.HotelOpsAndroidShell.setAuthToken) {
                    window.HotelOpsAndroidShell.setAuthToken(token);
                  }
                } catch (error) {}
              }

              window.addEventListener("hotelops:auth-token-changed", syncToken);

              var originalSetItem = Storage.prototype.setItem;
              Storage.prototype.setItem = function (key, value) {
                var result = originalSetItem.apply(this, arguments);
                if (key === "hotelops.api.token" || key === "hotelops.api.session-token") {
                  setTimeout(syncToken, 0);
                }
                return result;
              };

              var originalRemoveItem = Storage.prototype.removeItem;
              Storage.prototype.removeItem = function (key) {
                var result = originalRemoveItem.apply(this, arguments);
                if (key === "hotelops.api.token" || key === "hotelops.api.session-token") {
                  setTimeout(syncToken, 0);
                }
                return result;
              };

              syncToken();
            })();
            """.trimIndent(),
            null
        )
    }

    private fun showConnectionError() {
        // Ana sayfa yuklenemezse kullaniciya native bir hata ekrani gosterilir;
        // retry butonu tekrar canli /hotel adresini yukler.
        if (!::webView.isInitialized) return

        webView.loadDataWithBaseURL(
            null,
            """
            <!DOCTYPE html>
            <html>
            <head>
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    body {
                        margin: 0;
                        height: 100vh;
                        background: #f0f4f8;
                        font-family: Arial, sans-serif;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        color: #1a3a5c;
                    }
                    .box {
                        text-align: center;
                        padding: 28px;
                    }
                    .icon {
                        width: 72px;
                        height: 72px;
                        margin: 0 auto 18px;
                        border-radius: 50%;
                        background: #1a3a5c;
                        color: white;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-size: 34px;
                        font-weight: bold;
                    }
                    h2 {
                        margin: 0 0 10px;
                        font-size: 22px;
                    }
                    p {
                        margin: 0 0 22px;
                        color: #555;
                        font-size: 15px;
                        line-height: 1.5;
                    }
                    button {
                        background: #1a3a5c;
                        color: white;
                        border: none;
                        padding: 12px 22px;
                        border-radius: 10px;
                        font-size: 15px;
                        font-weight: bold;
                    }
                </style>
            </head>
            <body>
                <div class="box">
                    <div class="icon">!</div>
                    <h2>Bağlantı kurulamadı</h2>
                    <p>İnternet bağlantınızı kontrol edip tekrar deneyin.</p>
                    <button onclick="location.href='$siteUrl'">Tekrar Dene</button>
                </div>
            </body>
            </html>
            """.trimIndent(),
            "text/html",
            "UTF-8",
            null
        )
    }

    override fun onDestroy() {
        if (::webView.isInitialized) {
            webView.stopLoading()
            webView.webChromeClient = null
            webView.webViewClient = WebViewClient()
            webView.destroy()
        }
        super.onDestroy()
    }
}
