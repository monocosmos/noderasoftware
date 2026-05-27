$ErrorActionPreference = "Stop"

$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($identity)
$isAdmin = $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
  throw "This script must be run as Administrator."
}

$pgRoot = "C:\Program Files\PostgreSQL\18"
$pgCtl = Join-Path $pgRoot "bin\pg_ctl.exe"
$data = Join-Path $pgRoot "data"
$serviceName = "postgresql-x64-18"
$projectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
$logFile = Join-Path $projectRoot "postgres-start.log"

"Starting PostgreSQL check at $(Get-Date -Format o)" | Set-Content -Path $logFile

$service = Get-CimInstance Win32_Service -Filter "Name='$serviceName'" -ErrorAction SilentlyContinue
if (-not $service) {
  "Service not registered. Registering $serviceName" | Add-Content -Path $logFile
  & $pgCtl register -N $serviceName -D $data -S auto 2>&1 | Add-Content -Path $logFile
}

$service = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
if (-not $service) {
  throw "PostgreSQL service could not be found after registration."
}

if ($service.Status -ne "Running") {
  try {
    Start-Service -Name $serviceName
  } catch {
    "Start-Service failed: $($_.Exception.Message)" | Add-Content -Path $logFile
    "Trying pg_ctl start for diagnostics" | Add-Content -Path $logFile
    & $pgCtl start -D $data -l (Join-Path $pgRoot "data\server.log") 2>&1 | Add-Content -Path $logFile
  }
  Start-Sleep -Seconds 5
}

Get-Service -Name $serviceName | Select-Object Name,Status,DisplayName | Format-List | Out-String | Add-Content -Path $logFile

$serverLog = Join-Path $pgRoot "data\server.log"
if (Test-Path -LiteralPath $serverLog) {
  "----- server.log tail -----" | Add-Content -Path $logFile
  Get-Content -LiteralPath $serverLog -Tail 60 | Add-Content -Path $logFile
}
