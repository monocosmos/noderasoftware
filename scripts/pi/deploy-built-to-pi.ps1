param(
  [string] $PiHost = "noderapi",

  [string] $PiUser = "raspberrypiserveradmin",

  [int] $SshPort = 0,

  [switch] $SkipBuild,

  [switch] $SkipTypecheck,

  [switch] $InstallDependencies,

  [switch] $PushDatabaseSchema,

  [switch] $IncludeDownloads,

  [switch] $SkipLocalPiBackup
)

$ErrorActionPreference = "Stop"

$root = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$stage = Join-Path $env:TEMP "noderasoftware-runtime-$timestamp"
$archive = Join-Path $env:TEMP "noderasoftware-runtime-$timestamp.tgz"
$downloadsArchive = Join-Path $env:TEMP "noderasoftware-downloads-$timestamp.tgz"
$localBackupDir = Join-Path $root "_local-backups\pi-deploy"
$localBackupArchive = Join-Path $localBackupDir "before-pi-deploy-$timestamp.tgz"
$remoteArchive = "/tmp/noderasoftware-runtime-$timestamp.tgz"
$remoteStage = "/tmp/noderasoftware-runtime-$timestamp"
$remoteDownloadsArchive = "/tmp/noderasoftware-downloads-$timestamp.tgz"
$remoteDownloadsStage = "/tmp/noderasoftware-downloads-$timestamp"
$remoteBackupArchive = "/tmp/noderasoftware-backup-$timestamp.tgz"
$remoteBackupOwner = "${PiUser}:${PiUser}"
$localApiSrcHash = (Get-FileHash (Join-Path $root "apps\api\src\server.ts") -Algorithm SHA256).Hash.ToLowerInvariant()
$localApiDistHash = (Get-FileHash (Join-Path $root "apps\api\dist\server.js") -Algorithm SHA256).Hash.ToLowerInvariant()

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

  if (-not (Test-Path $From)) {
    throw "Gerekli dosya/klasor bulunamadi: $From"
  }

  $parent = Split-Path -Parent $To
  New-Item -ItemType Directory -Path $parent -Force | Out-Null
  Copy-Item -LiteralPath $From -Destination $To -Recurse -Force
}

function Copy-RequiredDirectory {
  param(
    [Parameter(Mandatory = $true)]
    [string] $From,

    [Parameter(Mandatory = $true)]
    [string] $To,

    [switch] $ExcludeDownloads
  )

  if (-not (Test-Path $From)) {
    throw "Gerekli klasor bulunamadi: $From"
  }

  New-Item -ItemType Directory -Path $To -Force | Out-Null
  $robocopyArgs = @(
    $From,
    $To,
    "/E",
    "/NFL",
    "/NDL",
    "/NJH",
    "/NJS",
    "/NP"
  )

  if ($ExcludeDownloads) {
    $robocopyArgs += @("/XD", (Join-Path $From "downloads"))
  }

  & robocopy @robocopyArgs | Out-Null
  if ($LASTEXITCODE -gt 7) {
    throw "robocopy failed with exit code $LASTEXITCODE"
  }
}

function Invoke-RemoteCommand {
  param(
    [Parameter(Mandatory = $true)]
    [string] $Command
  )

  ssh @sshPortArgs "${PiUser}@${PiHost}" $Command
}

function Invoke-RemoteBashScript {
  param(
    [Parameter(Mandatory = $true)]
    [string] $Script
  )

  $normalizedScript = $Script.Replace("`r`n", "`n").Replace("`r", "`n")
  $normalizedScript | ssh @sshPortArgs "${PiUser}@${PiHost}" "tr -d '\015' | bash -s"
}

