import UIKit
import WebKit
import UserNotifications

final class MainViewController: UIViewController, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler {
    private let siteURL = URL(string: "https://noderasoftware.com/hotel/")!
    private let siteOrigin = URL(string: "https://noderasoftware.com")!
    private var webView: WKWebView?
    private var splashView: UIView?

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor(red: 5 / 255, green: 10 / 255, blue: 25 / 255, alpha: 1)
        showSplashThenLoadWebView()
    }

    private func showSplashThenLoadWebView() {
        let splash = UIView()
        splash.translatesAutoresizingMaskIntoConstraints = false
        splash.backgroundColor = view.backgroundColor

        let title = UILabel()
        title.translatesAutoresizingMaskIntoConstraints = false
        title.text = "Nodera Sistem"
        title.textColor = .white
        title.font = .systemFont(ofSize: 28, weight: .bold)

        let subtitle = UILabel()
        subtitle.translatesAutoresizingMaskIntoConstraints = false
        subtitle.text = "Otel Operasyon Yonetim Sistemi"
        subtitle.textColor = UIColor(white: 1, alpha: 0.72)
        subtitle.font = .systemFont(ofSize: 15, weight: .medium)

        let stack = UIStackView(arrangedSubviews: [title, subtitle])
        stack.translatesAutoresizingMaskIntoConstraints = false
        stack.axis = .vertical
        stack.alignment = .center
        stack.spacing = 8

        splash.addSubview(stack)
        view.addSubview(splash)

        NSLayoutConstraint.activate([
            splash.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            splash.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            splash.topAnchor.constraint(equalTo: view.topAnchor),
            splash.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            stack.centerXAnchor.constraint(equalTo: splash.centerXAnchor),
            stack.centerYAnchor.constraint(equalTo: splash.centerYAnchor)
        ])

        splash.alpha = 0
        UIView.animate(withDuration: 0.45) {
            splash.alpha = 1
        }

        splashView = splash
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.2) {
            self.setupWebView()
        }
    }

    private func setupWebView() {
        let userContentController = WKUserContentController()
        userContentController.add(self, name: "hotelOpsNative")
        userContentController.addUserScript(WKUserScript(
            source: bridgeScript(),
            injectionTime: .atDocumentStart,
            forMainFrameOnly: true
        ))

        let configuration = WKWebViewConfiguration()
        configuration.userContentController = userContentController
        configuration.preferences.javaScriptCanOpenWindowsAutomatically = true
        configuration.applicationNameForUserAgent = [
            "NoderaHotelOpsAndroid/\(HotelOpsIOSAppVersion.updateCode)",
            "HotelOpsAndroidVersion/\(HotelOpsIOSAppVersion.name)",
            "HotelOpsAndroidBuild/\(HotelOpsIOSAppVersion.build)",
            "HotelOpsAndroidChannel/\(HotelOpsIOSAppVersion.webCompatibilityChannel)",
            "HotelOpsAndroid",
            "NoderaHotelOpsiOS/\(HotelOpsIOSAppVersion.updateCode)"
        ].joined(separator: " ")

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.translatesAutoresizingMaskIntoConstraints = false
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.allowsBackForwardNavigationGestures = true
        webView.scrollView.contentInsetAdjustmentBehavior = .automatic
        webView.backgroundColor = view.backgroundColor
        webView.isOpaque = false

        view.insertSubview(webView, at: 0)
        NSLayoutConstraint.activate([
            webView.leadingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor),
            webView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            webView.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor)
        ])

        self.webView = webView
        webView.load(URLRequest(url: siteURL, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: 20))

        UIView.animate(withDuration: 0.25, animations: {
            self.splashView?.alpha = 0
        }, completion: { _ in
            self.splashView?.removeFromSuperview()
            self.splashView = nil
        })
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard
            message.name == "hotelOpsNative",
            let body = message.body as? [String: Any],
            let name = body["name"] as? String
        else {
            return
        }

        let payload = body["payload"] as? [String: Any] ?? [:]
        switch name {
        case "setAuthToken":
            let token = (payload["token"] as? String) ?? ""
            HotelOpsPreferences.authToken = token
            PushRegistrar.sync()
        case "clearAuthToken":
            HotelOpsPreferences.authToken = ""
        case "notifyAppUpdate":
            let title = (payload["title"] as? String)?.nilIfBlank ?? "HotelOps guncellemesi var"
            let body = (payload["body"] as? String)?.nilIfBlank ?? "iPhone uygulamasinin yeni surumu hazir."
            showLocalNotification(title: title, body: body)
        case "openDownloadUrl":
            let rawURL = (payload["url"] as? String) ?? ""
            _ = openTrustedDownload(rawURL)
        default:
            break
        }
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        webView.evaluateJavaScript(bridgeScript(), completionHandler: nil)
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        showConnectionError()
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        showConnectionError()
    }

    func webView(
        _ webView: WKWebView,
        decidePolicyFor navigationAction: WKNavigationAction,
        decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
    ) {
        guard let url = navigationAction.request.url else {
            decisionHandler(.allow)
            return
        }

        if isTrustedDownloadURL(url) {
            UIApplication.shared.open(url)
            decisionHandler(.cancel)
            return
        }

        if isTrustedWebURL(url) {
            decisionHandler(.allow)
        } else {
            UIApplication.shared.open(url)
            decisionHandler(.cancel)
        }
    }

    func webView(
        _ webView: WKWebView,
        createWebViewWith configuration: WKWebViewConfiguration,
        for navigationAction: WKNavigationAction,
        windowFeatures: WKWindowFeatures
    ) -> WKWebView? {
        if let url = navigationAction.request.url {
            UIApplication.shared.open(url)
        }
        return nil
    }

    private func bridgeScript() -> String {
        let token = jsonString(HotelOpsPreferences.authToken)
        let version = jsonString(HotelOpsIOSAppVersion.name)
        let channel = jsonString(HotelOpsIOSAppVersion.webCompatibilityChannel)
        let runtime = jsonString(HotelOpsIOSAppVersion.webCompatibilityRuntime)

        return """
        (function () {
          if (window.__hotelOpsIOSBridgeInstalled) return;
          window.__hotelOpsIOSBridgeInstalled = true;

          var authToken = \(token);
          var nativeBridge = window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.hotelOpsNative;
          function post(name, payload) {
            try {
              if (nativeBridge) nativeBridge.postMessage({ name: name, payload: payload || {} });
            } catch (error) {}
          }

          window.__HOTELOPS_SHELL__ = \(runtime);
          window.__HOTELOPS_APP_VERSION__ = \(version);
          window.__HOTELOPS_APP_VERSION_CODE__ = \(HotelOpsIOSAppVersion.updateCode);
          window.__HOTELOPS_APP_BUILD__ = \(HotelOpsIOSAppVersion.build);
          window.__HOTELOPS_APP_CHANNEL__ = \(channel);

          window.HotelOpsAndroidShell = {
            app: function () { return "Nodera HotelOps"; },
            runtime: function () { return \(runtime); },
            version: function () { return \(version); },
            versionCode: function () { return \(HotelOpsIOSAppVersion.updateCode); },
            buildNumber: function () { return \(HotelOpsIOSAppVersion.build); },
            channel: function () { return \(channel); },
            getAuthToken: function () { return authToken || ""; },
            setAuthToken: function (token) {
              authToken = (token || "").trim();
              post("setAuthToken", { token: authToken });
              return true;
            },
            clearAuthToken: function () {
              authToken = "";
              post("clearAuthToken", {});
              return true;
            },
            notifyAppUpdate: function (title, body) {
              post("notifyAppUpdate", { title: title || "", body: body || "" });
              return true;
            },
            openDownloadUrl: function (url) {
              post("openDownloadUrl", { url: url || "" });
              return true;
            }
          };

          function syncToken() {
            try {
              var token = localStorage.getItem("hotelops.api.token") ||
                sessionStorage.getItem("hotelops.api.session-token") || "";
              if (!token && authToken) {
                token = authToken;
                localStorage.setItem("hotelops.api.token", token);
              }
              window.HotelOpsAndroidShell.setAuthToken(token);
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

          window.dispatchEvent(new CustomEvent("hotelops:native-shell-ready"));
          syncToken();
        })();
        """
    }

    private func openTrustedDownload(_ rawURL: String) -> Bool {
        guard let url = normalizedDownloadURL(rawURL), isTrustedDownloadURL(url) else { return false }
        UIApplication.shared.open(url)
        return true
    }

    private func normalizedDownloadURL(_ rawURL: String) -> URL? {
        let value = rawURL.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !value.isEmpty else { return nil }

        if value.hasPrefix("/") {
            return URL(string: value, relativeTo: siteOrigin)?.absoluteURL
        }
        if value.hasPrefix("http://") || value.hasPrefix("https://") {
            return URL(string: value)
        }
        return URL(string: "/" + value, relativeTo: siteOrigin)?.absoluteURL
    }

    private func isTrustedDownloadURL(_ url: URL) -> Bool {
        guard isTrustedWebURL(url) else { return false }
        return url.path.hasPrefix("/downloads/")
    }

    private func isTrustedWebURL(_ url: URL) -> Bool {
        guard url.scheme == "https" else { return false }
        let host = url.host?.lowercased()
        return host == "noderasoftware.com" || host == "www.noderasoftware.com"
    }

    private func showLocalNotification(title: String, body: String) {
        let content = UNMutableNotificationContent()
        content.title = title
        content.body = body
        content.sound = .default

        let request = UNNotificationRequest(
            identifier: "hotelops-app-update-\(HotelOpsIOSAppVersion.updateCode)",
            content: content,
            trigger: nil
        )
        UNUserNotificationCenter.current().add(request)
    }

    private func showConnectionError() {
        webView?.loadHTMLString("""
        <!doctype html>
        <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body {
              margin: 0;
              height: 100vh;
              background: #f0f4f8;
              font-family: -apple-system, BlinkMacSystemFont, sans-serif;
              display: flex;
              align-items: center;
              justify-content: center;
              color: #1a3a5c;
            }
            .box { text-align: center; padding: 28px; }
            h2 { margin: 0 0 10px; font-size: 22px; }
            p { margin: 0 0 22px; color: #555; font-size: 15px; line-height: 1.5; }
            button {
              background: #1a3a5c;
              color: white;
              border: 0;
              padding: 12px 22px;
              border-radius: 10px;
              font-size: 15px;
              font-weight: 700;
            }
          </style>
        </head>
        <body>
          <div class="box">
            <h2>Baglanti kurulamadi</h2>
            <p>Internet baglantinizi kontrol edip tekrar deneyin.</p>
            <button onclick="location.href='\(siteURL.absoluteString)'">Tekrar Dene</button>
          </div>
        </body>
        </html>
        """, baseURL: nil)
    }

    private func jsonString(_ value: String) -> String {
        let data = try? JSONSerialization.data(withJSONObject: value, options: [])
        return data.flatMap { String(data: $0, encoding: .utf8) } ?? "\"\""
    }
}

private extension String {
    var nilIfBlank: String? {
        let cleanValue = trimmingCharacters(in: .whitespacesAndNewlines)
        return cleanValue.isEmpty ? nil : cleanValue
    }
}
