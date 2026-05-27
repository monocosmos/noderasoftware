# Raspberry Pi Deployment

Bu dokuman, mevcut Node.js tabanli Noderasoftware/HotelOps projesini Raspberry Pi 4 uzerinde calistirmak icin hazirlandi.

## Hedef Mimari

- Raspberry Pi OS 64-bit
- Nginx: statik web arayuzu ve ters proxy
- Node.js API: `hotelops-api` systemd servisi
- PostgreSQL: lokal veritabani
- Proje klasoru: `/opt/noderasoftware`
- Web cikti klasoru: `/opt/noderasoftware/apps/web/out`
- API portu: `127.0.0.1:4000`
- Windows/Codex yonetim makinesi: SSH/SCP/SFTP ile Pi'ye komut ve dosya gonderir
- Guvenli dosya duzenleme: klasik FTP yerine SFTP, port `22`
- HTTPS: Nginx + Certbot + Let's Encrypt

## 1. Tek Komutla Windows'tan Pi'ye Deploy

Pi'nin IP adresini biliyorsaniz Windows makineden tek komutla kaynak kodu kopyalayip kurulumu baslatabilirsiniz:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\Users\hfk47\Documents\noderasoftware\scripts\pi\deploy-to-pi.ps1" -PiHost RASPBERRY_PI_IP -PiUser pi
```

Mevcut Windows veritabanini da yedekleyip Pi'ye geri yuklemek icin:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\Users\hfk47\Documents\noderasoftware\scripts\pi\deploy-to-pi.ps1" -PiHost RASPBERRY_PI_IP -PiUser pi -ExportDatabase -RestoreDatabase
```

SFTP edit kullanicisini de kurmak icin:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\Users\hfk47\Documents\noderasoftware\scripts\pi\deploy-to-pi.ps1" -PiHost RASPBERRY_PI_IP -PiUser pi -ExportDatabase -RestoreDatabase -SetupSftp
```

Domain DNS'i Pi'ye yonlendikten sonra SSL dahil kurmak icin:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\Users\hfk47\Documents\noderasoftware\scripts\pi\deploy-to-pi.ps1" -PiHost RASPBERRY_PI_IP -PiUser pi -ExportDatabase -RestoreDatabase -SetupSftp -SetupSsl -Domain noderasoftware.com -Email info@noderasoftware.com
```

## 2. Windows'tan Komut Satiri ile Pi'ye Mudahale

Sifre sormayan SSH ve sudo kurulumu:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\Users\hfk47\Documents\noderasoftware\scripts\pi\enable-passwordless-pi.ps1"
```

Bu komut ilk calismada Pi sifresini bir kez ister. Sonra Windows icin `noderapi` SSH kisayolunu olusturur.

Kisa kullanim:

```powershell
ssh noderapi
ssh noderapi "sudo systemctl status hotelops-api"
scp "C:\path\file.txt" noderapi:/home/raspberrypiserveradmin/Desktop/
```

Interaktif SSH oturumu:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\Users\hfk47\Documents\noderasoftware\scripts\pi\connect-pi.ps1" -PiHost RASPBERRY_PI_IP -PiUser pi
```

Tek komut calistirma:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\Users\hfk47\Documents\noderasoftware\scripts\pi\connect-pi.ps1" -PiHost RASPBERRY_PI_IP -PiUser pi -Command "systemctl status hotelops-api"
```

Sunucu durum ozeti:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\Users\hfk47\Documents\noderasoftware\scripts\pi\pi-status.ps1" -PiHost RASPBERRY_PI_IP -PiUser pi
```

Bu komutlar sayesinde Codex bu Windows bilgisayardan Raspberry Pi'ye SSH ile mudahale edebilir.

## 3. FTP Gibi Duzenleme

Guvenlik nedeniyle klasik FTP yerine SFTP kullanilir. FileZilla veya WinSCP tarafinda kullanim FTP'ye cok benzer:

```text
Protocol: SFTP
Host: RASPBERRY_PI_IP veya noderasoftware.com
Port: 22
User: webedit
Password: setup-sftp-editor.sh ciktisinda yazan sifre
Remote path: /opt/noderasoftware/apps/web/out
```

SFTP kullanicisini kurmak icin Pi uzerinde:

```bash
cd /opt/noderasoftware
sudo bash scripts/pi/setup-sftp-editor.sh
```

Ya da Windows'tan deploy scriptiyle:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\Users\hfk47\Documents\noderasoftware\scripts\pi\deploy-to-pi.ps1" -PiHost RASPBERRY_PI_IP -PiUser pi -SetupSftp
```

Onemli not: `/opt/noderasoftware/apps/web/out` klasoru Next.js'in uretilmis statik cikti klasorudur. Burada yapilan manuel FTP/SFTP duzenlemeleri yeni build/deploy sonrasinda ezilebilir. Kalici kod degisikligi icin kaynak kod Git/Codex akisiyle degistirilmeli, hizli statik dokunuslar icin SFTP kullanilmalidir.

## 4. Manuel Kaynak Paketi Olusturma

Windows makinede:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\Users\hfk47\Documents\noderasoftware\scripts\pi\package-for-pi.ps1"
```

Bu komut sunu uretir:

```text
C:\Users\hfk47\Documents\noderasoftware\noderasoftware-pi-source.zip
```

Bu paket sadece Git tarafindaki temiz kaynak dosyalarini icerir. `node_modules`, build ciktilari, loglar, mac artifact dosyalari ve Android inceleme klasoru pakete girmez.

## 5. Paketi Raspberry Pi'ye Kopyala

PowerShell'den:

