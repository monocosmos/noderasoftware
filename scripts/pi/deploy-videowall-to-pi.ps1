param(
  [string] $PiHost = "noderapi",
  [string] $PiUser = "raspberrypiserveradmin",
  [int] $SshPort = 0,
  [switch] $SkipBuild,
  [switch] $SkipImport,
  [switch] $SkipLocalPiBackup
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$root = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$stage = Join-Path $env:TEMP "noderasoftware-videowall-$timestamp"
$archive = Join-Path $env:TEMP "noderasoftware-videowall-$timestamp.tgz"
$remoteArchive = "/tmp/noderasoftware-videowall-$timestamp.tgz"
$remoteStage = "/tmp/noderasoftware-videowall-$timestamp"
$backupRoot = Join-Path $root "_local-backups\pi-deploy"
$localBackupArchive = Join-Path $backupRoot "before-videowall-deploy-$timestamp.tgz"
$remoteBackupArchive = "/tmp/noderasoftware-videowall-backup-$timestamp.tgz"

$sshPortArgs = @()
$scpPortArgs = @()
if ($SshPort -gt 0) {
  $sshPortArgs = @("-p", "$SshPort")
  $scpPortArgs = @("-P", "$SshPort")
}

function Copy-RequiredItem {
  param(
    [Parameter(Mandatory = $true)]
    [string] $From,

    [Parameter(Mandatory = $true)]
    [string] $To
  )

  if (-not (Test-Path -LiteralPath $From)) {
    throw "Gerekli dosya/klasor bulunamadi: $From"
  }

  $parent = Split-Path -Parent $To
  New-Item -ItemType Directory -Path $parent -Force | Out-Null
  Copy-Item -LiteralPath $From -Destination $To -Recurse -Force
}

function Assert-RequiredFile {
  param(
    [Parameter(Mandatory = $true)]
    [string] $Path
  )

  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
    throw "Gerekli dosya eksik: $Path"
  }

  $item = Get-Item -LiteralPath $Path
  if ($item.Length -le 0) {
    throw "Gerekli dosya bos: $Path"
  }
}

function Invoke-RemoteCommand {
  param(
    [Parameter(Mandatory = $true)]
    [string] $Command
  )

  ssh @sshPortArgs "${PiUser}@${PiHost}" $Command
  if ($LASTEXITCODE -ne 0) {
    throw "Uzak komut basarisiz oldu. Exit code: $LASTEXITCODE"
  }
}

try {
  if (-not $SkipImport) {
    Write-Host "==> VideoWallPlayer release dosyalari siteye isleniyor" -ForegroundColor Cyan
    powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $root "scripts\workstation\import-videowall-release.ps1")
    if ($LASTEXITCODE -ne 0) {
      throw "VideoWallPlayer release import basarisiz oldu."
    }
  }

  if (-not $SkipBuild) {
    Write-Host "==> Lokal web build/export aliniyor" -ForegroundColor Cyan
    npm.cmd run build --workspace @hotel-ops/web
    if ($LASTEXITCODE -ne 0) {
      throw "Web build basarisiz oldu."
    }
  }

  $requiredRoutes = @(
    "apps\web\out\videowallplayer\index.html",
    "apps\web\out\brand\videowallplayer\brand-logo.png",
    "apps\web\out\brand\videowallplayer\brand-model.png"
  )
  foreach ($route in $requiredRoutes) {
    Assert-RequiredFile -Path (Join-Path $root $route)
  }

  $requiredDownloads = @(
    "VideoWallPlayer-Windows-Setup-x64.exe",
    "VideoWallPlayer-Windows-Portable-x64.zip",
    "VideoWallPlayer-Android.apk"
  )
  foreach ($download in $requiredDownloads) {
    Assert-RequiredFile -Path (Join-Path $root "apps\web\public\downloads\$download")
  }

  if (Test-Path -LiteralPath $stage) {
    Remove-Item -LiteralPath $stage -Recurse -Force
  }
  if (Test-Path -LiteralPath $archive) {
    Remove-Item -LiteralPath $archive -Force
  }
  New-Item -ItemType Directory -Path $stage -Force | Out-Null

  Write-Host "==> VideoWallPlayer dar kapsamli paket hazirlaniyor" -ForegroundColor Cyan
  Copy-RequiredItem -From (Join-Path $root "apps\web\out\videowallplayer") -To (Join-Path $stage "apps\web\out\videowallplayer")
  Copy-RequiredItem -From (Join-Path $root "apps\web\out\brand\videowallplayer") -To (Join-Path $stage "apps\web\out\brand\videowallplayer")
  Copy-RequiredItem -From (Join-Path $root "apps\web\out\_next\static") -To (Join-Path $stage "apps\web\out\_next\static")

  foreach ($download in $requiredDownloads) {
    Copy-RequiredItem -From (Join-Path $root "apps\web\public\downloads\$download") -To (Join-Path $stage "apps\web\public\downloads\$download")
  }

  & tar.exe -czf "$archive" -C "$stage" .
  if ($LASTEXITCODE -ne 0) {
    throw "VideoWallPlayer tar paketi olusturulamadi. Exit code: $LASTEXITCODE"
  }

  if (-not $SkipLocalPiBackup) {
    Write-Host "==> Pi'deki mevcut VideoWallPlayer alanlari yedekleniyor" -ForegroundColor Cyan
    New-Item -ItemType Directory -Path $backupRoot -Force | Out-Null
    $backupScript = @"
set -Eeuo pipefail
sudo rm -f '$remoteBackupArchive'
cd /opt/noderasoftware
sudo tar -czf '$remoteBackupArchive' \
  apps/web/out/videowallplayer \
  apps/web/out/brand/videowallplayer \
  apps/web/out/downloads/VideoWallPlayer-Windows-Setup-x64.exe \
  apps/web/out/downloads/VideoWallPlayer-Windows-Portable-x64.zip \
  apps/web/out/downloads/VideoWallPlayer-Android.apk \
  apps/web/public/downloads/VideoWallPlayer-Windows-Setup-x64.exe \
  apps/web/public/downloads/VideoWallPlayer-Windows-Portable-x64.zip \
  apps/web/public/downloads/VideoWallPlayer-Android.apk
sudo chown '${PiUser}:${PiUser}' '$remoteBackupArchive'
"@
    $backupScript | ssh @sshPortArgs "${PiUser}@${PiHost}" "tr -d '\015' | bash -s"
    if ($LASTEXITCODE -ne 0) {
      throw "VideoWallPlayer uzak yedek basarisiz oldu."
    }
    scp @scpPortArgs "${PiUser}@${PiHost}:$remoteBackupArchive" "$localBackupArchive"
    if ($LASTEXITCODE -ne 0) {
      throw "VideoWallPlayer yedek indirme basarisiz oldu."
    }
    Invoke-RemoteCommand "sudo rm -f '$remoteBackupArchive'"
    Write-Host "    $localBackupArchive" -ForegroundColor DarkGreen
  }

  Write-Host "==> VideoWallPlayer paketi Pi'ye yukleniyor" -ForegroundColor Cyan
  scp @scpPortArgs "$archive" "${PiUser}@${PiHost}:$remoteArchive"
  if ($LASTEXITCODE -ne 0) {
    throw "VideoWallPlayer paketi Pi'ye yuklenemedi."
  }

  Write-Host "==> Sadece /videowallplayer ve VideoWall download alanlari yayinlaniyor" -ForegroundColor Cyan
  $remoteScript = @"
