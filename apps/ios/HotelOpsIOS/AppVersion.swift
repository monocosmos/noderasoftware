import Foundation

enum HotelOpsIOSAppVersion {
    static let name = "1.0.0"
    static let build = 1
    static let updateCode = 2026053101
    static let channel = "ios"

    // The current web runtime only understands web, desktop, and android.
    // Keep the iPhone shell Android-compatible until web adds a first-class iOS runtime.
    static let webCompatibilityRuntime = "android"
    static let webCompatibilityChannel = "direct"
}
