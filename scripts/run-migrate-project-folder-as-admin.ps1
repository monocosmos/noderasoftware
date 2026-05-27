$ErrorActionPreference = "Stop"

$script = Join-Path $PSScriptRoot "migrate-project-folder.ps1"
$arguments = @(
  "-NoProfile",
  "-ExecutionPolicy",
  "Bypass",
  "-File",
  "`"$script`""
)

Start-Process powershell.exe -Verb RunAs -WorkingDirectory "C:\Users\hfk47\Documents" -ArgumentList $arguments
