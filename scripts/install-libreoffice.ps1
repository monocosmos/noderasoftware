$ErrorActionPreference = "Stop"

$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($identity)
$isAdmin = $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
  throw "This script must be run as Administrator."
}

$lock = "C:\ProgramData\chocolatey\lib\8fcf9d36b997a9b63e0eaf47994c8bee650c55ee"
if (Test-Path -LiteralPath $lock) {
  Remove-Item -LiteralPath $lock -Force -ErrorAction SilentlyContinue
}

choco install libreoffice-still --yes --no-progress