```powershell
scp "C:\Users\hfk47\Documents\noderasoftware\noderasoftware-pi-source.zip" pi@RASPBERRY_PI_IP:/tmp/
```

`RASPBERRY_PI_IP` yerine Pi'nin lokal IP adresini yazin.

Alternatif olarak WinSCP ile SFTP kullanip dosyayi `/tmp/` klasorune surukleyebilirsiniz.

## 6. Mevcut Veritabani Yedegini Al

Windows makinedeki mevcut PostgreSQL verisini de tasimak icin:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\Users\hfk47\Documents\noderasoftware\scripts\pi\export-current-db.ps1"
```

Bu komut `db-backups` klasorunde `.dump` uzantili bir PostgreSQL yedegi olusturur.

Pi'ye kopyalama ornegi:

```powershell
scp "C:\Users\hfk47\Documents\noderasoftware\db-backups\hotelops-TARIH.dump" pi@RASPBERRY_PI_IP:/tmp/
```

## 7. Raspberry Pi'de Dosyalari Ac

Pi'ye SSH ile baglanin:

```bash
ssh pi@RASPBERRY_PI_IP
```

Sonra:

```bash
sudo mkdir -p /opt/noderasoftware
sudo unzip -o /tmp/noderasoftware-pi-source.zip -d /opt/noderasoftware
cd /opt/noderasoftware
```

## 8. Kurulumu Calistir

```bash
sudo bash scripts/pi/setup-raspberry-pi.sh
```

Script sunlari yapar:

- Node.js 22 kurar veya mevcut surumu kontrol eder.
- Nginx kurar.
- PostgreSQL kurar.
- `hotelops` veritabani ve kullanicisini hazirlar.
- `.env` dosyasi olusturur.
- Sadece web ve api Node bagimliliklarini kurar; Electron desktop build paketleri Pi'ye kurulmaz.
- Prisma client uretir.
- Veritabani semasini uygular.
- Baslangic verilerini seed eder.
- API ve web build alir.
- `hotelops-api` systemd servisini kurar.
- Nginx'i `/api`, `/socket.io` ve statik web icin ayarlar.

## 9. Mevcut Veritabani Yedegini Geri Yukle

Windows'tan aldiginiz dump dosyasini Pi'ye kopyaladiysaniz:

```bash
cd /opt/noderasoftware
sudo bash scripts/pi/restore-postgres-dump.sh /tmp/hotelops-TARIH.dump
```

Bu komut API servisini gecici olarak durdurur, dump dosyasini PostgreSQL'e geri yukler, Prisma client'i yeniler ve API servisini tekrar baslatir.

## 10. Kontrol Komutlari

API saglik kontrolu:

```bash
curl http://127.0.0.1:4000/health
```

Servis durumu:

```bash
systemctl status hotelops-api
systemctl status nginx
systemctl status postgresql
```

Log izleme:

```bash
journalctl -u hotelops-api -f
```

## 11. Siteyi Ac

Tarayicidan:

```text
http://RASPBERRY_PI_IP/
http://RASPBERRY_PI_IP/hotel/
```

Varsayilan demo girisi:

```text
Kullanici: admin
Sifre: Admin123!
```

## 12. Domain ve SSL

Domaini Pi'ye yonlendirecekseniz:

- Modem/router uzerinden 80 ve 443 portlarini Pi IP adresine yonlendirin.
- Pi'ye sabit lokal IP verin.
- DNS A kaydini statik genel IP adresinize yonlendirin.
- HTTPS icin Pi uzerinde Certbot kullanin.

Hazir script:

```bash
cd /opt/noderasoftware
sudo bash scripts/pi/setup-ssl-certbot.sh noderasoftware.com info@noderasoftware.com
```

Bu script:

- Nginx `server_name` degerini `noderasoftware.com www.noderasoftware.com` yapar.
- Certbot ve Nginx eklentisini kurar.
- Let's Encrypt sertifikasini alir.
- HTTP isteklerini HTTPS'e yonlendirir.
- `.env` icindeki `WEB_ORIGIN` degerini `https://noderasoftware.com` yapar.
- API servisini yeniden baslatir.

## 13. Guncelleme Akisi

Windows'ta yeni zip olusturun, Pi'ye kopyalayin, sonra Pi'de:

```bash
sudo unzip -o /tmp/noderasoftware-pi-source.zip -d /opt/noderasoftware
cd /opt/noderasoftware
sudo bash scripts/pi/setup-raspberry-pi.sh
```

Kurulum scripti mevcut veritabanini silmez. Prisma semasini uygular ve seed verilerini upsert mantigiyla gunceller.

## 14. Iki Bilgisayarli Codex Akisi

Ev bilgisayari ve is bilgisayari ayni Raspberry Pi sunucusunu gelistirecekse `docs/TWO_COMPUTER_CODEX_WORKFLOW.md` dokumanini kullanin.

Temel akis:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\Users\hfk47\Documents\noderasoftware\scripts\pi\sync-from-pi.ps1" -PiHost noderapi
```

Sonra degisiklik yapilir ve canli Pi sunucusuna hizli deploy edilir:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\Users\hfk47\Documents\noderasoftware\scripts\pi\deploy-built-to-pi.ps1" -PiHost noderapi
```

Bu hizli deploy build islemini Windows bilgisayarinda yapar. Raspberry Pi'ye sadece hazir `apps/web/out` ve `apps/api/dist` ciktisi gonderilir.

APK/Windows indirme dosyalari ilk kez yuklenecekse veya degistiyse:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\Users\hfk47\Documents\noderasoftware\scripts\pi\deploy-built-to-pi.ps1" -PiHost noderapi -IncludeDownloads
```
