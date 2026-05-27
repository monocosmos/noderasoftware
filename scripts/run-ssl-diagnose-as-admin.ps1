$ErrorActionPreference = "Stop"

$script = Join-Path $PSScriptRoot "diagnose-ssl-bindings.ps1"
$arguments = @(
  "-NoProfile",
  "-ExecutionPolicy",
  "Bypass",
  "-File",
  "`"$script`""
)

Start-Process powershell.exe -Verb RunAs -ArgumentList $arguments
