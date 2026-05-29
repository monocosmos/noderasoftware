# HotelOps Desktop Regression Guardrails

Bu dosya, masaustu uygulamasinda tekrar eden hatalari onlemek icin tutulur. Desktop tarafinda yapilan her degisiklikten sonra bu kurallar uygulanacak.

## Kural 1: Pencere kontrolleri web DOM'una baglanmayacak

Windows pencere butonlari uygulamanin kritik kontrol yuzeyidir. Bu butonlar React, sayfa CSS'i, injected web DOM veya site layout'una bagimli hale getirilmemeli.

Kalici karar:

- Windows kontrol butonlari `apps/desktop/src/desktop-inject.js` ile sayfa icine sabitlenen custom caption alaninda calisir.
- Bu alan child-window degildir; ana webview'in icinde `right: 0; top: 0` ile piksel gridine oturur.
- Ayri seffaf child-window kontrol butonlari varsayilan yontem degildir; sadece acil fallback olarak kodda tutulur.
- Electron `titleBarOverlay` de varsayilan yontem degildir; min/max hover rengini tutarli sekilde yonetemedigi icin kapali tutulur.

Sebep:

- Tray, preload, cache veya renderer yenilenmesi sirasinda web sayfasi gorunur kalip event hatti kopabiliyor.
- Ayri child-window ile cizilen butonlar piksel hizasi ve tooltip tasmasi uretebilir.
- Electron `titleBarOverlay` sag uste iyi oturur, ancak Windows'ta min/max hover arka planini tutarli sekilde gostermeyebilir.
- In-page custom caption, sifira sifir hizalama ve min/max/close hover renklerini birlikte kontrol eder.
- Gercek `transparent: true` Windows penceresi testte maximize hattini bozdugu icin varsayilan yontem degildir. Windows tarafinda glass/blur/acrylic katmani da kullanici tarafindan begenilmedigi icin varsayilan tema solid Mica/normal arka planla kalir.

## Kural 2: Desktop degisikliginden sonra otomatik buton testi kosulacak

Su dosyalardan herhangi biri degisirse test zorunludur:

- `apps/desktop/src/main.cjs`
- `apps/desktop/src/preload.cjs`
- `apps/desktop/src/desktop-inject.js`
- `apps/desktop/src/desktop-inject.css`
- `apps/desktop/src/tray-icon.png`
- `apps/desktop/src/brand-logo.png`
- `apps/desktop/package.json`

Zorunlu komutlar:

```powershell
node --check apps\desktop\src\main.cjs
node --check apps\desktop\src\preload.cjs
node --check apps\desktop\src\desktop-inject.js
npm.cmd run dist --workspace @hotel-ops/desktop
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\Users\hfk47\Documents\noderasoftware\scripts\workstation\test-desktop-window-controls.ps1"
```

Test gecmeden kurulu uygulama, indirme dosyalari veya Raspberry Pi yayinina gecilmeyecek.

## Kural 3: Tray ikonu marka logosundan ayridir

`brand-logo.png` kare zeminli gorseldir ve web/uygulama icindeki marka alaninda kullanilir. Windows tray icin dogrudan kullanilmaz.

Kalici karar:

- Tray ve Windows notification ikonu `apps/desktop/src/tray-icon.png` dosyasini kullanir.
- `tray-icon.png` transparan arka planli olmalidir.
- Logo degistirilecekse marka logosu ve tray ikonu ayri ayri kontrol edilir.

## Kural 4: Kurulu uygulama guncellenirken eski surecler temizlenecek

Electron surecleri birden fazla alt process ile calisir. Eski renderer/preload sureci aktif kalirsa yeni paket kopyalansa bile eski davranis ekranda kalabilir.

Guncelleme sirasi:

1. Calisan `HotelOps Desktop` surecleri kapatilir.
2. `apps/desktop/release/win-unpacked` kurulu klasore kopyalanir.
3. Uygulama yeniden baslatilir.
4. Pencere buton testi kosulur.

Kurulu klasor:

```text
%LOCALAPPDATA%\Programs\HotelOps Desktop
```

## Kural 5: Download paketleri Pi'ye ayrica dahil edilecek

Windows Setup/Portable dosyalari buyuk oldugu icin normal hizli deploy bazen downloads klasorunu disarida birakir.

Desktop paketi degistiginde zorunlu yayin:

```powershell
Copy-Item -Force apps\desktop\release\HotelOps-Setup-V1-x64.exe apps\web\public\downloads\HotelOps-Setup-V1-x64.exe
Copy-Item -Force apps\desktop\release\HotelOps-Portable-V1-x64.exe apps\web\public\downloads\HotelOps-Portable-V1-x64.exe
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\Users\hfk47\Documents\noderasoftware\scripts\workstation\publish-to-pi.ps1" -SkipBuild -IncludeDownloads
```

Sonrasinda canli dosya boyutlari kontrol edilir:

```powershell
curl.exe -k -I https://noderasoftware.com/downloads/HotelOps-Setup-V1-x64.exe
curl.exe -k -I https://noderasoftware.com/downloads/HotelOps-Portable-V1-x64.exe
```

## Kural 6: Son kontrol listesi

Desktop degisikligi tamamlanmis sayilmaz, ta ki su maddeler dogrulanana kadar:

- Pencere kucultme calisiyor.
- Pencere buyutme/geri alma calisiyor.
- X butonu tray'e indiriyor.
- Tray ikonu transparan gorunuyor.
- Windows bildirimi ikon olarak transparan tray ikonunu kullaniyor.
- Setup ve Portable dosyalari yeniden uretilmis.
- Web downloads klasorune yeni exe'ler kopyalanmis.
- Raspberry Pi'ye `-IncludeDownloads` ile yayinlanmis.
- `hotelops-api`, `nginx`, `postgresql` servisleri aktif.
