$ErrorActionPreference = "Stop"

$script = Join-Path $PSScriptRoot "deploy-iis-static.ps1"
$arguments = @(
  "-NoProfile",
  "-ExecutionPolicy",
  "Bypass",
  "-File",
  "`"$script`""
)

Start-Process powershell.exe -Verb RunAs -ArgumentList $arguments
