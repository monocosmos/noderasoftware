param(
  [switch] $SkipTypecheck
)

$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
Set-Location $root

Write-Host "==> API build" -ForegroundColor Cyan
npm.cmd run build --workspace @hotel-ops/api

if (-not $SkipTypecheck) {
  Write-Host "==> Web typecheck" -ForegroundColor Cyan
  npm.cmd run typecheck --workspace @hotel-ops/web
}

Write-Host "==> Web build/export" -ForegroundColor Cyan
npm.cmd run build --workspace @hotel-ops/web

Write-Host ""
Write-Host "Lokal build hazir." -ForegroundColor Green
