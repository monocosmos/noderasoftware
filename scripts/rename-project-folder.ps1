$ErrorActionPreference = "Stop"

$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($identity)
$isAdmin = $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
  throw "This script must be run as Administrator."
}

$oldRoot = "C:\Users\hfk47\Documents\New project"
$newRoot = "C:\Users\hfk47\Documents\noderasoftware"
$parent = Split-Path -Parent $oldRoot
$logFile = Join-Path $parent "noderasoftware-rename.log"
$serviceName = "HotelOpsApi"

function Write-Log {
  param([string]$Message)
  $line = "$(Get-Date -Format o) $Message"
  Write-Host $line
  Add-Content -Path $logFile -Value $line
}

"Rename run started at $(Get-Date -Format o)" | Set-Content -Path $logFile

if ((Test-Path -LiteralPath $oldRoot) -and (Test-Path -LiteralPath $newRoot)) {
  throw "Both old and new project folders exist. Refusing to continue: $oldRoot / $newRoot"
}

Write-Log "Stopping API service/task if present."
$service = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
if ($service -and $service.Status -ne "Stopped") {
  Stop-Service -Name $serviceName -Force -ErrorAction SilentlyContinue
  Start-Sleep -Seconds 3
}

$task = Get-ScheduledTask -TaskName $serviceName -ErrorAction SilentlyContinue
if ($task) {
  Stop-ScheduledTask -TaskName $serviceName -ErrorAction SilentlyContinue
}

Get-NetTCPConnection -LocalPort 4000 -State Listen -ErrorAction SilentlyContinue | ForEach-Object {
  Write-Log "Stopping existing API listener PID $($_.OwningProcess)."
  Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue
}

if (Test-Path -LiteralPath $oldRoot) {
  Write-Log "Renaming project folder to $newRoot."
  Rename-Item -LiteralPath $oldRoot -NewName "noderasoftware"
} else {
  Write-Log "Old folder not found; assuming project is already renamed."
}

if (-not (Test-Path -LiteralPath $newRoot)) {
  throw "New project folder was not found after rename: $newRoot"
}

Write-Log "Reinstalling API service from the new project path."
& (Join-Path $newRoot "scripts\install-api-service.ps1")

Write-Log "Rename and service reinstall completed."
