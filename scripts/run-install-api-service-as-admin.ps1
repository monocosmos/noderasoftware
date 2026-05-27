$ErrorActionPreference = "Stop"

$script = Join-Path $PSScriptRoot "install-api-service.ps1"
$arguments = @(
  "-NoProfile",
  "-ExecutionPolicy",
  "Bypass",
  "-File",
  "`"$script`""
)

Start-Process powershell.exe -Verb RunAs -ArgumentList $arguments
