param(
  [string] $Url = "https://noderasoftware.com/app-version.json"
)

$ErrorActionPreference = "Stop"

$response = Invoke-WebRequest -Uri $Url -UseBasicParsing -Headers @{
  "Cache-Control" = "no-cache"
  "Pragma" = "no-cache"
}

$contentType = [string] $response.Headers["Content-Type"]
if ($contentType -notmatch "application/json") {
  throw "app-version manifest JSON donmuyor. Content-Type: $contentType"
}

try {
  $manifest = $response.Content | ConvertFrom-Json
} catch {
  throw "app-version manifest parse edilemedi: $($_.Exception.Message)"
}

if (-not $manifest.platforms.desktop) {
  throw "app-version manifest icinde platforms.desktop yok"
}
if (-not $manifest.platforms.androidDirect) {
  throw "app-version manifest icinde platforms.androidDirect yok"
}
if (-not $manifest.platforms.androidPlay) {
  throw "app-version manifest icinde platforms.androidPlay yok"
}

foreach ($platformName in @("desktop", "androidDirect", "androidPlay")) {
  $platform = $manifest.platforms.$platformName
  if (-not ($platform.latestCode -is [int] -or $platform.latestCode -is [long])) {
    throw "$platformName latestCode sayisal degil"
  }
  if (-not $platform.downloadUrl) {
    throw "$platformName downloadUrl bos"
  }
}

[pscustomobject]@{
  Url = $Url
  UpdatedAt = $manifest.updatedAt
  DesktopLatestCode = $manifest.platforms.desktop.latestCode
  AndroidDirectLatestCode = $manifest.platforms.androidDirect.latestCode
  AndroidPlayLatestCode = $manifest.platforms.androidPlay.latestCode
}
