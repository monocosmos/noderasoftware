param(
  [ValidateSet("all", "installer", "portable")]
  [string] $Target = "all",
  [switch] $CopyToWebDownloads
)

$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$desktopDir = Join-Path $root "apps\desktop"
$releaseDir = Join-Path $desktopDir "release"
$unpackedDir = Join-Path $releaseDir "win-unpacked"
$desktopExe = Join-Path $unpackedDir "HotelOps Desktop.exe"
$desktopIcon = Join-Path $desktopDir "build\icon.ico"

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

function Resolve-Rcedit {
  $cacheRoot = Join-Path $env:LOCALAPPDATA "electron-builder\Cache\winCodeSign"
  if (Test-Path -LiteralPath $cacheRoot) {
    $cached = Get-ChildItem -LiteralPath $cacheRoot -Recurse -Filter rcedit-x64.exe -ErrorAction SilentlyContinue |
      Sort-Object LastWriteTime -Descending |
      Select-Object -First 1
    if ($cached) { return $cached.FullName }
  }

  $fallback = Join-Path $root "node_modules\electron-winstaller\vendor\rcedit.exe"
  if (Test-Path -LiteralPath $fallback) { return $fallback }

  throw "rcedit bulunamadi. Once electron-builder cache'i olusturulmali veya node_modules kurulmalidir."
}

function Invoke-NpmDesktop {
  param([string[]] $Arguments)

  Push-Location $root
  try {
    & npm.cmd @Arguments
    if ($LASTEXITCODE -ne 0) {
      throw "npm komutu basarisiz oldu: npm $($Arguments -join ' ')"
    }
  } finally {
    Pop-Location
  }
}

function Get-DesktopAppVersionCode {
  $preloadPath = Join-Path $desktopDir "src\preload.cjs"
  $mainPath = Join-Path $desktopDir "src\main.cjs"
  $preloadContent = Get-Content -LiteralPath $preloadPath -Raw
  $mainContent = Get-Content -LiteralPath $mainPath -Raw

  if ($preloadContent -notmatch "const\s+appVersionCode\s*=\s*(\d+)\s*;") {
    throw "Desktop appVersionCode bulunamadi: $preloadPath"
  }
  $preloadCode = [int] $Matches[1]

  if ($mainContent -notmatch "const\s+DESKTOP_APP_BUILD\s*=\s*(\d+)\s*;") {
    throw "Desktop DESKTOP_APP_BUILD bulunamadi: $mainPath"
  }
  $mainCode = [int] $Matches[1]

  if ($preloadCode -ne $mainCode) {
    throw "Desktop surum kodlari eslesmiyor. preload=$preloadCode main=$mainCode"
  }

  return $preloadCode
}

function Update-DesktopAppVersionManifest {
  param(
    [Parameter(Mandatory = $true)]
    [string] $Version,

    [Parameter(Mandatory = $true)]
    [int] $VersionCode
  )

  $manifestPaths = @(
    Join-Path $root "apps\web\public\app-version.json",
    Join-Path $root "apps\web\out\app-version.json"
  )

  foreach ($manifestPath in $manifestPaths) {
    if (-not (Test-Path -LiteralPath $manifestPath)) {
      throw "App version manifest bulunamadi: $manifestPath"
    }

    $manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
    if (-not $manifest.platforms -or -not $manifest.platforms.desktop) {
      throw "Desktop platform bilgisi app-version.json icinde bulunamadi: $manifestPath"
    }

    $manifest.updatedAt = (Get-Date).ToString("yyyy-MM-ddTHH:mm:sszzz")
    $manifest.platforms.desktop.latestVersion = $Version
    $manifest.platforms.desktop.latestCode = $VersionCode
    $manifest.platforms.desktop.minimumCode = $VersionCode
    $manifest.platforms.desktop.downloadUrl = "/downloads/HotelOps-Setup-V1-x64.exe"

    $json = $manifest | ConvertTo-Json -Depth 20
    Write-Utf8NoBomFile -Path $manifestPath -Content ($json + "`n")
  }

  Write-Host "Desktop app-version manifest guncellendi: $Version / code $VersionCode"
}

if (-not (Test-Path -LiteralPath $desktopIcon)) {
  throw "Desktop icon bulunamadi: $desktopIcon"
}

$env:CSC_IDENTITY_AUTO_DISCOVERY = "false"

Invoke-NpmDesktop @("run", "pack", "--workspace", "@hotel-ops/desktop", "--", "--config.win.signAndEditExecutable=false")

if (-not (Test-Path -LiteralPath $desktopExe)) {
  throw "Unpacked desktop exe bulunamadi: $desktopExe"
}

$packageJson = Get-Content -LiteralPath (Join-Path $desktopDir "package.json") -Raw | ConvertFrom-Json
$version = [string] $packageJson.version
$versionCode = Get-DesktopAppVersionCode
$rcedit = Resolve-Rcedit

& $rcedit $desktopExe `
  --set-icon $desktopIcon `
  --set-version-string FileDescription "HotelOps Desktop" `
  --set-version-string ProductName "HotelOps Desktop" `
  --set-version-string CompanyName "Nodera Software" `
  --set-version-string LegalCopyright "Copyright (C) 2026 Nodera Software" `
  --set-file-version $version `
  --set-product-version $version
if ($LASTEXITCODE -ne 0) {
  throw "rcedit icon/metadata guncellemesi basarisiz oldu."
}

$metadata = Get-Item -LiteralPath $desktopExe
if ($metadata.VersionInfo.ProductVersion -ne $version -or $metadata.VersionInfo.CompanyName -ne "Nodera Software") {
  throw "Desktop exe metadata dogrulamasi basarisiz oldu."
}

$baseArgs = @(
  "exec",
  "--workspace",
  "@hotel-ops/desktop",
  "--",
  "electron-builder"
)

$packagedArgs = @(
  "--prepackaged",
  $unpackedDir,
  "--config.win.signAndEditExecutable=false"
)

if ($Target -eq "all" -or $Target -eq "installer") {
  Invoke-NpmDesktop ($baseArgs + @("--win", "nsis") + $packagedArgs + @('--config.win.artifactName=HotelOps-Setup-V1-${arch}.${ext}', "--config.nsis.installerIcon=build/icon.ico", "--config.nsis.uninstallerIcon=build/icon.ico"))
}

if ($Target -eq "all" -or $Target -eq "portable") {
  Invoke-NpmDesktop ($baseArgs + @("--win", "portable") + $packagedArgs + @('--config.win.artifactName=HotelOps-Portable-V1-${arch}.${ext}'))
}

if ($CopyToWebDownloads) {
  $downloads = @(
    "HotelOps-Setup-V1-x64.exe",
    "HotelOps-Portable-V1-x64.exe"
  )
  foreach ($download in $downloads) {
    $source = Join-Path $releaseDir $download
    if (-not (Test-Path -LiteralPath $source)) { throw "Build output bulunamadi: $source" }
    Copy-Item -LiteralPath $source -Destination (Join-Path $root "apps\web\public\downloads\$download") -Force
    Copy-Item -LiteralPath $source -Destination (Join-Path $root "apps\web\out\downloads\$download") -Force
  }

  Update-DesktopAppVersionManifest -Version $version -VersionCode $versionCode
}

Write-Host "Windows desktop release build tamamlandi. Icon/metadata: Nodera Software $version"
