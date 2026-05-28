# App Version Policy

HotelOps user-facing app version stays simple, while each distributable build gets a hidden monotonic build code.

## User-facing version

- Windows desktop: `1.0.0`, shown in the sidebar as `Windows v1.0.0`.
- Android APK: `1.0.0`, shown in the sidebar as `Android v1.0.0`.
- Installer/download filenames may keep the V1 naming convention for distribution continuity.

## Hidden update codes

- Windows desktop hidden build code is stored in:
  - `apps/desktop/src/main.cjs` as `DESKTOP_APP_BUILD`
  - `apps/desktop/src/preload.cjs` as `appVersionCode`
  - `apps/web/public/app-version.json` as `platforms.desktop.latestCode`
- Android hidden update code is stored in:
  - `apps/android/app/build.gradle.kts` as `versionCode`
  - `apps/android/app/src/main/java/com/example/nodera/HotelOpsAppVersion.kt` as `UPDATE_CODE`
  - `apps/web/public/app-version.json` as `platforms.android.latestCode`

## Required rule

Every revised Windows EXE or Android APK must increase its hidden code, even when the visible version stays `1.0.0`. Otherwise old installed apps cannot reliably detect that a newer build exists.

Current baseline:

- Windows visible version: `1.0.0`
- Windows hidden build code: `3`
- Android visible version: `1.0.0`
- Android hidden update code: `2026052803`
