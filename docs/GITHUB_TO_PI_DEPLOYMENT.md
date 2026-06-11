# GitHub to Raspberry Pi Deployment

Bu proje icin yeni ana mimari:

```text
Windows bilgisayar = gelistirme, test, commit, push
GitHub = tek kaynak kaydi
Raspberry Pi = GitHub'dan cekip canliya alan yayin sunucusu
```

Kalici bir degisiklik artik Raspberry Pi'de elle duzenlenmez. Once yerel bilgisayarda yapilir, test edilir, GitHub'a push edilir, sonra Pi GitHub'dan deploy eder.

## 1. Tek Local Proje Kuralı

Bu bilgisayardaki tek aktif proje klasoru:

```text
C:\Users\hfk47\Documents\noderasoftware\github-sync
```

`remote-src` klasoru artik kaynak proje olarak kullanilmaz. Eski kopya/arsiv olarak dusunulmeli; kalici degisiklik sadece `github-sync` icinde yapilir.

Local proje ile GitHub durumunu kontrol etmek icin:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\workstation\sync-local-with-github.ps1 -StatusOnly
```

Local degisikligi build edip GitHub'a yuklemek icin:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\workstation\publish-local-to-github.ps1 -Message "chore: sync local project"
```

## 2. Windows Bilgisayarda Calisma

Ilk gereksinim: Windows'ta Git kurulu ve PATH icinde olmali.

```powershell
git --version
```

Bu komut calismiyorsa Git for Windows kurulur ve yeni PowerShell penceresi acilir.

Standart is akisi:

```powershell
cd C:\Users\hfk47\Documents\noderasoftware\github-sync
git switch master
git pull --ff-only origin master
git switch -c feature/kisa-is-adi

# Kod degisikligi yapilir.

npm.cmd run build --workspace @hotel-ops/web
npm.cmd run build --workspace @hotel-ops/api

git status --short
git add .
git commit -m "fix: kisa aciklama"
git push -u origin feature/kisa-is-adi
```

Degisiklik dogrudan `master` dalina alindiktan sonra Pi deploy edilir. Pull request kullaniliyorsa once PR merge edilir.

## 3. Raspberry Pi Ilk Kurulum

Pi'de proje klasoru Git deposu olarak klonlanmali:

```bash
sudo apt-get update
sudo apt-get install -y git
sudo rm -rf /opt/noderasoftware
sudo git clone --branch master https://github.com/OWNER/REPO.git /opt/noderasoftware
cd /opt/noderasoftware
sudo bash scripts/pi/setup-raspberry-pi.sh
```

Ozel repo kullaniliyorsa Pi'ye deploy key veya GitHub tokenli HTTPS erisimi verilir. Gizli anahtarlar `.env` icine veya GitHub'a yazilmaz.

## 4. Raspberry Pi Guncelleme

Pi uzerinde:

```bash
cd /opt/noderasoftware
sudo BRANCH=master bash scripts/pi/deploy-from-github.sh
```

Windows bilgisayardan SSH kisayolu varsa:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\workstation\deploy-pi-from-github.ps1
```

Farkli dal deploy etmek icin:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\workstation\deploy-pi-from-github.ps1 -Branch feature/kisa-is-adi
```

## 5. Deploy Scriptinin Yaptiklari

`scripts/pi/deploy-from-github.sh` sirayla:

- GitHub'dan hedef dali fetch eder.
- Canli klasoru `origin/<branch>` durumuna getirir.
- `.env`, `node_modules`, mevcut build ciktilari ve indirme dosyalarini korur.
- API ve web bagimliliklarini `npm ci` ile kurar.
- Prisma client uretir.
- Veritabani semasini `prisma db push` ile uygular.
- API ve web build alir.
- `hotelops-api` systemd servisini restart eder.
- Nginx config testini yapar ve Nginx'i reload eder.
- `http://127.0.0.1:4000/health` ile canli saglik kontrolu yapar.

## 6. Kurallar

- GitHub'a push edilmeyen degisiklik Pi'ye deploy edilmez.
- Pi uzerindeki `.env` canli sirlarin tek yeridir ve repoya girmez.
- Veritabani yedegi gereken riskli islerde deploy oncesi dump alinir.
- CI basarisizsa merge/deploy yapilmaz.
- Pi'de elle yapilan acil duzeltme kalici sayilmaz; ayni degisiklik hemen GitHub'a islenir.

## 7. Hedef Akis

```text
Kod degisikligi
  -> yerel build/test
  -> commit
  -> GitHub push
  -> CI build
  -> merge/master
  -> Pi: deploy-from-github.sh
  -> health check
```
