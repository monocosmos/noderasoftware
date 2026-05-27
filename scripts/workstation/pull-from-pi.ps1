param(
  [switch] $SkipLocalBackup
)

$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$script = Join-Path $root "scripts\pi\sync-from-pi.ps1"

$args = @(
  "-NoProfile",
  "-ExecutionPolicy",
  "Bypass",
  "-File",
  $script,
  "-PiHost",
  "noderapi"
)

if ($SkipLocalBackup) { $args += "-SkipLocalBackup" }

& powershell.exe @args
