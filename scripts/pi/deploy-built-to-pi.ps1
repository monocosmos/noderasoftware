param(
  [string] $PiHost = "noderapi",

  [string] $PiUser = "raspberrypiserveradmin",

  [int] $SshPort = 0,

  [switch] $SkipBuild,

  [switch] $SkipTypecheck,

  [switch] $InstallDependencies,

  [switch] $PushDatabaseSchema,

  [switch] $SkipDatabaseSchemaPush,

  [switch] $IncludeDownloads,

  [switch] $SkipLocalPiBackup,

  [switch] $UpdateLandingPage
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
$localApiSrcHash = ""
$localApiDistHash = ""
$piMaintenanceEnabledByDeploy = $false
$piMaintenanceDisabledAfterDeploy = $false

if ($PushDatabaseSchema -and $SkipDatabaseSchemaPush) {
  throw "-PushDatabaseSchema ve -SkipDatabaseSchemaPush birlikte kullanilamaz."
}

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

    [switch] $ExcludeDownloads,

    [string[]] $ExcludeDirectoryNames = @(),

    [string[]] $ExcludeFileNames = @()
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
  if ($ExcludeDirectoryNames.Count -gt 0) {
    $robocopyArgs += @("/XD")
    foreach ($directoryName in $ExcludeDirectoryNames) {
      $robocopyArgs += (Join-Path $From $directoryName)
    }
  }
  if ($ExcludeFileNames.Count -gt 0) {
    $robocopyArgs += @("/XF") + $ExcludeFileNames
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
  if ($LASTEXITCODE -ne 0) {
    throw "Uzak komut basarisiz oldu. Exit code: $LASTEXITCODE"
  }
}

function Invoke-RemoteBashScript {
  param(
    [Parameter(Mandatory = $true)]
    [string] $Script
  )

  $normalizedScript = $Script.Replace("`r`n", "`n").Replace("`r", "`n")
  $normalizedScript | ssh @sshPortArgs "${PiUser}@${PiHost}" "tr -d '\015' | bash -s"
  if ($LASTEXITCODE -ne 0) {
    throw "Uzak bash scripti basarisiz oldu. Exit code: $LASTEXITCODE"
  }
}

function Set-PiMaintenanceMode {
  param(
    [Parameter(Mandatory = $true)]
    [bool] $Enabled,

    [string] $Message = "",

    [string] $Source = "deploy"
  )

  $enabledJson = if ($Enabled) { "true" } else { "false" }
  $messageJson = $Message | ConvertTo-Json -Compress
  $sourceJson = $Source | ConvertTo-Json -Compress

  $maintenanceScript = @"
set -Eeuo pipefail
enabled=$enabledJson
message=$messageJson
source=$sourceJson

sudo mkdir -p /opt/noderasoftware/runtime /opt/noderasoftware/apps/web/out /opt/noderasoftware/apps/web/public
python3 - "`$enabled" "`$message" "`$source" <<'PY' | sudo tee /opt/noderasoftware/runtime/maintenance-status.json >/dev/null
import json
import sys
from datetime import datetime, timezone

enabled = sys.argv[1].lower() == "true"
message = sys.argv[2] or "\u015eu an bak\u0131m yap\u0131l\u0131yor."
source = sys.argv[3] or "deploy"
status = {
    "enabled": enabled,
    "message": message,
    "updatedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    "updatedBy": "deploy-script",
    "source": source,
}
print(json.dumps(status, ensure_ascii=False, indent=2))
PY
sudo cp /opt/noderasoftware/runtime/maintenance-status.json /opt/noderasoftware/apps/web/out/maintenance-status.json
sudo cp /opt/noderasoftware/runtime/maintenance-status.json /opt/noderasoftware/apps/web/public/maintenance-status.json
sudo chown hotelops:hotelops /opt/noderasoftware/runtime/maintenance-status.json /opt/noderasoftware/apps/web/out/maintenance-status.json /opt/noderasoftware/apps/web/public/maintenance-status.json 2>/dev/null || true
sudo chmod 644 /opt/noderasoftware/runtime/maintenance-status.json /opt/noderasoftware/apps/web/out/maintenance-status.json /opt/noderasoftware/apps/web/public/maintenance-status.json
"@

  Invoke-RemoteBashScript $maintenanceScript
}

function Write-Utf8NoBomFile {
  param(
    [Parameter(Mandatory = $true)]
    [string] $Path,

    [Parameter(Mandatory = $true)]
    [string] $Content
  )

  $parent = Split-Path -Parent $Path
  New-Item -ItemType Directory -Path $parent -Force | Out-Null
  [System.IO.File]::WriteAllText($Path, $Content, [System.Text.UTF8Encoding]::new($false))
}

function Update-WebBuildManifest {
  $buildIdPath = Join-Path $root "apps\web\.next\BUILD_ID"
  if (-not (Test-Path -LiteralPath $buildIdPath)) {
    if (Test-Path -LiteralPath (Join-Path $root "apps\web\out\web-build.json")) {
      return
    }
    throw "Web build kimligi bulunamadi: $buildIdPath"
  }

  $buildId = (Get-Content -LiteralPath $buildIdPath -Raw).Trim()
  if (-not $buildId) {
    throw "Web build kimligi bos: $buildIdPath"
  }

  $manifest = [ordered]@{
    schema = 1
    buildId = $buildId
    generatedAt = (Get-Date).ToUniversalTime().ToString("o")
    source = "next-build"
  } | ConvertTo-Json

  Write-Utf8NoBomFile -Path (Join-Path $root "apps\web\out\web-build.json") -Content ($manifest + "`n")
  Write-Utf8NoBomFile -Path (Join-Path $root "apps\web\public\web-build.json") -Content ($manifest + "`n")
}

function Convert-AndroidSdkPath {
  param([string] $PathValue)

  if (-not $PathValue) {
    return $null
  }

  return ($PathValue.Trim() -replace "\\:", ":" -replace "\\\\", "\")
}

function Resolve-AndroidBuildTool {
  param([string] $ToolName)

  $androidDir = Join-Path $root "apps\android"
  $candidates = @($env:ANDROID_HOME, $env:ANDROID_SDK_ROOT)
  $localPropertiesPath = Join-Path $androidDir "local.properties"
  if (Test-Path -LiteralPath $localPropertiesPath) {
    Get-Content -LiteralPath $localPropertiesPath | ForEach-Object {
      if ($_ -match "^sdk\.dir=(.+)$") {
        $candidates += Convert-AndroidSdkPath $Matches[1]
      }
    }
  }
  $candidates += (Join-Path $env:LOCALAPPDATA "Android\Sdk")

  foreach ($candidate in $candidates) {
    if (-not $candidate -or -not (Test-Path -LiteralPath $candidate)) {
      continue
    }

    $buildToolsRoot = Join-Path $candidate "build-tools"
    if (-not (Test-Path -LiteralPath $buildToolsRoot)) {
      continue
    }

    $tool = Get-ChildItem -LiteralPath $buildToolsRoot -Directory |
      Sort-Object Name -Descending |
      ForEach-Object { Join-Path $_.FullName $ToolName } |
      Where-Object { Test-Path -LiteralPath $_ } |
      Select-Object -First 1

    if ($tool) {
      return $tool
    }
  }

  throw "$ToolName Android build-tools icinde bulunamadi. APK/manifest eslesmesi dogrulanamiyor."
}

function Assert-AndroidDownloadMatchesManifest {
  $manifestPath = Join-Path $root "apps\web\public\app-version.json"
  $apkPath = Join-Path $root "apps\web\public\downloads\HotelOps-Android-V1.apk"

  if (-not (Test-Path -LiteralPath $manifestPath)) {
    throw "Android app-version manifest bulunamadi: $manifestPath"
  }
  if (-not (Test-Path -LiteralPath $apkPath)) {
    throw "Android APK bulunamadi: $apkPath"
  }

  $manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
  $expectedCode = [int64] $manifest.platforms.androidDirect.latestCode
  if ($expectedCode -le 0) {
    throw "app-version.json icinde androidDirect.latestCode gecersiz."
  }

  $aapt = Resolve-AndroidBuildTool -ToolName "aapt.exe"
  $badging = & $aapt dump badging $apkPath 2>&1
  if ($LASTEXITCODE -ne 0) {
    throw "APK versionCode okunamadi: $($badging -join "`n")"
  }

  $badgingText = $badging -join "`n"
  if ($badgingText -notmatch "versionCode='(\d+)'") {
    throw "APK badging icinde versionCode bulunamadi."
  }

  $actualCode = [int64] $Matches[1]
  if ($actualCode -ne $expectedCode) {
    throw "Android APK versionCode ($actualCode), app-version androidDirect.latestCode ($expectedCode) ile eslesmiyor. Once APK'yi yeniden build edin."
  }

  Write-Host "    Android APK/version manifest eslesti: $actualCode" -ForegroundColor DarkGreen
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

  Write-Host "==> Web build manifesti guncelleniyor" -ForegroundColor Cyan
  Update-WebBuildManifest
  $localApiSrcHash = (Get-FileHash (Join-Path $root "apps\api\src\server.ts") -Algorithm SHA256).Hash.ToLowerInvariant()
  $localApiDistHash = (Get-FileHash (Join-Path $root "apps\api\dist\server.js") -Algorithm SHA256).Hash.ToLowerInvariant()

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
  Copy-RequiredDirectory `
    -From (Join-Path $root "apps\android") `
    -To (Join-Path $stage "apps\android") `
    -ExcludeDirectoryNames @(".gradle", ".kotlin", ".idea", "build", "app\build", "app\.cxx", "captures", ".externalNativeBuild", ".cxx") `
    -ExcludeFileNames @("local.properties", "hotelops-release.jks", "google-services.json", "*.iml")
  Copy-RequiredDirectory `
    -From (Join-Path $root "apps\ios") `
    -To (Join-Path $stage "apps\ios") `
    -ExcludeDirectoryNames @("build", "DerivedData", ".swiftpm", "xcuserdata") `
    -ExcludeFileNames @("*.xcuserstate")
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

  Write-Host "==> Pi bakim modu aciliyor" -ForegroundColor Cyan
  Set-PiMaintenanceMode -Enabled $true -Source "deploy"
  $piMaintenanceEnabledByDeploy = $true

  Write-Host "==> Runtime paketi Pi'ye yukleniyor" -ForegroundColor Cyan
  scp @scpPortArgs "$archive" "${PiUser}@${PiHost}:$remoteArchive"

  $includeDownloadsFlag = if ($IncludeDownloads) { "1" } else { "0" }
  if ($IncludeDownloads) {
    $downloadsPath = Join-Path $root "apps\web\public\downloads"
    if (-not (Test-Path $downloadsPath)) {
      throw "Indirme dosyalari klasoru bulunamadi: $downloadsPath"
    }

    Assert-AndroidDownloadMatchesManifest

    Write-Host "==> Indirme dosyalari manifest oncesi Pi'ye yukleniyor" -ForegroundColor Cyan
    if (Test-Path $downloadsArchive) {
      Remove-Item -LiteralPath $downloadsArchive -Force
    }
    & tar.exe -czf "$downloadsArchive" --exclude="./_backups" -C "$downloadsPath" .
    if ($LASTEXITCODE -ne 0) {
      throw "Indirme dosyalari tar paketi olusturulamadi. Exit code: $LASTEXITCODE"
    }
    scp @scpPortArgs "$downloadsArchive" "${PiUser}@${PiHost}:$remoteDownloadsArchive"
  }

  $dependencyCommand = if ($InstallDependencies) {
    "cd /opt/noderasoftware && sudo -u hotelops npm ci --omit=dev --include-workspace-root --workspace @hotel-ops/api --workspace @hotel-ops/web"
  } else {
    "echo 'Dependency kurulumu atlandi'"
  }

  $databaseCommand = if ($SkipDatabaseSchemaPush) {
@"
echo 'UYARI: Veritabani sema guncellemesi bilerek atlandi'
cd /opt/noderasoftware
sudo -u hotelops bash -lc 'set -a; . ./.env; set +a; npx prisma generate --schema prisma/schema.prisma'
"@
  } else {
@"
echo 'Prisma veritabani semasi uygulanıyor'
cd /opt/noderasoftware
sudo -u hotelops bash -lc 'set -a; . ./.env; set +a; npx prisma db push --schema prisma/schema.prisma --skip-generate && npx prisma generate --schema prisma/schema.prisma'
"@
  }
  $webOutRsyncOptions = "--exclude downloads/ --exclude maintenance-status.json"
  $webPublicRsyncOptions = "--exclude downloads/ --exclude maintenance-status.json"
  # HotelOps deploys update /hotel by default; the personal root page is updated only with -UpdateLandingPage.
  $preserveLandingRoot = if ($UpdateLandingPage) { "0" } else { "1" }

$remoteScript = @"
set -Eeuo pipefail
include_downloads='$includeDownloadsFlag'
cleanup() {
  sudo rm -rf '$remoteStage' '$remoteArchive' '/tmp/noderasoftware-landing-preserve-$timestamp'
  if [ "`$include_downloads" = "1" ]; then
    sudo rm -rf '$remoteDownloadsStage' '$remoteDownloadsArchive'
  fi
}
trap cleanup EXIT

sudo rm -rf '$remoteStage'
sudo mkdir -p '$remoteStage'
sudo tar -xzf '$remoteArchive' -C '$remoteStage'

preserve_landing_root='$preserveLandingRoot'
landing_preserve='/tmp/noderasoftware-landing-preserve-$timestamp'
if [ "`$preserve_landing_root" = "1" ]; then
  sudo rm -rf "`$landing_preserve"
  mkdir -p "`$landing_preserve"
  for landing_file in index.html index.txt; do
    if [ -f "/opt/noderasoftware/apps/web/out/`$landing_file" ]; then
      sudo cp -a "/opt/noderasoftware/apps/web/out/`$landing_file" "`$landing_preserve/`$landing_file"
    fi
  done
  if [ -f /opt/noderasoftware/apps/web/out/index.html ] && command -v python3 >/dev/null 2>&1; then
    python3 - <<'PY' > "`$landing_preserve/static-files.txt"
from html import unescape
from pathlib import Path
import re

html = Path("/opt/noderasoftware/apps/web/out/index.html").read_text(encoding="utf-8", errors="ignore")
for match in sorted(set(re.findall(r"/_next/static/[^\"'<>\s)]+", html))):
    print(unescape(match).split("?")[0].lstrip("/"))
PY
    while IFS= read -r static_file; do
      if [ -n "`$static_file" ] && [ -f "/opt/noderasoftware/apps/web/out/`$static_file" ]; then
        sudo mkdir -p "`$landing_preserve/`$(dirname "`$static_file")"
        sudo cp -a "/opt/noderasoftware/apps/web/out/`$static_file" "`$landing_preserve/`$static_file"
      fi
    done < "`$landing_preserve/static-files.txt"
  fi
  for landing_dir in personal personal-assets assets images img; do
    if [ -d "/opt/noderasoftware/apps/web/out/`$landing_dir" ]; then
      sudo cp -a "/opt/noderasoftware/apps/web/out/`$landing_dir" "`$landing_preserve/`$landing_dir"
    fi
  done
else
  echo 'Landing page guncellemesi aktif; root index korunmayacak'
fi

sudo rsync -a --delete '$remoteStage/apps/api/dist/' /opt/noderasoftware/apps/api/dist/
sudo rsync -a --delete '$remoteStage/apps/api/src/' /opt/noderasoftware/apps/api/src/
sudo rsync -a '$remoteStage/apps/api/package.json' /opt/noderasoftware/apps/api/package.json
sudo rsync -a '$remoteStage/apps/api/tsconfig.json' /opt/noderasoftware/apps/api/tsconfig.json
sudo rsync -a --delete $webOutRsyncOptions '$remoteStage/apps/web/out/' /opt/noderasoftware/apps/web/out/
sudo rsync -a --delete '$remoteStage/apps/web/src/' /opt/noderasoftware/apps/web/src/
sudo rsync -a --delete $webPublicRsyncOptions '$remoteStage/apps/web/public/' /opt/noderasoftware/apps/web/public/

if [ "`$preserve_landing_root" = "1" ]; then
  for landing_file in index.html index.txt; do
    if [ -f "`$landing_preserve/`$landing_file" ]; then
      sudo cp -a "`$landing_preserve/`$landing_file" "/opt/noderasoftware/apps/web/out/`$landing_file"
    fi
  done
  if [ -d "`$landing_preserve/_next/static" ]; then
    sudo mkdir -p /opt/noderasoftware/apps/web/out/_next/static
    sudo rsync -a "`$landing_preserve/_next/static/" /opt/noderasoftware/apps/web/out/_next/static/
  fi
  for landing_dir in personal personal-assets assets images img; do
    if [ -d "`$landing_preserve/`$landing_dir" ]; then
      sudo rm -rf "/opt/noderasoftware/apps/web/out/`$landing_dir"
      sudo cp -a "`$landing_preserve/`$landing_dir" "/opt/noderasoftware/apps/web/out/`$landing_dir"
    fi
  done
fi

if [ "`$include_downloads" = "1" ]; then
  echo 'Indirme dosyalari manifest oncesi uygulaniyor'
  sudo rm -rf '$remoteDownloadsStage'
  sudo mkdir -p '$remoteDownloadsStage'
  sudo tar -xzf '$remoteDownloadsArchive' -C '$remoteDownloadsStage'
  sudo mkdir -p /opt/noderasoftware/apps/web/out/downloads /opt/noderasoftware/apps/web/public/downloads
  sudo rsync -a --delete '$remoteDownloadsStage/' /opt/noderasoftware/apps/web/out/downloads/
  sudo rsync -a --delete '$remoteDownloadsStage/' /opt/noderasoftware/apps/web/public/downloads/
  sudo chown -R hotelops:hotelops /opt/noderasoftware/apps/web/out/downloads /opt/noderasoftware/apps/web/public/downloads
  sudo find /opt/noderasoftware/apps/web/out/downloads /opt/noderasoftware/apps/web/public/downloads -type d -exec chmod 755 {} +
  sudo find /opt/noderasoftware/apps/web/out/downloads /opt/noderasoftware/apps/web/public/downloads -type f -exec chmod 644 {} +
fi

test -s '$remoteStage/apps/web/out/app-version.json'
test -s '$remoteStage/apps/web/public/app-version.json'
test -s '$remoteStage/apps/web/out/web-build.json'
test -s '$remoteStage/apps/web/public/web-build.json'
sudo install -o hotelops -g hotelops -m 644 '$remoteStage/apps/web/out/app-version.json' /opt/noderasoftware/apps/web/out/app-version.json
sudo install -o hotelops -g hotelops -m 644 '$remoteStage/apps/web/public/app-version.json' /opt/noderasoftware/apps/web/public/app-version.json
sudo install -o hotelops -g hotelops -m 644 '$remoteStage/apps/web/out/web-build.json' /opt/noderasoftware/apps/web/out/web-build.json
sudo install -o hotelops -g hotelops -m 644 '$remoteStage/apps/web/public/web-build.json' /opt/noderasoftware/apps/web/public/web-build.json
sudo rsync -a '$remoteStage/apps/web/package.json' /opt/noderasoftware/apps/web/package.json
sudo rsync -a '$remoteStage/apps/web/next.config.ts' /opt/noderasoftware/apps/web/next.config.ts
sudo rsync -a '$remoteStage/apps/web/tailwind.config.ts' /opt/noderasoftware/apps/web/tailwind.config.ts
sudo rsync -a '$remoteStage/apps/web/postcss.config.js' /opt/noderasoftware/apps/web/postcss.config.js
sudo rsync -a '$remoteStage/apps/web/tsconfig.json' /opt/noderasoftware/apps/web/tsconfig.json
sudo rsync -a '$remoteStage/apps/web/eslint.config.mjs' /opt/noderasoftware/apps/web/eslint.config.mjs
sudo rsync -a '$remoteStage/apps/web/Web.config' /opt/noderasoftware/apps/web/Web.config
sudo install -o hotelops -g hotelops -m 644 /opt/noderasoftware/runtime/maintenance-status.json /opt/noderasoftware/apps/web/out/maintenance-status.json
sudo install -o hotelops -g hotelops -m 644 /opt/noderasoftware/runtime/maintenance-status.json /opt/noderasoftware/apps/web/public/maintenance-status.json
test -s /opt/noderasoftware/apps/web/out/hotel/hotelpanel/index.html
test -s /opt/noderasoftware/apps/web/out/maintenance-status.json
sudo mkdir -p /opt/noderasoftware/apps/desktop
sudo rsync -a --delete '$remoteStage/apps/desktop/src/' /opt/noderasoftware/apps/desktop/src/
sudo rsync -a --delete '$remoteStage/apps/desktop/scripts/' /opt/noderasoftware/apps/desktop/scripts/
sudo rsync -a --delete '$remoteStage/apps/desktop/build/' /opt/noderasoftware/apps/desktop/build/
sudo rsync -a '$remoteStage/apps/desktop/package.json' /opt/noderasoftware/apps/desktop/package.json
sudo rsync -a '$remoteStage/apps/desktop/README.md' /opt/noderasoftware/apps/desktop/README.md
sudo rsync -a '$remoteStage/apps/desktop/MAC_BUILD.md' /opt/noderasoftware/apps/desktop/MAC_BUILD.md
sudo mkdir -p /opt/noderasoftware/apps/android /opt/noderasoftware/apps/ios
sudo rsync -a --delete '$remoteStage/apps/android/' /opt/noderasoftware/apps/android/
sudo rsync -a --delete '$remoteStage/apps/ios/' /opt/noderasoftware/apps/ios/
sudo rsync -a --delete '$remoteStage/packages/' /opt/noderasoftware/packages/
sudo rsync -a --delete '$remoteStage/docs/' /opt/noderasoftware/docs/
sudo rsync -a --delete '$remoteStage/scripts/' /opt/noderasoftware/scripts/
if [ -f /opt/noderasoftware/scripts/pi/noderasoftware-nginx-ssl.conf ]; then
  sudo install -o root -g root -m 644 /opt/noderasoftware/scripts/pi/noderasoftware-nginx-ssl.conf /etc/nginx/sites-available/noderasoftware
fi
sudo rsync -a '$remoteStage/prisma/schema.prisma' /opt/noderasoftware/prisma/schema.prisma
sudo rsync -a '$remoteStage/package.json' /opt/noderasoftware/package.json
sudo rsync -a '$remoteStage/package-lock.json' /opt/noderasoftware/package-lock.json
sudo rsync -a '$remoteStage/.env.example' /opt/noderasoftware/.env.example
sudo rsync -a '$remoteStage/.gitignore' /opt/noderasoftware/.gitignore
sudo rsync -a '$remoteStage/README.md' /opt/noderasoftware/README.md

sudo chown -R hotelops:hotelops /opt/noderasoftware/apps/api /opt/noderasoftware/apps/web /opt/noderasoftware/apps/desktop /opt/noderasoftware/apps/android /opt/noderasoftware/apps/ios /opt/noderasoftware/packages /opt/noderasoftware/docs /opt/noderasoftware/scripts /opt/noderasoftware/prisma /opt/noderasoftware/package.json /opt/noderasoftware/package-lock.json /opt/noderasoftware/.env.example /opt/noderasoftware/.gitignore /opt/noderasoftware/README.md
sudo find /opt/noderasoftware/apps/api/dist -type d -exec chmod 755 {} +
sudo find /opt/noderasoftware/apps/api/dist -type f -exec chmod 644 {} +
sudo find /opt/noderasoftware/apps/web/out -type d -exec chmod 755 {} +
sudo find /opt/noderasoftware/apps/web/out -type f -exec chmod 644 {} +
sudo find /opt/noderasoftware/scripts -type d -exec chmod 755 {} +
sudo find /opt/noderasoftware/scripts -type f -exec chmod 644 {} +
sudo chmod +x /opt/noderasoftware/scripts/pi/*.sh 2>/dev/null || true
sudo chmod +x /opt/noderasoftware/apps/desktop/scripts/*.sh 2>/dev/null || true
sudo chmod +x /opt/noderasoftware/apps/android/gradlew 2>/dev/null || true

$dependencyCommand
$databaseCommand
sudo -u hotelops node /opt/noderasoftware/scripts/pi/send-android-app-update-push.mjs

sudo systemctl restart hotelops-api
sudo nginx -t
sudo systemctl reload nginx
curl -k --resolve noderasoftware.com:443:127.0.0.1 -fsS https://noderasoftware.com/app-version.json | node -e 'let s="";process.stdin.on("data",d=>s+=d);process.stdin.on("end",()=>{const j=JSON.parse(s);if(!j.platforms||!j.platforms.desktop||!j.platforms.androidDirect||!j.platforms.androidPlay)process.exit(2);console.log("app-version-ok");});'
curl -k --resolve noderasoftware.com:443:127.0.0.1 -fsS https://noderasoftware.com/web-build.json | node -e 'let s="";process.stdin.on("data",d=>s+=d);process.stdin.on("end",()=>{const j=JSON.parse(s);if(!j.buildId)process.exit(2);console.log("web-build-ok",j.buildId);});'
health_ok=0
for i in 1 2 3 4 5 6 7 8 9 10; do
  if curl -fsS http://127.0.0.1:4000/health; then
    health_ok=1
    break
  fi
  sleep 1
done
if [ "`$health_ok" != "1" ]; then
  echo 'API health deploy sonrasi basarili olmadi' >&2
  exit 1
fi
curl -fsS http://127.0.0.1:4000/health/deep
curl -k --resolve noderasoftware.com:443:127.0.0.1 -fsS https://noderasoftware.com/api/health
curl -k --resolve noderasoftware.com:443:127.0.0.1 -fsS https://noderasoftware.com/api/health/deep
cd /opt/noderasoftware
sudo -u hotelops bash -lc 'set -a; . ./.env; set +a; node scripts/pi/verify-live-api-smoke.mjs'

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

  Write-Host "==> Pi bakim modu kapatiliyor" -ForegroundColor Cyan
  Set-PiMaintenanceMode -Enabled $false -Source "deploy"
  $piMaintenanceDisabledAfterDeploy = $true

  Write-Host ""
  Write-Host "Hizli deploy tamamlandi." -ForegroundColor Green
} finally {
  if ($piMaintenanceEnabledByDeploy -and -not $piMaintenanceDisabledAfterDeploy) {
    Write-Warning "Deploy tamamlanmadigi icin Pi bakim modu acik birakildi. Tenant Console'dan veya deploy tekrar calisinca kapatilabilir."
  }
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
