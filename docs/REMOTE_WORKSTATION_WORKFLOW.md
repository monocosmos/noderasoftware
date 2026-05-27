# Uzak Bilgisayardan Raspberry Pi Geliştirme Akışı

Bu düzende Raspberry Pi canlı sunucu ve son onaylı kaynak noktasıdır. Ev ve iş bilgisayarları geliştirme/test makinesidir.

## Bağlantı Profilleri

Her bilgisayarda SSH config içinde iki profil bulunur:

```sshconfig
Host noderapi
  HostName noderasoftware.com
  User raspberrypiserveradmin
  Port 2222

Host noderapi-sftp
  HostName noderasoftware.com
  User raspberrypiserveradmin
  Port 2222
```

`noderapi` Codex/deploy komutları içindir. `noderapi-sftp` manuel ve şifreli SFTP bağlantısı içindir.

## Günlük Çalışma Sırası

Önce Pi'deki son kaynak bilgisayara çekilir:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\Users\hfk47\Documents\noderasoftware\scripts\workstation\pull-from-pi.ps1"
```

Local geliştirme başlatılır:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\Users\hfk47\Documents\noderasoftware\scripts\workstation\start-local-dev.ps1"
```

Test adresleri:

```text
http://127.0.0.1:3000/hotel/login
http://127.0.0.1:4000/health
```

Yayına almadan önce local build alınır:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\Users\hfk47\Documents\noderasoftware\scripts\workstation\build-local.ps1"
```

Hazır build Pi'ye gönderilir:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\Users\hfk47\Documents\noderasoftware\scripts\workstation\publish-to-pi.ps1" -SkipBuild -IncludeDownloads
```

## SFTP

Şifreli manuel dosya bağlantısı:

```powershell
sftp noderapi-sftp
```

Canlı sistemi güncellemek için SFTP ile tek tek dosya atmak yerine `publish-to-pi.ps1` kullanılmalıdır.

## Çakışma Kuralı

GitHub kullanılmadığı için Pi son doğru kaynak kabul edilir. Bir bilgisayardan diğerine geçerken mutlaka önce `pull-from-pi.ps1` çalıştırılır.
