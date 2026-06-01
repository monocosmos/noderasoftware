# HotelOps iPhone

Native iOS wrapper for the live HotelOps web app.

This app mirrors the Android APK behavior without changing the existing Android,
web, or API code:

- opens `https://noderasoftware.com/hotel/` in a native `WKWebView`
- exposes the existing Android-compatible JavaScript bridge name so the current
  web app can detect a native shell without web changes
- stores the web auth token in native preferences
- registers the Firebase Messaging token with `/api/push-devices`
- opens trusted `/downloads/` links outside the webview
- supports camera/photo file inputs through iOS WebKit

## Build Requirements

- macOS with Xcode 16 or newer
- Apple Developer account and iPhone signing team
- Firebase iOS app for the selected bundle id
- APNs key/certificate uploaded to Firebase Cloud Messaging

## Firebase Setup

1. Create an iOS app in Firebase Console.
2. Use bundle id `com.noderasoftware.hotelops.ios`, or change the bundle id in
   Xcode before downloading the Firebase config.
3. Download `GoogleService-Info.plist`.
4. Add it to the `HotelOpsIOS` target in Xcode.

The app checks for `GoogleService-Info.plist` before configuring Firebase, so the
webview still runs without it. Push registration needs the file.

## Build

Open `HotelOpsIOS.xcodeproj` in Xcode, select the `HotelOpsIOS` scheme, set the
signing team, then run on an iPhone or archive for TestFlight/App Store.

Command line on macOS:

```sh
xcodebuild -project HotelOpsIOS.xcodeproj -scheme HotelOpsIOS -configuration Release -destination 'generic/platform=iOS' archive -archivePath build/HotelOpsIOS.xcarchive
```

## Push Delivery Note

The current API accepts `IOS` in `/api/push-devices`, and this app registers as
`IOS`. Existing server send logic currently filters push delivery to Android
devices. Because the requested scope forbids changing existing API code, this
iOS app source is ready, but live iPhone push delivery requires a separate API
follow-up to include `IOS` devices in the push send query and Firebase message
payload.
