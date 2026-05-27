$ErrorActionPreference = "Stop"

$script = Join-Path $PSScriptRoot "apply-live-canonical-https.ps1"
$arguments = @(
  "-NoProfile",
  "-ExecutionPolicy",
  "Bypass",
  "-File",
  "`"$script`""
)

Start-Process powershell.exe -Verb RunAs -ArgumentList $arguments
