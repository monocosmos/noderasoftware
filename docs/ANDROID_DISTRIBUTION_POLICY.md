# Android Distribution Policy

HotelOps Android iki kanaldan yayinlanir.

## Kanal 1: Direct APK

- Gradle flavor: `direct`
- Paket adi: `com.example.nodera`
- Amac: Mevcut APK kullanicilarini bozmadan noderasoftware.com uzerinden APK yayinlamak.
- Cikti: `apps/web/public/downloads/HotelOps-Android-V1.apk`
- Build komutu:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\Users\hfk47\Documents\noderasoftware\scripts\workstation\build-android-apk.ps1"
```

Direct APK kanalinda `REQUEST_INSTALL_PACKAGES` izni vardir; bu kanal kendi APK
guncellemesini indirebilir.

## Kanal 2: Play Store AAB

- Gradle flavor: `play`
- Paket adi: `com.noderasoftware.hotelops`
- Amac: Google Play Store uzerinden yayinlamak.
- Cikti: `apps/android/app/build/outputs/bundle/playRelease/HotelOps-Play-V1.aab`
- Build komutu:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\Users\hfk47\Documents\noderasoftware\scripts\workstation\build-android-play-aab.ps1"
```

Play kanalinda `REQUEST_INSTALL_PACKAGES` izni yoktur. Play kanalinin guncelleme
linki APK indirme linki degil, Play Store uygulama sayfasi olmalidir.

## Firebase

Direct APK mevcut `com.example.nodera` Firebase Android app kaydini kullanir.

Play Store AAB icin Firebase Console'da ayrica su paket adiyla Android app
eklenmelidir:

```text
com.noderasoftware.hotelops
```

Firebase'den indirilen Play Store `google-services.json` dosyasi su klasore
konmalidir:

```text
apps/android/app/src/play/google-services.json
```

Bu dosya yoksa Play Store AAB build scripti bilincli olarak durur.

## Surum kurali

Her yeni APK veya AAB ciktisinda kullaniciya gorunen Android surumu ve gizli
teknik kod birlikte artar:

- `apps/android/app/build.gradle.kts` icindeki `versionCode`
- `apps/android/app/build.gradle.kts` icindeki `versionName`
- `apps/android/app/src/main/java/com/example/nodera/HotelOpsAppVersion.kt` icindeki uygulama surumu ve teknik kod
- `apps/web/public/app-version.json` icindeki `androidDirect` ve `androidPlay` kodlari

Alt surumler `0` ile `99` arasinda kalir. `1.0.99` sonrasinda `1.1.0` kullanilir.
Gizli build/update kodlari arayuzde gosterilmez; sadece guncelleme kontrolunde kullanilir.

## Update davranisi

- `direct` kanal eski kalirsa `/downloads/HotelOps-Android-V1.apk` indirilir.
- `play` kanal eski kalirsa `https://play.google.com/store/apps/details?id=com.noderasoftware.hotelops` acilir.
