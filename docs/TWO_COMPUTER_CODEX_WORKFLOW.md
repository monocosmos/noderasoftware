# Iki Bilgisayarli Codex Gelistirme Akisi

Bu duzende GitHub zorunlu degildir. Raspberry Pi ana sunucu ve ana kaynak noktasi gibi kullanilir. Ev bilgisayari ve is bilgisayari Codex ile ayni projeyi gelistirir.

## Mantik

1. Calismaya baslamadan once Pi'deki son kaynak kodu bilgisayara cekilir.
2. Codex yerel klasorde kod degisikligi yapar.
3. Degisiklikler lokal bilgisayarda test edilir.
4. Tek hizli deploy komutuyla sadece hazir build ciktisi Pi'ye yuklenir.

## Ev Bilgisayari

Ev bilgisayari Pi ile ayni modem/ag icindeyse lokal IP kullanilir:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\Users\hfk47\Documents\noderasoftware\scripts\pi\enable-passwordless-pi.ps1" -PiHost 192.168.1.126 -PiUser raspberrypiserveradmin
```

Calismaya baslamadan once:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\Users\hfk47\Documents\noderasoftware\scripts\pi\sync-from-pi.ps1" -PiHost noderapi
```

Canli sunucuya hizli guncelleme gondermek icin:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\Users\hfk47\Documents\noderasoftware\scripts\pi\deploy-built-to-pi.ps1" -PiHost noderapi
```

## Is Bilgisayari

Is bilgisayari dis internetten baglanacagi icin modem/router tarafinda su yonlendirme gerekir:

```text
Dis port: 2222
Ic IP: 192.168.1.126
Ic port: 22
Protokol: TCP
```

Is bilgisayarinda ilk kurulum:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\Users\hfk47\Documents\noderasoftware\scripts\pi\enable-passwordless-pi.ps1" -PiHost noderasoftware.com -PiUser raspberrypiserveradmin -SshPort 2222
```

Calismaya baslamadan once:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\Users\hfk47\Documents\noderasoftware\scripts\pi\sync-from-pi.ps1" -PiHost noderapi
```

Canli sunucuya hizli guncelleme gondermek icin:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\Users\hfk47\Documents\noderasoftware\scripts\pi\deploy-built-to-pi.ps1" -PiHost noderapi
```

## Codex'e Verilecek Kisa Talimat

Codex'e bu projede su mantikla is verilebilir:

```text
Once gerekliyse Pi'deki son kaynak kodu sync-from-pi.ps1 ile cek.
Sonra istedigim degisikligi yerel projede yap ve lokal test et.
Sonra deploy-built-to-pi.ps1 ile sadece hazir build ciktisini Raspberry Pi'ye yukle.
En sonda https://noderasoftware.com/api/health ve https://noderasoftware.com/hotel/ kontrolu yap.
```

## Dikkat Edilecek Nokta

Ayni anda iki bilgisayarda farkli degisiklik yapilmasin. GitHub kullanmadigimiz icin otomatik merge sistemi yoktur. En saglam akis:

```text
Bilgisayar A isi bitirir -> deploy eder
Bilgisayar B ise baslamadan once sync-from-pi calistirir
```

`sync-from-pi.ps1` her cekme isleminden once yerel kaynak kodun yedegini `_local-backups` klasorune alir. Boylece yanlislikla eski bir dosya ezilirse geri donus sansi vardir.

## Hangi Deploy Ne Zaman Kullanilir?

Gunluk gelistirme icin:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\Users\hfk47\Documents\noderasoftware\scripts\pi\deploy-built-to-pi.ps1" -PiHost noderapi
```

Bu komut build'i Windows bilgisayarinda alir. Pi'ye sadece `apps/web/out` ve `apps/api/dist` gonderilir. Raspberry Pi daha az yorulur.

Uygulama indirme dosyalari APK/EXE degistiyse:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\Users\hfk47\Documents\noderasoftware\scripts\pi\deploy-built-to-pi.ps1" -PiHost noderapi -IncludeDownloads
```

Normal deploy bu buyuk dosyalari tekrar tekrar gondermez.

Sadece paket/dependency degistiyse:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\Users\hfk47\Documents\noderasoftware\scripts\pi\deploy-built-to-pi.ps1" -PiHost noderapi -InstallDependencies
```

Veritabani semasi degistiyse:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\Users\hfk47\Documents\noderasoftware\scripts\pi\deploy-built-to-pi.ps1" -PiHost noderapi -PushDatabaseSchema
```

Tam kurulum veya Pi'yi bastan hazirlama icin eski `deploy-to-pi.ps1` kullanilir. Gunluk gelistirmede gerekmez.
