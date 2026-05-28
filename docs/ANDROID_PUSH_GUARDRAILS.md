# Android Push Guardrails

Android bildirimi operasyon sisteminde kritik hattir. Uygulama acikken gelen web/socket bildirimi yeterli kabul edilmez. Kullanici Android uygulamada hesaba giris yaptiktan sonra uygulamadan ciksa veya uygulamayi arka plana alsa bile ilgili hesaba FCM push bildirimi dusmelidir.

## Kalici karar

- Android uygulama FCM tokeni alir.
- Login sonrasi web tokeni native Android bridge'e yazilir.
- Native taraf `/api/push-devices` endpoint'ine FCM tokeni ve kullanici oturumunu kaydeder.
- API is, ariza, hatirlatma, talep, operasyon belgesi ve SLA bildirimlerini veritabanina yazarken Android FCM push olarak da gonderir.
- Sadece uygulama acikken gorunen browser/socket bildirimi bu ihtiyaci karsilamaz.

## Zorunlu kontrol komutu

API, Android, notification, Firebase, deploy veya login token akisi degistiyse su test kosulmadan is tamamlanmis sayilmaz:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\Users\hfk47\Documents\noderasoftware\scripts\workstation\test-android-push-pipeline.ps1" -Password "<demo-test-password>"
```

Parolayi komutta yazmak istenmezse:

```powershell
$env:HOTELOPS_PUSH_TEST_PASSWORD = "<demo-test-password>"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\Users\hfk47\Documents\noderasoftware\scripts\workstation\test-android-push-pipeline.ps1"
```

## Testin kontrol ettikleri

- Raspberry Pi API health ve database durumu.
- `hotelops-api`, `nginx`, `postgresql` servisleri.
- Canli API kaynak kodunda `/push-devices`, `firebase-admin` ve `sendPushNotifications` hatti.
- Raspberry Pi uzerinde Firebase Admin servis hesabi okunabilirligi.
- Canli HTTPS API uzerinden test FCM token kaydi.
- Veritabaninda aktif Android push cihaz kaydi.

## Kritik yorum

Aktif Android push cihazi yoksa kapali uygulama bildirimi dusmez. Teknik kullanici bildirim alacaksa Android uygulamada teknik hesapla en az bir kez giris yapmis ve tokenin o hesaba kaydolmus olmasi gerekir.

Android ayarlarindan uygulama `Zorla durdur` yapilirsa Android isletim sistemi FCM teslimini kesebilir. Normal arka plana alma veya son uygulamalardan temizleme senaryosu icin FCM hatti calismalidir.
