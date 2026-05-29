param(
  [string] $OutputApk = "",
  [switch] $SkipGradleBuild
)

$ErrorActionPreference = "Stop"

$root = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$androidDir = Join-Path $root "apps\android"
$defaultOutputApk = Join-Path $root "apps\web\public\downloads\HotelOps-Android-V1.apk"
$keystorePath = Join-Path $root "secrets\hotelops-android-release.jks"
$privatePropsPath = Join-Path $root "secrets\android-keystore.properties"
$privateHandoffPath = Join-Path $root "docs\CODEX_PRIVATE_HANDOFF.local.md"

$keyAlias = "hotelops"
$expectedCertSha256 = "8111440efb2d6b13e7bf548acee01f64f1f10df31b9698939af88ec6cf12d5ff"

# Bundan sonraki tum APK'lar ayni keystore ile imzalanmali. Beklenen sertifika
# hash'i kontrol edilmezse Android cihazlar guncellemeyi farkli uygulama sanabilir.
if (-not $OutputApk) {
  $OutputApk = $defaultOutputApk
}

function Convert-AndroidSdkPath {
  param([string] $PathValue)

  if (-not $PathValue) {
    return $null
  }

  return ($PathValue.Trim() -replace "\\:", ":" -replace "\\\\", "\")
}

function Read-PropertiesFile {
  param([string] $Path)

  $result = @{}
  if (-not (Test-Path -LiteralPath $Path)) {
    return $result
  }

  Get-Content -LiteralPath $Path | ForEach-Object {
    $line = $_.Trim()
    if (-not $line -or $line.StartsWith("#")) {
      return
    }

    $parts = $line.Split("=", 2)
    if ($parts.Count -eq 2) {
      $result[$parts[0].Trim()] = $parts[1].Trim()
    }
  }

  return $result
}

function Read-PrivateHandoffPasswords {
  $result = @{}
  if (-not (Test-Path -LiteralPath $privateHandoffPath)) {
    return $result
  }

  $text = Get-Content -LiteralPath $privateHandoffPath -Raw
  if ($text -match "(?im)^store password:\s*(.+)$") {
    $result["storePassword"] = $Matches[1].Trim()
  }

  if ($text -match "(?im)^key password:\s*(.+)$") {
    $result["keyPassword"] = $Matches[1].Trim()
  }

  return $result
}

function ConvertFrom-SecureStringPlainText {
  param([securestring] $SecureString)

  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecureString)
  try {
    return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
  } finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
  }
}

function Get-KeystoreCredentials {
  $props = Read-PropertiesFile -Path $privatePropsPath

  if (-not $props["storePassword"] -or -not $props["keyPassword"]) {
    $handoff = Read-PrivateHandoffPasswords
    foreach ($key in $handoff.Keys) {
      if (-not $props[$key]) {
        $props[$key] = $handoff[$key]
      }
    }
  }

  if ($env:HOTELOPS_ANDROID_KEYSTORE_PASSWORD) {
    $props["storePassword"] = $env:HOTELOPS_ANDROID_KEYSTORE_PASSWORD
    $props["keyPassword"] = $env:HOTELOPS_ANDROID_KEYSTORE_PASSWORD
  }

  if ($env:HOTELOPS_ANDROID_KEY_PASSWORD) {
    $props["keyPassword"] = $env:HOTELOPS_ANDROID_KEY_PASSWORD
  }

  if (-not $props["storePassword"]) {
    $props["storePassword"] = ConvertFrom-SecureStringPlainText (Read-Host "Android keystore store password" -AsSecureString)
  }

  if (-not $props["keyPassword"]) {
    $props["keyPassword"] = ConvertFrom-SecureStringPlainText (Read-Host "Android keystore key password" -AsSecureString)
  }

  return $props
}

function Resolve-AndroidSdk {
  $candidates = @(
    $env:ANDROID_HOME,
    $env:ANDROID_SDK_ROOT
  )

  $localPropertiesPath = Join-Path $androidDir "local.properties"
  if (Test-Path -LiteralPath $localPropertiesPath) {
    Get-Content -LiteralPath $localPropertiesPath | ForEach-Object {
      if ($_ -match "^sdk\.dir=(.+)$") {
        $script:sdkFromLocalProperties = Convert-AndroidSdkPath $Matches[1]
      }
    }
  }

  if ($script:sdkFromLocalProperties) {
    $candidates += $script:sdkFromLocalProperties
  }

  $candidates += (Join-Path $env:LOCALAPPDATA "Android\Sdk")

  foreach ($candidate in $candidates) {
    if ($candidate -and (Test-Path -LiteralPath $candidate)) {
      return (Resolve-Path -LiteralPath $candidate).Path
    }
  }

  throw "Android SDK bulunamadi. ANDROID_HOME ayarla veya apps\android\local.properties icindeki sdk.dir degerini kontrol et."
}

