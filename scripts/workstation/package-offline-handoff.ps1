param(
  [string] $OutputPath = ""
)

$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$parent = Split-Path -Parent $root

if (-not $OutputPath) {
  $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
  $OutputPath = Join-Path $parent "noderasoftware-offline-handoff-$stamp.zip"
}

$resolvedOutput = if ([System.IO.Path]::IsPathRooted($OutputPath)) {
  $OutputPath
} else {
  Join-Path $parent $OutputPath
}

$tempRoot = Join-Path $env:TEMP ("noderasoftware-offline-handoff-" + [guid]::NewGuid().ToString("N"))
$stageRoot = Join-Path $tempRoot "noderasoftware"

function Should-SkipPath {
  param([string] $RelativePath)

  $normalized = $RelativePath.Replace("\", "/")
  $skipPrefixes = @(
    "node_modules/",
    ".next/",
    "out/",
    "dist/",
    "build/",
    ".cache/",
    ".config/",
    ".npm/",
    "apps/api/dist/",
    "apps/web/.next/",
    "apps/web/out/",
    "apps/desktop/release/",
    "mac-artifacts/",
    "_android_review/",
    "_local-backups/"
  )

  foreach ($prefix in $skipPrefixes) {
    if ($normalized.StartsWith($prefix, [System.StringComparison]::OrdinalIgnoreCase)) {
      return $true
    }
  }

  $name = Split-Path -Leaf $normalized
  if ($name -like "*.log" -or $name -like "*.err" -or $name -like "*.tsbuildinfo") {
    return $true
  }

  return $false
}

function Get-RelativePathCompat {
  param(
    [string] $BasePath,
    [string] $FullPath
  )

  $base = (Resolve-Path -LiteralPath $BasePath).Path.TrimEnd("\") + "\"
  $full = (Resolve-Path -LiteralPath $FullPath).Path
  if ($full.StartsWith($base, [System.StringComparison]::OrdinalIgnoreCase)) {
    return $full.Substring($base.Length)
  }

  throw "Path root disinda: $FullPath"
}

if (Test-Path $tempRoot) {
  Remove-Item -LiteralPath $tempRoot -Recurse -Force
}

New-Item -ItemType Directory -Path $stageRoot -Force | Out-Null

Write-Host "==> Offline handoff paketi hazirlaniyor" -ForegroundColor Cyan
Write-Host "Kaynak: $root"

Get-ChildItem -LiteralPath $root -Force | ForEach-Object {
  $item = $_
  $relative = $item.Name
  if (Should-SkipPath $relative) {
    return
  }

  $destination = Join-Path $stageRoot $relative
  if ($item.PSIsContainer) {
    Get-ChildItem -LiteralPath $item.FullName -Recurse -Force | ForEach-Object {
      $childRelative = Get-RelativePathCompat -BasePath $root -FullPath $_.FullName
      if (Should-SkipPath $childRelative) {
        return
      }

      $childDestination = Join-Path $stageRoot $childRelative
      if ($_.PSIsContainer) {
        New-Item -ItemType Directory -Path $childDestination -Force | Out-Null
      } else {
        New-Item -ItemType Directory -Path (Split-Path -Parent $childDestination) -Force | Out-Null
        Copy-Item -LiteralPath $_.FullName -Destination $childDestination -Force
      }
    }
  } else {
    Copy-Item -LiteralPath $item.FullName -Destination $destination -Force
  }
}

if (Test-Path $resolvedOutput) {
  Remove-Item -LiteralPath $resolvedOutput -Force
}

Compress-Archive -Path (Join-Path $stageRoot "*") -DestinationPath $resolvedOutput -Force

$sizeMb = ((Get-Item -LiteralPath $resolvedOutput).Length / 1MB)
$hash = Get-FileHash -Algorithm SHA256 -LiteralPath $resolvedOutput

Write-Host ""
Write-Host "Offline handoff paketi hazir:" -ForegroundColor Green
Write-Host $resolvedOutput
Write-Host ("Boyut: {0:N2} MB" -f $sizeMb)
Write-Host "SHA256: $($hash.Hash)"

Remove-Item -LiteralPath $tempRoot -Recurse -Force
