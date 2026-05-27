param(
  [switch] $SkipInstall
)

$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
Set-Location $root

if (-not $SkipInstall) {
  Write-Host "==> Paketler kontrol ediliyor" -ForegroundColor Cyan
  npm.cmd install
}

Write-Host "==> API ve Web local servisleri baslatiliyor" -ForegroundColor Cyan
Write-Host "    Web: http://127.0.0.1:3000/hotel/login"
Write-Host "    API: http://127.0.0.1:4000/health"

Start-Process powershell.exe -ArgumentList @(
  "-NoExit",
  "-NoProfile",
  "-ExecutionPolicy",
  "Bypass",
  "-Command",
  "cd '$root'; npm.cmd run api:dev"
) -WindowStyle Normal

Start-Process powershell.exe -ArgumentList @(
  "-NoExit",
  "-NoProfile",
  "-ExecutionPolicy",
  "Bypass",
  "-Command",
  "cd '$root'; npm.cmd run dev"
) -WindowStyle Normal
