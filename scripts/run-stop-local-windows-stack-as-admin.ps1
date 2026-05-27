$ErrorActionPreference = "Stop"

$script = Join-Path $PSScriptRoot "stop-local-windows-stack.ps1"
$arguments = @(
  "-NoProfile",
  "-ExecutionPolicy",
  "Bypass",
  "-File",
  "`"$script`""
)

Start-Process powershell.exe -Verb RunAs -ArgumentList $arguments -Wait
