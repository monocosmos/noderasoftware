# Codex Project Handoff

Bu dosya, yeni bir laptopta Codex ile projeye devam ederken okunacak proje hafizasidir.
Amac: sadece kodu degil, bu projede alinan kararlar, tekrar edilmemesi gereken hatalar ve
calisma duzenini de yeni oturuma tasimak.

## Proje Kimligi

- Proje adi: Nodera Software / HotelOps
- Repo: https://github.com/monocosmos/noderasoftware
- Ana lokal klasor: `C:\Users\hfk47\Documents\noderasoftware`
- Canli site: `https://noderasoftware.com/`
- HotelOps giris: `https://noderasoftware.com/hotel/`
- Raspberry Pi SSH alias: `noderapi`
- Raspberry Pi SFTP alias: `noderapi-sftp`
- Raspberry Pi kullanici adi: `raspberrypiserveradmin`
- Raspberry Pi canli dizin: `/opt/noderasoftware`

## Bu Dosya Neyi Tasir, Neyi Tasimaz

Yeni laptopta eski Codex sohbet ekrani birebir gorunmez. ChatGPT/Codex arayuzundeki
mesaj gecmisi otomatik olarak baska makineye kopyalanmaz.

Bu dosyanin amaci, o sohbetten cikan operasyon hafizasini tasimaktir:

- hangi klasorde calisildigi
- hangi mimari kararlarin alindigi
- Raspberry Pi'ye hangi porttan baglanildigi
- deploy komutlarinin ne oldugu
- desktop/Android tarafinda tekrar bozulmamasi gereken kararlar
- yeni Codex oturumunun once hangi dosyalari okuyacagi

Yani yeni laptopta Codex once bu dosyayi okursa, "bastan kesfetme" yerine mevcut
duzeni devam ettirebilir.

Guvenlik nedeniyle GitHub'a veya public dokumana su bilgiler yazilmaz:

- Raspberry Pi sifresi
- private SSH key dosyasi
- database sifreleri
- production `.env` sirlarini acik metin olarak iceren notlar

Bu bilgiler yeni laptopta yerel olarak kurulmalidir. Public repo'da sadece nasil
baglanilacagi ve hangi profil isimlerinin kullanilacagi bulunur.

## Ana Teknoloji

- Monorepo
- Web: Next.js, TypeScript
- API: Node.js
- DB: PostgreSQL + Prisma
- Desktop: Electron
- Android: WebView mantiginda uygulama
- Deploy hedefi: Raspberry Pi + nginx + HTTPS

## Yeni Laptopta Ilk Is

Bu projede GitHub zorunlu degildir. Kullanici projeyi offline paket olarak
tasimayi tercih edebilir.

GitHub kullanilmayan ana akis:

1. `noderasoftware-offline-handoff-*.zip` dosyasini yeni laptopa tasi.
2. ZIP'i `C:\Users\<kullanici>\Documents\noderasoftware` gibi bir klasore ac.
3. Klasorde `PROJE_BASLAT.bat` calistir.
4. Yeni Codex oturumunda once bu dosyayi, sonra private handoff dosyasini okut.

Offline pakette bulunmasi gereken ozel dosyalar:

```text
docs/CODEX_PRIVATE_HANDOFF.local.md
secrets/noderasoftware_pi_ed25519
secrets/noderasoftware_pi_ed25519.pub
```

Bu dosyalar GitHub'a gitmez. Sadece sahibinin kendi tasidigi pakette bulunur.

GitHub klonu da mumkundur ama GitHub buyuk binary indirme dosyalarini ve private
baglanti bilgilerini tasimaz.
Ilk geciste offline proje arsivi daha pratiktir.

1. Arsivi indir ve ac:

```text
https://noderasoftware.com/downloads/noderasoftware-project-20260523-192330-76512c9fde.rar
```

2. Klasor:

```text
C:\Users\<kullanici>\Documents\noderasoftware
```

3. Bagimliliklari kur:

```powershell
npm ci
```

4. Web local:

```powershell
npm run dev
```

5. API local:

```powershell
npm run api:dev
```

6. Desktop build:

```powershell
npm run desktop:dist
```

