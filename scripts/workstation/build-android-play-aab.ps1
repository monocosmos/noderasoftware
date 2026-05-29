param(
  [string] $OutputAab = "",
  [switch] $SkipGradleBuild
)

$ErrorActionPreference = "Stop"

$root = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$androidDir = Join-Path $root "apps\android"
$defaultOutputAab = Join-Path $root "apps\android\app\build\outputs\bundle\playRelease\HotelOps-Play-V1.aab"
$keystorePath = Join-Path $root "secrets\hotelops-android-release.jks"
$privatePropsPath = Join-Path $root "secrets\android-keystore.properties"
$privateHandoffPath = Join-Path $root "docs\CODEX_PRIVATE_HANDOFF.local.md"
$playGoogleServicesPath = Join-Path $androidDir "app\src\play\google-services.json"
$keyAlias = "hotelops"

if (-not $OutputAab) {
  $OutputAab = $defaultOutputAab
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

if (-not (Test-Path -LiteralPath $androidDir)) {
  throw "Android kaynak klasoru bulunamadi: $androidDir"
}

if (-not (Test-Path -LiteralPath $keystorePath)) {
  throw "Release keystore bulunamadi: $keystorePath"
}

if (-not (Test-Path -LiteralPath $playGoogleServicesPath)) {
  throw "Play Store Firebase dosyasi bulunamadi: $playGoogleServicesPath. Firebase Console'da com.noderasoftware.hotelops paketli Android app ekleyip google-services.json dosyasini buraya koy."
}

$credentials = Get-KeystoreCredentials

Write-Host "==> Android Play Store AAB build basliyor" -ForegroundColor Cyan
Write-Host "Android kaynak: $androidDir"
Write-Host "Kanal: play AAB"
Write-Host "Paket: com.noderasoftware.hotelops"
Write-Host "Keystore: $keystorePath"

if (-not $SkipGradleBuild) {
  Push-Location $androidDir
  try {
    & .\gradlew.bat :app:bundlePlayRelease
    if ($LASTEXITCODE -ne 0) {
      throw "Gradle play release bundle build basarisiz oldu."
    }
  } finally {
    Pop-Location
  }
}

$unsignedAab = Join-Path $androidDir "app\build\outputs\bundle\playRelease\app-play-release.aab"
if (-not (Test-Path -LiteralPath $unsignedAab)) {
  throw "Play release AAB bulunamadi: $unsignedAab"
}

New-Item -ItemType Directory -Path (Split-Path -Parent $OutputAab) -Force | Out-Null
Copy-Item -LiteralPath $unsignedAab -Destination $OutputAab -Force

& jarsigner `
  -keystore $keystorePath `
  -storepass $credentials["storePassword"] `
  -keypass $credentials["keyPassword"] `
  -signedjar $OutputAab `
  $unsignedAab `
  $keyAlias
if ($LASTEXITCODE -ne 0) {
  throw "AAB imzalama basarisiz oldu."
}

& jarsigner -verify -strict $OutputAab
if ($LASTEXITCODE -ne 0) {
  throw "AAB imza dogrulamasi basarisiz oldu."
}

$hash = Get-FileHash -Algorithm SHA256 -LiteralPath $OutputAab

Write-Host ""
Write-Host "Android Play Store AAB hazir:" -ForegroundColor Green
Write-Host $OutputAab
Write-Host "SHA256: $($hash.Hash)"
