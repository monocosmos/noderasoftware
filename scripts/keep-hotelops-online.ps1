$ErrorActionPreference = "Continue"

$root = "C:\Users\hfk47\Documents\noderasoftware"
$node = "C:\Program Files\nodejs\node.exe"
$entry = Join-Path $root "apps\api\dist\server.js"
$healthUrl = "http://127.0.0.1:4000/health"
$logPath = Join-Path $root "hotelops-watchdog.log"
$postgresService = "postgresql-x64-18"

function Write-WatchdogLog {
  param([string] $Message)

  $stamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
  Add-Content -Path $logPath -Value "[$stamp] $Message"
}

function Test-HotelOpsApi {
  try {
    $response = Invoke-RestMethod -Uri $healthUrl -TimeoutSec 5
    return $response.ok -eq $true -and $response.db -eq "up"
  } catch {
    return $false
  }
}

function Get-Port4000Owner {
  try {
    $connection = Get-NetTCPConnection -LocalPort 4000 -State Listen -ErrorAction Stop | Select-Object -First 1
    if ($connection) {
      return $connection.OwningProcess
    }
  } catch {
    return $null
  }
  return $null
}

function Ensure-PostgresRunning {
  try {
    $service = Get-Service -Name $postgresService -ErrorAction Stop
    if ($service.Status -eq "Running") {
      return $true
    }

    Write-WatchdogLog "PostgreSQL service is $($service.Status). Trying to start it."
    Start-Service -Name $postgresService -ErrorAction Stop
    $service.WaitForStatus("Running", "00:00:30")
    Write-WatchdogLog "PostgreSQL service is running."
    return $true
  } catch {
    Write-WatchdogLog "Could not ensure PostgreSQL service is running: $($_.Exception.Message)"
    return $false
  }
}

function Start-HotelOpsApi {
  if (-not (Test-Path $node)) {
    Write-WatchdogLog "Node.js was not found at $node"
    return
  }

  if (-not (Test-Path $entry)) {
    Write-WatchdogLog "API entry file was not found at $entry"
    return
  }

  $portOwner = Get-Port4000Owner
  if ($portOwner) {
    Write-WatchdogLog "Port 4000 is already owned by PID $portOwner, but API health is not OK. Not starting a second process."
    return
  }

  $env:NODE_ENV = "production"
  $env:PORT = "4000"
  $env:HOST = "0.0.0.0"

  $timestamp = Get-Date -Format "yyyyMMddTHHmmss.fff"
  $stdout = Join-Path $root "api-watchdog-$timestamp.log"
  $stderr = Join-Path $root "api-watchdog-$timestamp.err"

  Write-WatchdogLog "Starting HotelOps API."
  Start-Process `
    -FilePath $node `
    -ArgumentList $entry `
    -WorkingDirectory $root `
    -WindowStyle Hidden `
    -RedirectStandardOutput $stdout `
    -RedirectStandardError $stderr
}

if (-not (Ensure-PostgresRunning)) {
  exit 1
}

if (Test-HotelOpsApi) {
  exit 0
}

Start-HotelOpsApi
Start-Sleep -Seconds 5

if (Test-HotelOpsApi) {
  Write-WatchdogLog "HotelOps API health is OK."
  exit 0
}

Write-WatchdogLog "HotelOps API health is still not OK after restart attempt."
exit 1