7. Raspberry Pi SSH profillerini kur:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\Users\<kullanici>\Documents\noderasoftware\scripts\workstation\setup-noderapi-ssh.ps1"
```

Bu script su profilleri olusturur:

```text
noderapi      -> Codex/deploy icin SSH profili
noderapi-sftp -> manuel SFTP icin sifreli profil
```

Tam otomatik deploy icin yeni laptopta su private key bulunmalidir:

```text
C:\Users\<kullanici>\.ssh\noderasoftware_pi_ed25519
```

Bu key yoksa SSH/SFTP parola ister. Codex ancak yeni laptopta SSH profili ve
kimlik bilgisi hazirsa Pi'ye kendi kendine baglanabilir.

8. Baglanti kontrolu:

```powershell
ssh noderapi "hostname; systemctl is-active hotelops-api nginx postgresql; curl -fsS http://127.0.0.1:4000/health"
```

## Codex Icin Ilk Okunacak Dosyalar

Yeni Codex oturumunda su dosyalari once okut:

```text
docs/CODEX_PROJECT_HANDOFF.md
docs/DESKTOP_REGRESSION_GUARDRAILS.md
docs/REMOTE_WORKSTATION_WORKFLOW.md
docs/TWO_COMPUTER_CODEX_WORKFLOW.md
docs/RASPBERRY_PI_DEPLOYMENT.md
```

Kullanici yeni Codex oturumunda su cumleyi yazabilir:

```text
Bu projede once docs/CODEX_PROJECT_HANDOFF.md dosyasini oku.
Ardindan desktop guardrail ve Raspberry Pi deploy dokumanlarini oku.
Eski kararlarimizi bozmadan devam et.
```

## Kritik Kararlar

### 1. `/` ve `/hotel/` ayrimi

- `https://noderasoftware.com/` kisisel tanitim sitesidir.
- `https://noderasoftware.com/hotel/` HotelOps uygulamasidir.
- Bu iki rota tekrar ayni sayfaya dusurulmemeli.

### 2. Download linkleri

Web tarayicidan giren kullanici download alanlarini gormelidir.
Windows desktop uygulama ve Android APK icinden girildiginde download alanlari gizlenmelidir.

Saklanacak dosyalar:

```text
apps/web/public/downloads/HotelOps-Android-V1.apk
apps/web/public/downloads/HotelOps-Setup-V1-x64.exe
apps/web/public/downloads/HotelOps-Portable-V1-x64.exe
```

Bu dosyalar GitHub'a koyulmaz, ama RAR paketinde ve Raspberry Pi'de bulunur.

### 3. Desktop pencere butonlari

Bu konu cok kez degisti. Son karar:

- Pencere butonlari child-window degil.
- Electron `titleBarOverlay` varsayilan degil.
- Butonlar `desktop-inject.js` ile ana webview icine custom caption olarak eklenir.
- Sag ustte sifira sifir oturur.
- Minimize/maximize hover gri arka plan verir.
- Close hover kirmizi arka plan verir.
- Native tooltip tasmasi olmamali.

Degisiklik yapmadan once mutlaka oku:

```text
docs/DESKTOP_REGRESSION_GUARDRAILS.md
```

Desktop degisikliginden sonra zorunlu kontroller:

```powershell
node --check apps\desktop\src\main.cjs
node --check apps\desktop\src\preload.cjs
node --check apps\desktop\src\desktop-inject.js
npm run desktop:dist
npm run desktop:test-window-controls
```

### 4. Tray ve bildirimler

- Windows tray ikonu transparan olmalidir.
- Tray ikonu: `apps/desktop/src/tray-icon.png`
- Marka logosu: `apps/desktop/src/brand-logo.png`
- Bu iki ikon ayni sey degildir.
- `HotelOps arka planda calismaya devam ediyor` bildirimi istenmiyor.
- Sadece gercek HotelOps is/operasyon bildirimleri Windows bildirimi olarak gelmeli.

### 5. Raspberry Pi deploy

Temiz veya yeni laptopta once bagimlilik ve build hazirlanir:

```powershell
npm ci
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\Users\hfk47\Documents\noderasoftware\scripts\workstation\build-local.ps1"
```

Normal deploy, hazir build ciktisini Pi'ye atar:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\Users\hfk47\Documents\noderasoftware\scripts\workstation\publish-to-pi.ps1" -SkipBuild -IncludeDownloads
```

`-SkipBuild`, `apps/api/dist` ve `apps/web/out` zaten varsa kullanilmalidir.
Bu klasorler temizlikte silindiyse once `build-local.ps1` calistirilir.

Kontrol:

```powershell
ssh noderapi "systemctl is-active hotelops-api nginx postgresql; curl -fsS http://127.0.0.1:4000/health; sudo nginx -t"
```

Download dosyalari deploy edilirken `-IncludeDownloads` unutulmamali.

Kullanici "siteyi Raspberry Pi'ye at", "deployla", "raspiye guncelle" dediginde
Codex'in varsayilan davranisi:

1. Lokal degisiklikleri kontrol et:

```powershell
git status --short
```

2. Gerekliyse build/test calistir.

Temiz makinede veya `apps/api/dist` / `apps/web/out` yoksa:

```powershell
npm ci
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\Users\hfk47\Documents\noderasoftware\scripts\workstation\build-local.ps1"
```

3. Pi'ye yayinla:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\Users\hfk47\Documents\noderasoftware\scripts\workstation\publish-to-pi.ps1" -SkipBuild -IncludeDownloads
```

