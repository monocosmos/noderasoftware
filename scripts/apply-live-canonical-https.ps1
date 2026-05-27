$ErrorActionPreference = "Stop"

$projectRoot = Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")
$source = Join-Path $projectRoot "apps\web\public\Web.config"
$target = "C:\inetpub\wwwroot\Web.config"
$backupDir = "C:\inetpub\wwwroot-backups"
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backup = Join-Path $backupDir "webconfig-before-ssl-$stamp.config"

$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($identity)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  throw "This script must be run as Administrator."
}

if (-not (Test-Path -LiteralPath $source)) {
  throw "Source Web.config not found: $source"
}

New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
Copy-Item -LiteralPath $target -Destination $backup -Force
Copy-Item -LiteralPath $source -Destination $target -Force

iisreset

Write-Host "Applied canonical HTTPS Web.config"
Write-Host "Backup: $backup"
