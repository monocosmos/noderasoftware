param(
  [string] $VideoWallRoot = "C:\Users\hfk47\Belgeler\HotelVideoWall",
  [switch] $SkipOutCopy
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$root = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$releaseDir = Join-Path $VideoWallRoot "releases"
$publicDownloads = Join-Path $root "apps\web\public\downloads"
$outDownloads = Join-Path $root "apps\web\out\downloads"

function Resolve-RequiredFile {
  param(
    [Parameter(Mandatory = $true)]
    [string[]] $Candidates,

    [Parameter(Mandatory = $true)]
    [string] $Description
  )

  foreach ($candidate in $Candidates) {
    if (Test-Path -LiteralPath $candidate -PathType Leaf) {
      $item = Get-Item -LiteralPath $candidate
      if ($item.Length -le 0) {
        throw "$Description bos dosya: $candidate"
      }
      return $item
    }
  }

  throw "$Description bulunamadi. Aranan adaylar: $($Candidates -join ', ')"
}

function Copy-ReleaseFile {
  param(
    [Parameter(Mandatory = $true)]
    [System.IO.FileInfo] $Source,

    [Parameter(Mandatory = $true)]
    [string] $TargetDirectory,

    [Parameter(Mandatory = $true)]
    [string] $TargetName
  )

  New-Item -ItemType Directory -Path $TargetDirectory -Force | Out-Null
  $target = Join-Path $TargetDirectory $TargetName
  Copy-Item -LiteralPath $Source.FullName -Destination $target -Force

  $copied = Get-Item -LiteralPath $target
  if ($copied.Length -ne $Source.Length) {
    throw "Kopya boyutu eslesmedi: $target"
  }

  Write-Host "    $($Source.Name) -> $target ($($copied.Length) bytes)" -ForegroundColor DarkGreen
}

if (-not (Test-Path -LiteralPath $releaseDir -PathType Container)) {
  throw "VideoWallPlayer releases klasoru bulunamadi: $releaseDir"
}

$releaseFiles = @(
  @{
    Description = "VideoWallPlayer Windows setup"
    Source = Resolve-RequiredFile `
      -Description "VideoWallPlayer Windows setup" `
      -Candidates @((Join-Path $releaseDir "VideoWallPlayer-Windows-Setup-x64.exe"))
    TargetName = "VideoWallPlayer-Windows-Setup-x64.exe"
  },
  @{
    Description = "VideoWallPlayer Windows portable"
    Source = Resolve-RequiredFile `
      -Description "VideoWallPlayer Windows portable" `
      -Candidates @((Join-Path $releaseDir "VideoWallPlayer-Windows-Portable-x64.zip"))
    TargetName = "VideoWallPlayer-Windows-Portable-x64.zip"
  },
  @{
    Description = "VideoWallPlayer Android APK"
    Source = Resolve-RequiredFile `
      -Description "VideoWallPlayer Android APK" `
      -Candidates @(
        (Join-Path $releaseDir "VideoWallPlayer-Android.apk"),
        (Join-Path $releaseDir "VideoWallPlayer-Android-debug.apk")
      )
    TargetName = "VideoWallPlayer-Android.apk"
  }
)

Write-Host "==> VideoWallPlayer release dosyalari site downloads alanina isleniyor" -ForegroundColor Cyan
foreach ($releaseFile in $releaseFiles) {
  Copy-ReleaseFile -Source $releaseFile.Source -TargetDirectory $publicDownloads -TargetName $releaseFile.TargetName
}

if (-not $SkipOutCopy -and (Test-Path -LiteralPath $outDownloads -PathType Container)) {
  Write-Host "==> Mevcut static out downloads alanina da kopyalaniyor" -ForegroundColor Cyan
  foreach ($releaseFile in $releaseFiles) {
    Copy-ReleaseFile -Source $releaseFile.Source -TargetDirectory $outDownloads -TargetName $releaseFile.TargetName
  }
}

Write-Host "VideoWallPlayer release import tamamlandi." -ForegroundColor Green
