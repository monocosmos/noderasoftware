# Sectioned Site Architecture

Nodera web artik tek parca yayin dusuncesiyle degil, bolum bazli yayin dusuncesiyle yonetilir.

Temel kural:

```text
Bir ana link = bir section
Bir section = kendi kaynak klasoru + kendi route kapisi + kendi deploy kapsami
```

## Bolum Agaci

```text
apps/web/src/app/
  page.tsx                         -> home section kapisi
  hotel/
    page.tsx                       -> /hotel/
    [...hotelSlug]/page.tsx        -> /hotel/dashboard, /hotel/hotelpanel, ...
  videowallplayer/
    page.tsx                       -> /videowallplayer/
  [...slug]/
    page.tsx                       -> eski hotel linklerini /hotel alanina yonlendirir

apps/web/src/sections/
  home/
    page.tsx
  hotel/
    page.tsx
    routes.ts
  videowallplayer/
    page.tsx
```

## Section Sahipligi

- `home`: `/` ana sayfa.
- `hotel`: `/hotel`, `/hotel/dashboard`, `/hotel/hotelpanel` ve eski uyumluluk linkleri (`/dashboard`, `/hotelpanel`, vb.).
- `videowallplayer`: sadece `/videowallplayer`, `brand/videowallplayer` ve `VideoWallPlayer-*` indirme dosyalari.

`hotel/dashboard` ve `hotel/hotelpanel` ayni ana bolumun parcalaridir. Bunlar birbirinden yuzde yuz kopuk olmak zorunda degildir.

`hotel` ve `videowallplayer` ayri section'lardir. Birinin yayin akisi digerinin HTML ciktilarini silmez veya yeniden yazmaz.

## GitHub'a Sadece Bir Bolum Gonderme

```powershell
.\scripts\workstation\publish-local-to-github.ps1 -Section videowallplayer -Message "chore: publish videowallplayer section"
.\scripts\workstation\publish-local-to-github.ps1 -Section hotel -Message "chore: publish hotel section"
.\scripts\workstation\publish-local-to-github.ps1 -Section home -Message "chore: publish home section"
```

Bu komut build alir ve sadece secilen section icin tanimli path'leri stage eder. Tanimlar:

```text
scripts/workstation/site-sections.ps1
```

Tum siteyi bilerek yayinlamak icin:

```powershell
.\scripts\workstation\publish-local-to-github.ps1 -Section all -Message "chore: publish full site"
```

## GitHub'dan Pi'ye Sadece Bir Bolum Alma

```powershell
.\scripts\workstation\deploy-pi-from-github.ps1 -Section videowallplayer
.\scripts\workstation\deploy-pi-from-github.ps1 -Section hotel
.\scripts\workstation\deploy-pi-from-github.ps1 -Section home
```

Pi tarafinda ayni is:

```bash
cd /opt/noderasoftware
sudo BRANCH=master SECTION=videowallplayer bash scripts/pi/deploy-from-github.sh
```

Section deploy'u Pi'de gecici bir build klasoru olusturur, GitHub'daki hedef branch'i orada build eder ve canli `apps/web/out` altina sadece secilen bolumun dosyalarini uygular.

## Masaustu Kisayollari

```text
videowall-githuba-yukle.bat     -> VideoWallPlayer section commit/push
videowall-yayina-al.bat         -> GitHub'dan Pi'ye sadece VideoWallPlayer
hotel-githuba-yukle.bat         -> Hotel section commit/push
hotel-yayina-al.bat             -> GitHub'dan Pi'ye sadece Hotel
anasayfa-githuba-yukle.bat      -> Home section commit/push
anasayfa-yayina-al.bat          -> GitHub'dan Pi'ye sadece Home
```

## Yeni Section Ekleme Kurali

Yeni ana sayfa/link eklenecekse:

1. `apps/web/src/sections/<section-name>/` klasoru acilir.
2. `apps/web/src/app/<route>/page.tsx` sadece o section'i export eden kapi olarak yazilir.
3. `scripts/workstation/site-sections.ps1` icine commit path'leri eklenir.
4. `scripts/pi/deploy-from-github.sh` icinde section sync fonksiyonu eklenir.
5. Gerekirse masaustu icin `<section>-githuba-yukle.bat` ve `<section>-yayina-al.bat` eklenir.

## Paylasilan Dosyalar

Su dosyalar tum siteyi etkileyebilir:

```text
apps/web/src/app/layout.tsx
apps/web/src/app/globals.css
apps/web/src/app/classic.css
apps/web/package.json
package.json
package-lock.json
scripts/pi/deploy-from-github.sh
scripts/workstation/site-sections.ps1
```

Bu dosyalara dokunulduysa section deploy yerine bilincli `-Section all` tercih edilir veya degisikligin hangi section'a ait oldugu manifestte acikca tanimlanir.
