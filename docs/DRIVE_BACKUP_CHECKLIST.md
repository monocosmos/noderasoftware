# Google Drive Backup Checklist

Bu dokuman, `scripts/pi/daily-drive-backup.sh` scriptinin Google Drive'a gonderdigi gunluk yedegin icinde neler oldugunu tek bakista gormek icin hazirlandi.

## Drive Klasor Duzeni

Yedekler artik tek bir ay klasorune yigilmiyor. Her gun ayri klasorde tutuluyor:

```text
HotelOpsBackups/
  <otel-adi>/
    2026/
      06-Haziran/
        2026-06-11/
          hotelops-backup-<otel-adi>-2026-06-11.zip
          hotelops-backup-<otel-adi>-2026-06-11.zip.sha256
          manifest.env
          manifest.json
          checklist.txt
          checklist.json
          summary.txt
```

Bu yapi sayesinde:

- Drive uzerinde tarih bazli gezinmek kolaylasir.
- Zip indirmeden once icerik `manifest.json` ve `checklist.txt` ile incelenebilir.
- Checksum dosyasi ile dogrulama yapilabilir.
- Her gunun yedegi tek klasorde toplu halde durur.

## Yedek Icerik Checklist

- [x] PostgreSQL custom-format veritabani dump'i: `db/hotelops-YYYY-MM-DD.dump`
- [x] Gunluk olay raporu CSV: `reports/gunluk-olay-raporu.csv`
- [x] Gunluk olay raporu TXT: `reports/gunluk-olay-raporu.txt`
- [x] Gunluk islem ozeti: `reports/gunluk-ozet.txt`
- [x] `hotelops-api` systemd loglari: `logs/hotelops-api.journal.log`
- [x] `nginx` systemd loglari: `logs/nginx.journal.log`
- [x] `postgresql` systemd loglari: `logs/postgresql.journal.log`
- [x] Gunluk nginx access loglari: `logs/nginx-access-YYYY-MM-DD.log`
- [x] Gunluk nginx error loglari: `logs/nginx-error-YYYY-MM-DD.log`
- [x] Web surum manifesleri: `manifests/app-version.json`, `manifests/web-build.json`
- [x] Duz metin manifest: `metadata/manifest.env`
- [x] JSON manifest: `metadata/manifest.json`
- [x] Duz metin checklist: `metadata/checklist.txt`
- [x] JSON checklist: `metadata/checklist.json`

## Hizli Inceleme Akisi

1. Ilgili gun klasorunu acin.
2. Once `summary.txt` dosyasina bakin.
3. Ayrintilar icin `manifest.json` veya `checklist.txt` acin.
4. Arsivin butunlugunu kontrol etmek icin `.sha256` dosyasini kullanin.
5. Gerekiyorsa en son `zip` dosyasini indirip acin.

## Not

Bu yedek sistemi kaynak kodu degil, operasyonel gunluk veriyi ve o gunun inceleme materyallerini hedefler. Kaynak kodun kalici gecmisi hala GitHub uzerinde tutulmalidir.
