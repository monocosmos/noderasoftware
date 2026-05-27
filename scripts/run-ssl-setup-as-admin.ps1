$ErrorActionPreference = "Stop"

$script = Join-Path $PSScriptRoot "setup-ssl-win-acme.ps1"
$arguments = @(
  "-NoProfile",
  "-ExecutionPolicy",
  "Bypass",
  "-File",
  "`"$script`""
)

Start-Process powershell.exe -Verb RunAs -ArgumentList $arguments