4. Pi saglik kontrolu yap:

```powershell
ssh noderapi "systemctl is-active hotelops-api nginx postgresql; curl -fsS http://127.0.0.1:4000/health; sudo nginx -t"
```

5. Gerekirse public HTTP/HTTPS kontrolu yap:

```powershell
curl.exe -I https://noderasoftware.com/
curl.exe -I https://noderasoftware.com/hotel/
```

Deploy script bazen sonda `curl: (7) Failed to connect to 127.0.0.1 port 4000`
benzeri gecici bir mesaj basabilir. Bu tek basina karar verdirmez. Son karar
ayri saglik kontrolu ile verilir.

### 5.1 Raspberry Pi port haritasi

Dis dunya / modem tarafindan beklenen portlar:

- `443/tcp`: HTTPS public site, nginx
- `80/tcp`: HTTP redirect ve Let's Encrypt/Certbot islemleri, nginx
- `2222/tcp`: uzaktan SSH/SFTP girisi; modem tarafinda Pi'nin `22/tcp` portuna yonlenir

Raspberry Pi icinde kullanilan portlar:

- `22/tcp`: OpenSSH server
- `4000/tcp`: HotelOps API, nginx arkasinda local servis
- `5432/tcp`: PostgreSQL, mumkunse local/ag-ici erisimle sinirli tutulur

Gelistirme bilgisayarinda kullanilan portlar:

- `3000/tcp`: local Next.js web
- `4000/tcp`: local API health/test

Public kullanici normalde `4000`, `5432` veya `3000` portlarina direkt gelmemelidir.
Disaridan erisim HTTPS uzerinden nginx ile yapilmalidir.

### 5.2 Raspberry Pi servisleri

Canli sistemde beklenen ana servisler:

```text
hotelops-api
nginx
postgresql
ssh
```

Kontrol:

```powershell
ssh noderapi "systemctl is-active hotelops-api nginx postgresql ssh"
```

Reboot sonrasi sistemin kendi kendine kalkmasi icin bu servisler enabled olmalidir:

```powershell
ssh noderapi "systemctl is-enabled hotelops-api nginx postgresql ssh"
```

### 5.3 FTP/SFTP calisma kurali

Bu projede klasik FTP yerine SSH tabanli SFTP tercih edilir.

Manuel SFTP:

```powershell
sftp noderapi-sftp
```

Ancak canli siteyi tek tek dosya atarak guncellemek yerine normalde
`publish-to-pi.ps1` kullanilmalidir. Bu script kaynak paketini hazirlar, Pi'ye
gonderir, gerekli yerlere acar ve servisleri yeniden yukler.

### 6. Temizlik karari

Silinmesi guvenli uretilmis dosyalar:

- `node_modules`
- `.next`
- `out`
- `apps/api/dist`
- `apps/desktop/release`
- log dosyalari
- cache klasorleri
- test screenshotlari

Silinmemesi gerekenler:

- kaynak kod
- `.env`
- `apps/web/public/downloads`
- `prisma`
- `scripts`
- `docs`
- `package-lock.json`
- `db-backups`

`apps/desktop/release` build ciktisidir. Gerektiginde yeniden uretilir:

```powershell
npm ci
npm run desktop:dist
```

## Son Bilinen Temiz Durum

- GitHub branch: `master`
- Son bilinen commit icin `git log -1 --oneline` kontrol edilmelidir.
- Proje temizlendi.
- Kaynak + dokuman + script kismi yaklasik 4 MB.
- Download paketleri dahil proje yaklasik 197 MB.
- Raspberry Pi canli servisleri aktifti:
  - `hotelops-api`
  - `nginx`
  - `postgresql`
- API health sonucu temizdi.

## Yeni Codex Oturumuna Verilecek Kisa Prompt

```text
Bu proje Nodera Software / HotelOps projesi.
Once docs/CODEX_PROJECT_HANDOFF.md dosyasini oku.
Sonra docs/DESKTOP_REGRESSION_GUARDRAILS.md ve docs/RASPBERRY_PI_DEPLOYMENT.md dosyalarini oku.
Projede daha once desktop pencere butonlari, tray icon, download gizleme, Raspberry Pi deploy ve /hotel rota ayrimi konusunda cok karar aldik.
Bu kararlari bozmadan devam et.
```
