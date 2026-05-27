$ErrorActionPreference = "Stop"

$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($identity)
$isAdmin = $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
  throw "This script must be run as Administrator."
}

$lock = "C:\ProgramData\chocolatey\lib\5afc917dd1f2c278e34b4aee307e0748b9620e0a"
if (Test-Path -LiteralPath $lock) {
  Remove-Item -LiteralPath $lock -Force
}

choco install postgresql --yes --no-progress --params "'/Password:hotelops /Port:5432'"