try {
  if (-not $SkipBuild) {
    Write-Host "==> Lokal API build aliniyor" -ForegroundColor Cyan
    npm.cmd run build --workspace @hotel-ops/api

    if (-not $SkipTypecheck) {
      Write-Host "==> Lokal web typecheck calisiyor" -ForegroundColor Cyan
      npm.cmd run typecheck --workspace @hotel-ops/web
    }

    Write-Host "==> Lokal web build/export aliniyor" -ForegroundColor Cyan
    npm.cmd run build --workspace @hotel-ops/web
  }

  if (Test-Path $stage) {
    Remove-Item -LiteralPath $stage -Recurse -Force
  }
  if (Test-Path $archive) {
    Remove-Item -LiteralPath $archive -Force
  }
  New-Item -ItemType Directory -Path $stage -Force | Out-Null

  Write-Host "==> Runtime paketi hazirlaniyor" -ForegroundColor Cyan
  Copy-RequiredItem -From (Join-Path $root "apps\api\dist") -To (Join-Path $stage "apps\api\dist")
  Copy-RequiredItem -From (Join-Path $root "apps\api\src") -To (Join-Path $stage "apps\api\src")
  Copy-RequiredItem -From (Join-Path $root "apps\api\package.json") -To (Join-Path $stage "apps\api\package.json")
  Copy-RequiredItem -From (Join-Path $root "apps\api\tsconfig.json") -To (Join-Path $stage "apps\api\tsconfig.json")
  Copy-RequiredDirectory -From (Join-Path $root "apps\web\out") -To (Join-Path $stage "apps\web\out") -ExcludeDownloads
  Copy-RequiredItem -From (Join-Path $root "apps\web\src") -To (Join-Path $stage "apps\web\src")
  Copy-RequiredDirectory -From (Join-Path $root "apps\web\public") -To (Join-Path $stage "apps\web\public") -ExcludeDownloads
  Copy-RequiredItem -From (Join-Path $root "apps\web\package.json") -To (Join-Path $stage "apps\web\package.json")
  Copy-RequiredItem -From (Join-Path $root "apps\web\next.config.ts") -To (Join-Path $stage "apps\web\next.config.ts")
  Copy-RequiredItem -From (Join-Path $root "apps\web\tailwind.config.ts") -To (Join-Path $stage "apps\web\tailwind.config.ts")
  Copy-RequiredItem -From (Join-Path $root "apps\web\postcss.config.js") -To (Join-Path $stage "apps\web\postcss.config.js")
  Copy-RequiredItem -From (Join-Path $root "apps\web\tsconfig.json") -To (Join-Path $stage "apps\web\tsconfig.json")
  Copy-RequiredItem -From (Join-Path $root "apps\web\eslint.config.mjs") -To (Join-Path $stage "apps\web\eslint.config.mjs")
  Copy-RequiredItem -From (Join-Path $root "apps\web\Web.config") -To (Join-Path $stage "apps\web\Web.config")
  Copy-RequiredItem -From (Join-Path $root "apps\desktop\src") -To (Join-Path $stage "apps\desktop\src")
  Copy-RequiredItem -From (Join-Path $root "apps\desktop\scripts") -To (Join-Path $stage "apps\desktop\scripts")
  Copy-RequiredItem -From (Join-Path $root "apps\desktop\build") -To (Join-Path $stage "apps\desktop\build")
  Copy-RequiredItem -From (Join-Path $root "apps\desktop\package.json") -To (Join-Path $stage "apps\desktop\package.json")
  Copy-RequiredItem -From (Join-Path $root "apps\desktop\README.md") -To (Join-Path $stage "apps\desktop\README.md")
  Copy-RequiredItem -From (Join-Path $root "apps\desktop\MAC_BUILD.md") -To (Join-Path $stage "apps\desktop\MAC_BUILD.md")
  Copy-RequiredItem -From (Join-Path $root "packages") -To (Join-Path $stage "packages")
  Copy-RequiredItem -From (Join-Path $root "docs") -To (Join-Path $stage "docs")
  Copy-RequiredItem -From (Join-Path $root "scripts") -To (Join-Path $stage "scripts")
  Copy-RequiredItem -From (Join-Path $root "scripts\pi\deploy-built-to-pi.ps1") -To (Join-Path $stage "scripts\pi\deploy-built-to-pi.ps1")
  Copy-RequiredItem -From (Join-Path $root "prisma\schema.prisma") -To (Join-Path $stage "prisma\schema.prisma")
  Copy-RequiredItem -From (Join-Path $root "package.json") -To (Join-Path $stage "package.json")
  Copy-RequiredItem -From (Join-Path $root "package-lock.json") -To (Join-Path $stage "package-lock.json")
  Copy-RequiredItem -From (Join-Path $root ".env.example") -To (Join-Path $stage ".env.example")
  Copy-RequiredItem -From (Join-Path $root ".gitignore") -To (Join-Path $stage ".gitignore")
  Copy-RequiredItem -From (Join-Path $root "README.md") -To (Join-Path $stage "README.md")

  & tar.exe -czf "$archive" -C "$stage" .
  if ($LASTEXITCODE -ne 0) {
    throw "Runtime tar paketi olusturulamadi. Exit code: $LASTEXITCODE"
  }

  Write-Host "==> Pi uzerindeki eski gecici paketler temizleniyor" -ForegroundColor Cyan
  Invoke-RemoteCommand "sudo rm -rf /tmp/noderasoftware-runtime-* /tmp/noderasoftware-downloads-* /tmp/noderasoftware-backup-*"

  if (-not $SkipLocalPiBackup) {
    Write-Host "==> Pi'deki mevcut surum bu bilgisayara yedekleniyor" -ForegroundColor Cyan
    New-Item -ItemType Directory -Path $localBackupDir -Force | Out-Null
    $backupRemoteScript = @"
set -Eeuo pipefail
sudo rm -f '$remoteBackupArchive'
cd /opt/noderasoftware
sudo tar \
  --exclude='./node_modules' \
  --exclude='./.cache' \
  --exclude='./.config' \
  --exclude='./apps/web/out/downloads' \
  --exclude='./apps/web/public/downloads' \
  --exclude='./_local-backups' \
  --exclude='./db-backups' \
  --exclude='*.log' \
  --exclude='*.err' \
  --exclude='*.tgz' \
  --exclude='*.zip' \
  -czf '$remoteBackupArchive' .
sudo chown '$remoteBackupOwner' '$remoteBackupArchive'
"@
    Invoke-RemoteBashScript $backupRemoteScript
    scp @scpPortArgs "${PiUser}@${PiHost}:$remoteBackupArchive" "$localBackupArchive"
    Invoke-RemoteCommand "sudo rm -f '$remoteBackupArchive'"
    Write-Host "    $localBackupArchive"
  }

  Write-Host "==> Runtime paketi Pi'ye yukleniyor" -ForegroundColor Cyan
  scp @scpPortArgs "$archive" "${PiUser}@${PiHost}:$remoteArchive"

  $dependencyCommand = if ($InstallDependencies) {
    "cd /opt/noderasoftware && sudo -u hotelops npm ci --omit=dev --include-workspace-root --workspace @hotel-ops/api --workspace @hotel-ops/web"
  } else {
    "echo 'Dependency kurulumu atlandi'"
  }

  $prismaGenerateCommand = "cd /opt/noderasoftware && sudo -u hotelops npx prisma generate --schema prisma/schema.prisma"
  $databaseCommand = if ($PushDatabaseSchema) {
    "$prismaGenerateCommand && sudo -u hotelops npx prisma db push --schema prisma/schema.prisma"
  } else {
    "$prismaGenerateCommand && echo 'Veritabani sema guncellemesi atlandi'"
  }
  $webOutRsyncOptions = "--exclude downloads/"
  $webPublicRsyncOptions = "--exclude downloads/"

$remoteScript = @"
set -Eeuo pipefail
cleanup() {
  sudo rm -rf '$remoteStage' '$remoteArchive'
}
trap cleanup EXIT

sudo rm -rf '$remoteStage'
sudo mkdir -p '$remoteStage'
sudo tar -xzf '$remoteArchive' -C '$remoteStage'
sudo rsync -a --delete '$remoteStage/apps/api/dist/' /opt/noderasoftware/apps/api/dist/
sudo rsync -a --delete '$remoteStage/apps/api/src/' /opt/noderasoftware/apps/api/src/
sudo rsync -a '$remoteStage/apps/api/package.json' /opt/noderasoftware/apps/api/package.json
sudo rsync -a '$remoteStage/apps/api/tsconfig.json' /opt/noderasoftware/apps/api/tsconfig.json
sudo rsync -a --delete $webOutRsyncOptions '$remoteStage/apps/web/out/' /opt/noderasoftware/apps/web/out/
sudo rsync -a --delete '$remoteStage/apps/web/src/' /opt/noderasoftware/apps/web/src/
sudo rsync -a --delete $webPublicRsyncOptions '$remoteStage/apps/web/public/' /opt/noderasoftware/apps/web/public/
sudo rsync -a '$remoteStage/apps/web/package.json' /opt/noderasoftware/apps/web/package.json
sudo rsync -a '$remoteStage/apps/web/next.config.ts' /opt/noderasoftware/apps/web/next.config.ts
sudo rsync -a '$remoteStage/apps/web/tailwind.config.ts' /opt/noderasoftware/apps/web/tailwind.config.ts
sudo rsync -a '$remoteStage/apps/web/postcss.config.js' /opt/noderasoftware/apps/web/postcss.config.js
sudo rsync -a '$remoteStage/apps/web/tsconfig.json' /opt/noderasoftware/apps/web/tsconfig.json
sudo rsync -a '$remoteStage/apps/web/eslint.config.mjs' /opt/noderasoftware/apps/web/eslint.config.mjs
sudo rsync -a '$remoteStage/apps/web/Web.config' /opt/noderasoftware/apps/web/Web.config
sudo mkdir -p /opt/noderasoftware/apps/desktop
sudo rsync -a --delete '$remoteStage/apps/desktop/src/' /opt/noderasoftware/apps/desktop/src/
sudo rsync -a --delete '$remoteStage/apps/desktop/scripts/' /opt/noderasoftware/apps/desktop/scripts/
sudo rsync -a --delete '$remoteStage/apps/desktop/build/' /opt/noderasoftware/apps/desktop/build/
sudo rsync -a '$remoteStage/apps/desktop/package.json' /opt/noderasoftware/apps/desktop/package.json
sudo rsync -a '$remoteStage/apps/desktop/README.md' /opt/noderasoftware/apps/desktop/README.md
sudo rsync -a '$remoteStage/apps/desktop/MAC_BUILD.md' /opt/noderasoftware/apps/desktop/MAC_BUILD.md
sudo rsync -a --delete '$remoteStage/packages/' /opt/noderasoftware/packages/
sudo rsync -a --delete '$remoteStage/docs/' /opt/noderasoftware/docs/
sudo rsync -a --delete '$remoteStage/scripts/' /opt/noderasoftware/scripts/
sudo rsync -a '$remoteStage/prisma/schema.prisma' /opt/noderasoftware/prisma/schema.prisma
sudo rsync -a '$remoteStage/package.json' /opt/noderasoftware/package.json
sudo rsync -a '$remoteStage/package-lock.json' /opt/noderasoftware/package-lock.json
sudo rsync -a '$remoteStage/.env.example' /opt/noderasoftware/.env.example
sudo rsync -a '$remoteStage/.gitignore' /opt/noderasoftware/.gitignore
sudo rsync -a '$remoteStage/README.md' /opt/noderasoftware/README.md

sudo chown -R hotelops:hotelops /opt/noderasoftware/apps/api /opt/noderasoftware/apps/web /opt/noderasoftware/apps/desktop /opt/noderasoftware/packages /opt/noderasoftware/docs /opt/noderasoftware/scripts /opt/noderasoftware/prisma /opt/noderasoftware/package.json /opt/noderasoftware/package-lock.json /opt/noderasoftware/.env.example /opt/noderasoftware/.gitignore /opt/noderasoftware/README.md
sudo find /opt/noderasoftware/apps/api/dist -type d -exec chmod 755 {} +
sudo find /opt/noderasoftware/apps/api/dist -type f -exec chmod 644 {} +
sudo find /opt/noderasoftware/apps/web/out -type d -exec chmod 755 {} +
sudo find /opt/noderasoftware/apps/web/out -type f -exec chmod 644 {} +
sudo chmod +x /opt/noderasoftware/apps/desktop/scripts/*.sh 2>/dev/null || true

$dependencyCommand
$databaseCommand

sudo systemctl restart hotelops-api
sudo nginx -t
sudo systemctl reload nginx
for i in 1 2 3 4 5 6 7 8 9 10; do
  if curl -fsS http://127.0.0.1:4000/health; then
    break
  fi
  sleep 1
done

"@

  Write-Host "==> Pi'de hizli yayinlama uygulaniyor" -ForegroundColor Cyan
  Invoke-RemoteBashScript $remoteScript

  Write-Host "==> Pi API dosya eslesmesi dogrulaniyor" -ForegroundColor Cyan
  $remoteApiHashes = Invoke-RemoteCommand "sha256sum /opt/noderasoftware/apps/api/src/server.ts /opt/noderasoftware/apps/api/dist/server.js"
  $remoteApiSrcHash = (($remoteApiHashes | Where-Object { $_ -like "*/apps/api/src/server.ts" } | Select-Object -First 1) -split "\s+")[0].ToLowerInvariant()
  $remoteApiDistHash = (($remoteApiHashes | Where-Object { $_ -like "*/apps/api/dist/server.js" } | Select-Object -First 1) -split "\s+")[0].ToLowerInvariant()
  if ($remoteApiSrcHash -ne $localApiSrcHash -or $remoteApiDistHash -ne $localApiDistHash) {
    throw "Pi API dosyalari lokal build ile eslesmedi. src=$remoteApiSrcHash/$localApiSrcHash dist=$remoteApiDistHash/$localApiDistHash"
  }

  # Copy the currently running deploy script separately so another PC can pull it from the Pi.
  $selfScript = Join-Path $root "scripts\pi\deploy-built-to-pi.ps1"
  scp @scpPortArgs "$selfScript" "${PiUser}@${PiHost}:/tmp/deploy-built-to-pi.ps1"
  ssh @sshPortArgs "${PiUser}@${PiHost}" "sudo mv /tmp/deploy-built-to-pi.ps1 /opt/noderasoftware/scripts/pi/deploy-built-to-pi.ps1 && sudo chown hotelops:hotelops /opt/noderasoftware/scripts/pi/deploy-built-to-pi.ps1 && sudo chmod 644 /opt/noderasoftware/scripts/pi/deploy-built-to-pi.ps1"

  if ($IncludeDownloads) {
    $downloadsPath = Join-Path $root "apps\web\public\downloads"
    if (-not (Test-Path $downloadsPath)) {
      throw "Indirme dosyalari klasoru bulunamadi: $downloadsPath"
    }

    Write-Host "==> Indirme dosyalari Pi'ye yukleniyor" -ForegroundColor Cyan
    if (Test-Path $downloadsArchive) {
      Remove-Item -LiteralPath $downloadsArchive -Force
    }
    & tar.exe -czf "$downloadsArchive" -C "$downloadsPath" .
    if ($LASTEXITCODE -ne 0) {
      throw "Indirme dosyalari tar paketi olusturulamadi. Exit code: $LASTEXITCODE"
    }
    scp @scpPortArgs "$downloadsArchive" "${PiUser}@${PiHost}:$remoteDownloadsArchive"

    $downloadsRemoteScript = @"
set -Eeuo pipefail
cleanup() {
  sudo rm -rf '$remoteDownloadsStage' '$remoteDownloadsArchive'
}
trap cleanup EXIT
sudo rm -rf '$remoteDownloadsStage'
sudo mkdir -p '$remoteDownloadsStage'
sudo tar -xzf '$remoteDownloadsArchive' -C '$remoteDownloadsStage'
sudo mkdir -p /opt/noderasoftware/apps/web/out/downloads /opt/noderasoftware/apps/web/public/downloads
sudo rsync -a --delete '$remoteDownloadsStage/' /opt/noderasoftware/apps/web/out/downloads/
sudo rsync -a --delete '$remoteDownloadsStage/' /opt/noderasoftware/apps/web/public/downloads/
sudo chown -R hotelops:hotelops /opt/noderasoftware/apps/web/out/downloads /opt/noderasoftware/apps/web/public/downloads
sudo find /opt/noderasoftware/apps/web/out/downloads /opt/noderasoftware/apps/web/public/downloads -type d -exec chmod 755 {} +
sudo find /opt/noderasoftware/apps/web/out/downloads /opt/noderasoftware/apps/web/public/downloads -type f -exec chmod 644 {} +
"@

    Invoke-RemoteBashScript $downloadsRemoteScript
  }

  Write-Host ""
  Write-Host "Hizli deploy tamamlandi." -ForegroundColor Green
} finally {
  if (Test-Path $stage) {
    Remove-Item -LiteralPath $stage -Recurse -Force
  }
  if (Test-Path $archive) {
    Remove-Item -LiteralPath $archive -Force
  }
  if (Test-Path $downloadsArchive) {
    Remove-Item -LiteralPath $downloadsArchive -Force
  }
}