set -Eeuo pipefail
sudo rm -rf '$remoteStage'
sudo mkdir -p '$remoteStage'
sudo tar -xzf '$remoteArchive' -C '$remoteStage'

test -s '$remoteStage/apps/web/out/videowallplayer/index.html'
test -s '$remoteStage/apps/web/out/brand/videowallplayer/brand-logo.png'
test -s '$remoteStage/apps/web/out/brand/videowallplayer/brand-model.png'

sudo mkdir -p \
  /opt/noderasoftware/apps/web/out/videowallplayer \
  /opt/noderasoftware/apps/web/out/brand/videowallplayer \
  /opt/noderasoftware/apps/web/out/_next/static \
  /opt/noderasoftware/apps/web/out/downloads \
  /opt/noderasoftware/apps/web/public/downloads

sudo rsync -a --delete '$remoteStage/apps/web/out/videowallplayer/' /opt/noderasoftware/apps/web/out/videowallplayer/
sudo rsync -a --delete '$remoteStage/apps/web/out/brand/videowallplayer/' /opt/noderasoftware/apps/web/out/brand/videowallplayer/
sudo rsync -a '$remoteStage/apps/web/out/_next/static/' /opt/noderasoftware/apps/web/out/_next/static/

for download_file in \
  VideoWallPlayer-Windows-Setup-x64.exe \
  VideoWallPlayer-Windows-Portable-x64.zip \
  VideoWallPlayer-Android.apk
do
  test -s '$remoteStage/apps/web/public/downloads/'"`$download_file"
  sudo install -o hotelops -g hotelops -m 644 '$remoteStage/apps/web/public/downloads/'"`$download_file" '/opt/noderasoftware/apps/web/out/downloads/'"`$download_file"
  sudo install -o hotelops -g hotelops -m 644 '$remoteStage/apps/web/public/downloads/'"`$download_file" '/opt/noderasoftware/apps/web/public/downloads/'"`$download_file"
  test -s '/opt/noderasoftware/apps/web/out/downloads/'"`$download_file"
  test -s '/opt/noderasoftware/apps/web/public/downloads/'"`$download_file"
done

test -s /opt/noderasoftware/apps/web/out/videowallplayer/index.html
test -s /opt/noderasoftware/apps/web/out/hotel/index.html
test -s /opt/noderasoftware/apps/web/out/hotel/hotelpanel/index.html
test -s /opt/noderasoftware/apps/web/out/hotelpanel/index.html

sudo chown -R hotelops:hotelops \
  /opt/noderasoftware/apps/web/out/videowallplayer \
  /opt/noderasoftware/apps/web/out/brand/videowallplayer \
  /opt/noderasoftware/apps/web/out/_next/static
sudo find /opt/noderasoftware/apps/web/out/videowallplayer /opt/noderasoftware/apps/web/out/brand/videowallplayer -type d -exec chmod 755 {} +
sudo find /opt/noderasoftware/apps/web/out/videowallplayer /opt/noderasoftware/apps/web/out/brand/videowallplayer -type f -exec chmod 644 {} +

sudo rm -rf '$remoteStage' '$remoteArchive'
"@
  $remoteScript | ssh @sshPortArgs "${PiUser}@${PiHost}" "tr -d '\015' | bash -s"
  if ($LASTEXITCODE -ne 0) {
    throw "VideoWallPlayer dar kapsamli Pi yayini basarisiz oldu."
  }

  Write-Host "VideoWallPlayer dar kapsamli deploy tamamlandi." -ForegroundColor Green
} finally {
  if (Test-Path -LiteralPath $archive) {
    Remove-Item -LiteralPath $archive -Force
  }
  if (Test-Path -LiteralPath $stage) {
    Remove-Item -LiteralPath $stage -Recurse -Force
  }
}
