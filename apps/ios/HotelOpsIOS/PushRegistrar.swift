import Foundation
import UIKit
import FirebaseCore
import FirebaseMessaging

enum PushRegistrar {
    private static let registerURL = URL(string: "https://noderasoftware.com/api/push-devices")!

    static func configureFirebaseIfAvailable() -> Bool {
        guard Bundle.main.path(forResource: "GoogleService-Info", ofType: "plist") != nil else {
            return false
        }

        if FirebaseApp.app() == nil {
            FirebaseApp.configure()
        }
        return true
    }

    static func sync() {
        guard FirebaseApp.app() != nil else { return }

        let authToken = HotelOpsPreferences.authToken
        guard !authToken.isEmpty else { return }

        Messaging.messaging().token { token, _ in
            guard let token, !token.isEmpty else { return }
            HotelOpsPreferences.fcmToken = token
            register(authToken: authToken, fcmToken: token)
        }
    }

    static func register(authToken: String, fcmToken: String) {
        let cleanAuthToken = authToken.trimmingCharacters(in: .whitespacesAndNewlines)
        let cleanFcmToken = fcmToken.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !cleanAuthToken.isEmpty, !cleanFcmToken.isEmpty else { return }

        var request = URLRequest(url: registerURL)
        request.httpMethod = "POST"
        request.timeoutInterval = 10
        request.setValue("Bearer \(cleanAuthToken)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("NoderaHotelOpsiOS/\(HotelOpsIOSAppVersion.updateCode)", forHTTPHeaderField: "User-Agent")

        let payload: [String: Any] = [
            "platform": "IOS",
            "fcmToken": cleanFcmToken,
            "deviceId": UIDevice.current.identifierForVendor?.uuidString ?? "",
            "appVersion": HotelOpsIOSAppVersion.name,
            "appBuild": HotelOpsIOSAppVersion.build
        ]

        request.httpBody = try? JSONSerialization.data(withJSONObject: payload, options: [])

        URLSession.shared.dataTask(with: request) { _, _, _ in
            // Registration is retried on app open, login token sync, and FCM token refresh.
        }.resume()
    }
}
