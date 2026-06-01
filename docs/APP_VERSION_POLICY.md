# App Version Policy

HotelOps user-facing app version and technical build code must move together for distributable app releases.

## User-facing version

- Windows desktop: shown in the sidebar as `Windows vX.Y.Z`.
- Android APK: shown in the sidebar as `Android vX.Y.Z`.
- Installer/download filenames may keep the V1 naming convention for distribution continuity.
- Patch and minor parts use `0` to `99`. After `1.0.99`, the next app release is `1.1.0`.

## Hidden update codes

- Windows desktop hidden build code is stored in:
  - `apps/desktop/src/main.cjs` as `DESKTOP_APP_BUILD`
  - `apps/desktop/src/preload.cjs` as `appVersionCode`
  - `apps/web/public/app-version.json` as `platforms.desktop.latestCode`
- Android hidden update code is stored in:
  - `apps/android/app/build.gradle.kts` as `versionCode`
  - `apps/android/app/src/main/java/com/example/nodera/HotelOpsAppVersion.kt` as `UPDATE_CODE`
  - `apps/web/public/app-version.json` as `platforms.androidDirect.latestCode` and `platforms.androidPlay.latestCode`
- Hidden build/update codes are never shown in the app UI. They are used only for update detection and release tracking.
- Android has two distribution channels:
  - Direct APK flavor: `direct`, package `com.example.nodera`
  - Play Store AAB flavor: `play`, package `com.noderasoftware.hotelops`

## Required rule

Every revised Windows EXE or Android APK must increase both values:

- User-facing version increases by one patch step, for example `1.0.0` -> `1.0.1`.
- Hidden build/update code increases monotonically.

Web-only HotelOps changes do not require an EXE/APK version bump unless a new Windows or Android binary is actually produced. Otherwise old installed apps can be told to update when there is no matching downloadable app package.

`/app-version.json` is a release-critical file. Raspberry Pi deploys must fail if this URL does not return parseable JSON with `desktop`, `androidDirect`, and `androidPlay` platform entries. If nginx returns HTML for this path, installed apps can miss updates or show inconsistent update warnings.

Post-deploy workstation check:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts\workstation\test-app-version-manifest.ps1
```

Current baseline:

- Windows visible version: `1.0.1`
- Windows hidden build code: `6`
- Android visible version: `1.0.7`
- Android hidden product build: `11`
- Android hidden update code: `2026053103`
