param(
  [switch] $IncludeDownloads,
  [switch] $SkipBuild,
  [switch] $InstallDependencies,
  [switch] $PushDatabaseSchema,
  [switch] $SkipLocalPiBackup
)

$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$script = Join-Path $root "scripts\pi\deploy-built-to-pi.ps1"

$args = @(
  "-NoProfile",
  "-ExecutionPolicy",
  "Bypass",
  "-File",
  $script,
  "-PiHost",
  "noderapi"
)

if ($SkipBuild) { $args += "-SkipBuild" }
if ($IncludeDownloads) { $args += "-IncludeDownloads" }
if ($InstallDependencies) { $args += "-InstallDependencies" }
if ($PushDatabaseSchema) { $args += "-PushDatabaseSchema" }
if ($SkipLocalPiBackup) { $args += "-SkipLocalPiBackup" }

& powershell.exe @args
