$ErrorActionPreference = "Stop"

$script = Join-Path $PSScriptRoot "rename-project-folder.ps1"
$arguments = @(
  "-NoProfile",
  "-ExecutionPolicy",
  "Bypass",
  "-File",
  "`"$script`""
)

Start-Process powershell.exe -Verb RunAs -ArgumentList $arguments
