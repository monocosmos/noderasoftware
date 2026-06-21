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

4. Nodera web degisikliklerini GitHub'a gonder:

   ```powershell
   .\scripts\workstation\githuba-yukle.bat
   ```

5. Canli Raspberry Pi'ye yerel dogrulanmis build'i yayinla:

   ```powershell
   .\scripts\workstation\raspberrypi-yayina-al.bat
   ```

## Neden Yerel Pi Deploy Tercih Edilir?

VideoWallPlayer indirme paketleri buyuk dosyalardir. Bu repo download dosyalarini Git LFS ile takip edebilir, fakat canli yayin icin en guvenli yol yerel olarak dogrulanmis `apps/web/public/downloads/` klasorunu `-IncludeDownloads` ile Pi'ye gondermektir.

GitHub'dan direkt deploy sadece su durumda kullanilmalidir:

- Download dosyalari Git LFS'e commit/push edilmis olmali.
- Pi tarafinda `git lfs pull` basarili calismali.
- Web route ve download smoke kontrolleri sonradan tekrar yapilmali.

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
