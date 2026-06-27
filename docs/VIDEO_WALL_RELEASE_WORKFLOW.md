# VideoWallPlayer Release Workflow

Bu akis VideoWallPlayer uygulama paketlerinin Nodera web sitesine ve Raspberry Pi canli sunucusuna karismadan yayinlanmasi icindir.

## Klasorler

- VideoWallPlayer kaynak repo: `C:\Users\hfk47\Belgeler\HotelVideoWall`
- VideoWallPlayer release ciktilari: `C:\Users\hfk47\Belgeler\HotelVideoWall\releases`
- Nodera web repo: `C:\Users\hfk47\Documents\noderasoftware\github-sync`
- Site download klasoru: `apps\web\public\downloads`
- Canli web klasoru: `/opt/noderasoftware/apps/web/out`

## Beklenen Release Dosyalari

`HotelVideoWall\releases` altinda su dosyalar olmalidir:

- `VideoWallPlayer-Windows-Setup-x64.exe`
- `VideoWallPlayer-Windows-Portable-x64.zip`
- `VideoWallPlayer-Android.apk` veya `VideoWallPlayer-Android-debug.apk`

Import scripti Android dosyasini sitede beklenen `VideoWallPlayer-Android.apk` adina normalize eder.

## Normal Yayin Sirasi

1. VideoWallPlayer uygulamasinda yeni paketleri uret.
2. Masaustunden `VideoWall Buildlerini Siteye Isle.bat` calistir.
3. Nodera web sitesinde build kontrolu al:

   ```powershell
   npm.cmd run typecheck --workspace @hotel-ops/web
   npm.cmd run build --workspace @hotel-ops/web
   ```

4. Nodera web degisikliklerini GitHub'a sadece VideoWallPlayer section olarak gonder. Buyuk APK/EXE/ZIP paketleri bu adimda GitHub'a stage edilmez:

   ```powershell
   .\scripts\workstation\videowall-githuba-yukle.bat
   ```

5. Canli Raspberry Pi'ye GitHub'dan sadece VideoWallPlayer section'i yayinla:

   ```powershell
   .\scripts\workstation\videowall-yayina-al.bat
   ```

6. Uygulama paketlerini ayni modem/ag icinden Raspberry Pi'ye SFTP ile gonder:

   ```powershell
   .\scripts\workstation\publish-to-pi.ps1 -SkipBuild -IncludeDownloads -SkipDatabaseSchemaPush
   ```

## Sadece VideoWallPlayer Degistiyse

Sadece `/videowallplayer/` sayfasi degistiyse tam site deploy yapma. Once sadece VideoWallPlayer section'i GitHub'a gonder, sonra Pi'ye yine sadece o section'i al:

```powershell
.\scripts\workstation\videowall-githuba-yukle.bat
.\scripts\workstation\videowall-yayina-al.bat
```

VideoWallPlayer APK/EXE/ZIP paketleri degistiyse GitHub'a yukleme. Paketleri lokal LAN SFTP hatti ile gonder:

```powershell
.\scripts\workstation\publish-to-pi.ps1 -SkipBuild -IncludeDownloads -SkipDatabaseSchemaPush
```

Bu akis GitHub'dan build alir ve canli Pi'de sadece sunlari gunceller:

- `/opt/noderasoftware/apps/web/out/videowallplayer`
- `/opt/noderasoftware/apps/web/out/brand/videowallplayer`
- `/opt/noderasoftware/apps/web/out/_next/static` yeni dosyalar eklenerek

Bu akis su alanlara dokunmaz:

- `/opt/noderasoftware/apps/web/out/hotel`
- `/opt/noderasoftware/apps/web/out/hotelpanel`
- `/opt/noderasoftware/apps/web/out/index.html`
- `/opt/noderasoftware/apps/web/out/downloads/VideoWallPlayer-*`
- `/opt/noderasoftware/apps/web/public/downloads/VideoWallPlayer-*`
- HotelOps API, veritabani ve servis semasi

## Buyuk Paket Notu

VideoWallPlayer indirme paketleri buyuk dosyalardir. Normal akis:

- Paketler GitHub'a commit/push edilmez.
- Paketler Raspberry Pi'ye sadece LAN/private IP uzerinden SFTP ile gonderilir.
- `noderapi` SSH profili public domain veya port-forward'a bakiyorsa buyuk paket deploy'u durur.
- Git LFS sadece eski/istisnai geri donus hatti olarak dusunulur; normal yayin hatti degildir.

## Guvenlik Kontrolleri

`deploy-built-to-pi.ps1` su route'lar eksikse deploy'u durdurur:

- `/`
- `/hotel/`
- `/hotel/login/`
- `/hotel/hotelpanel/`
- `/hotelpanel/`
- `/videowallplayer/`

`-IncludeDownloads` kullanildiginda su VideoWallPlayer dosyalari da zorunludur:

- `/downloads/VideoWallPlayer-Windows-Setup-x64.exe`
- `/downloads/VideoWallPlayer-Windows-Portable-x64.zip`
- `/downloads/VideoWallPlayer-Android.apk`

## Masaustu Kisayollari

- `Nodera GitHub Yukle.bat`: Nodera web reposunu build eder, commit eder ve GitHub'a push eder.
- `Nodera RaspberryPi Yayinla.bat`: Yerel build ve download dosyalarini Pi'ye yayinlar.
- `VideoWall Buildlerini Siteye Isle.bat`: VideoWallPlayer release dosyalarini Nodera web downloads klasorune isler.
- `VideoWall Siteye Yayinla.bat`: GitHub'dan sadece `/videowallplayer/` site bolumunu Pi'ye yayinlar.
