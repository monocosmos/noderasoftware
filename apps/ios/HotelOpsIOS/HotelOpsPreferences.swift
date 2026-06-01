import Foundation

enum HotelOpsPreferences {
    private static let authTokenKey = "hotelops.ios.auth_token"
    private static let fcmTokenKey = "hotelops.ios.fcm_token"

    static var authToken: String {
        get { UserDefaults.standard.string(forKey: authTokenKey) ?? "" }
        set {
            let cleanValue = newValue.trimmingCharacters(in: .whitespacesAndNewlines)
            if cleanValue.isEmpty {
                UserDefaults.standard.removeObject(forKey: authTokenKey)
            } else {
                UserDefaults.standard.set(cleanValue, forKey: authTokenKey)
            }
        }
    }

    static var fcmToken: String {
        get { UserDefaults.standard.string(forKey: fcmTokenKey) ?? "" }
        set {
            let cleanValue = newValue.trimmingCharacters(in: .whitespacesAndNewlines)
            if cleanValue.isEmpty {
                UserDefaults.standard.removeObject(forKey: fcmTokenKey)
            } else {
                UserDefaults.standard.set(cleanValue, forKey: fcmTokenKey)
            }
        }
    }
}
