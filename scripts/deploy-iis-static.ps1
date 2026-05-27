$ErrorActionPreference = "Stop"

$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($identity)
$isAdmin = $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
  throw "This script must be run as Administrator."
}

$projectRoot = Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")
$source = Resolve-Path -LiteralPath (Join-Path $projectRoot "apps\web\out")
$target = Resolve-Path -LiteralPath "C:\inetpub\wwwroot"
$expectedTarget = [System.IO.Path]::GetFullPath("C:\inetpub\wwwroot")

if ($target.Path.TrimEnd("\") -ne $expectedTarget.TrimEnd("\")) {
  throw "Unexpected target path: $($target.Path)"
}

$backupRoot = "C:\inetpub\wwwroot-backups"
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backup = Join-Path $backupRoot "aspnet-$stamp"

New-Item -ItemType Directory -Path $backup -Force | Out-Null

Write-Host "Backing up current IIS site to $backup"
Get-ChildItem -LiteralPath $target.Path -Force | ForEach-Object {
  Copy-Item -LiteralPath $_.FullName -Destination $backup -Recurse -Force
}

Write-Host "Clearing $($target.Path)"
Get-ChildItem -LiteralPath $target.Path -Force | ForEach-Object {
  $resolvedChild = [System.IO.Path]::GetFullPath($_.FullName)
  if (-not $resolvedChild.StartsWith($expectedTarget, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing to remove outside target: $resolvedChild"
  }
  Remove-Item -LiteralPath $_.FullName -Recurse -Force
}

Write-Host "Publishing static output from $($source.Path)"
Get-ChildItem -LiteralPath $source.Path -Force | ForEach-Object {
  Copy-Item -LiteralPath $_.FullName -Destination $target.Path -Recurse -Force
}

Write-Host "Done."
Write-Host "Backup: $backup"
Write-Host "Published: $($source.Path) -> $($target.Path)"