function Resolve-BuildTool {
  param(
    [string] $SdkRoot,
    [string] $ToolName
  )

  $buildToolsRoot = Join-Path $SdkRoot "build-tools"
  if (-not (Test-Path -LiteralPath $buildToolsRoot)) {
    throw "Android build-tools klasoru bulunamadi: $buildToolsRoot"
  }

  $toolDirs = Get-ChildItem -LiteralPath $buildToolsRoot -Directory | Sort-Object Name -Descending
  foreach ($dir in $toolDirs) {
    $candidate = Join-Path $dir.FullName $ToolName
    if (Test-Path -LiteralPath $candidate) {
      return $candidate
    }
  }

  throw "$ToolName Android build-tools icinde bulunamadi: $buildToolsRoot"
}

function Ensure-AndroidLocalProperties {
  param([string] $SdkRoot)

  $localPropertiesPath = Join-Path $androidDir "local.properties"
  $sdkForGradle = $SdkRoot.Replace("\", "/")
  $expectedLine = "sdk.dir=$sdkForGradle"

  $shouldWrite = $true
  if (Test-Path -LiteralPath $localPropertiesPath) {
    $currentText = Get-Content -LiteralPath $localPropertiesPath -Raw
    if ($currentText -match "(?m)^sdk\.dir=(.+)$") {
      $currentSdk = Convert-AndroidSdkPath $Matches[1]
      if ($currentSdk -and (Test-Path -LiteralPath $currentSdk)) {
        $shouldWrite = $false
      }
    }
  }

  if ($shouldWrite) {
    Set-Content -LiteralPath $localPropertiesPath -Value $expectedLine -Encoding ASCII
  }
}

if (-not (Test-Path -LiteralPath $androidDir)) {
  throw "Android kaynak klasoru bulunamadi: $androidDir"
}

if (-not (Test-Path -LiteralPath $keystorePath)) {
  throw "Release keystore bulunamadi: $keystorePath"
}

$sdkRoot = Resolve-AndroidSdk
Ensure-AndroidLocalProperties -SdkRoot $sdkRoot
$zipalign = Resolve-BuildTool -SdkRoot $sdkRoot -ToolName "zipalign.exe"
$apksigner = Resolve-BuildTool -SdkRoot $sdkRoot -ToolName "apksigner.bat"
$credentials = Get-KeystoreCredentials

Write-Host "==> Android APK build basliyor" -ForegroundColor Cyan
Write-Host "Android kaynak: $androidDir"
Write-Host "Kanal: direct APK"
Write-Host "Keystore: $keystorePath"
Write-Host "Beklenen sertifika: $expectedCertSha256"

if (-not $SkipGradleBuild) {
  Push-Location $androidDir
  try {
    & .\gradlew.bat :app:assembleDirectRelease
    if ($LASTEXITCODE -ne 0) {
      throw "Gradle direct release build basarisiz oldu."
    }
  } finally {
    Pop-Location
  }
}

$unsignedApk = Join-Path $androidDir "app\build\outputs\apk\direct\release\app-direct-release-unsigned.apk"
if (-not (Test-Path -LiteralPath $unsignedApk)) {
  throw "Unsigned release APK bulunamadi: $unsignedApk"
}

$releaseDir = Split-Path -Parent $unsignedApk
$alignedApk = Join-Path $releaseDir "HotelOps-Android-V1-aligned.apk"
$signedApk = Join-Path $releaseDir "HotelOps-Android-V1-signed.apk"

Remove-Item -LiteralPath $alignedApk, $signedApk -Force -ErrorAction SilentlyContinue

& $zipalign -f -p 4 $unsignedApk $alignedApk
if ($LASTEXITCODE -ne 0) {
  throw "zipalign basarisiz oldu."
}

& $apksigner sign `
  --ks $keystorePath `
  --ks-key-alias $keyAlias `
  --ks-pass "pass:$($credentials["storePassword"])" `
  --key-pass "pass:$($credentials["keyPassword"])" `
  --out $signedApk `
  $alignedApk
if ($LASTEXITCODE -ne 0) {
  throw "apksigner sign basarisiz oldu."
}

$verifyOutput = & $apksigner verify --print-certs $signedApk 2>&1
if ($LASTEXITCODE -ne 0) {
  $verifyText = $verifyOutput -join "`n"
  throw "APK imza dogrulamasi basarisiz oldu.`n$verifyText"
}

$verifyText = $verifyOutput -join "`n"
$normalizedVerifyText = ($verifyText -replace "[^0-9a-fA-F]", "").ToLowerInvariant()
if (-not $normalizedVerifyText.Contains($expectedCertSha256)) {
  throw "APK dogrulandi ama beklenen release sertifikasi kullanilmadi. Yayin kopyasi yapilmadi."
}

New-Item -ItemType Directory -Path (Split-Path -Parent $OutputApk) -Force | Out-Null
Copy-Item -LiteralPath $signedApk -Destination $OutputApk -Force

$hash = Get-FileHash -Algorithm SHA256 -LiteralPath $OutputApk

Write-Host ""
Write-Host "Android APK hazir:" -ForegroundColor Green
Write-Host $OutputApk
Write-Host "SHA256: $($hash.Hash)"
Write-Host "Imza sertifikasi: $expectedCertSha256"
