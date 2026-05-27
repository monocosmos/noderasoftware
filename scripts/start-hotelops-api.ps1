$ErrorActionPreference = "Stop"

$root = "C:\Users\hfk47\Documents\noderasoftware"
$node = "C:\Program Files\nodejs\node.exe"
$entry = Join-Path $root "apps\api\dist\server.js"
$healthUrl = "http://127.0.0.1:4000/health"
$logPath = Join-Path $root "hotelops-startup.log"

function Write-StartupLog {
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

if (Test-HotelOpsApi) {
  exit 0
}

$portOwner = Get-Port4000Owner
if ($portOwner) {
  Write-StartupLog "Port 4000 is already owned by PID $portOwner, but health check is not ready yet. Skipping duplicate API start."
  exit 0
}

if (-not (Test-Path $node)) {
  throw "Node.js was not found at $node"
}

if (-not (Test-Path $entry)) {
  throw "HotelOps API entry file was not found at $entry"
}

$env:NODE_ENV = "production"
$env:PORT = "4000"
$env:HOST = "0.0.0.0"

$timestamp = Get-Date -Format "yyyyMMddTHHmmss.fff"
$stdout = Join-Path $root "api-autostart-$timestamp.log"
$stderr = Join-Path $root "api-autostart-$timestamp.err"

Write-StartupLog "Starting HotelOps API."
Start-Process `
  -FilePath $node `
  -ArgumentList $entry `
  -WorkingDirectory $root `
  -WindowStyle Hidden `
  -RedirectStandardOutput $stdout `
  -RedirectStandardError $stderr

Start-Sleep -Seconds 5

if (Test-HotelOpsApi) {
  Write-StartupLog "HotelOps API health is OK."
  exit 0
}

Write-StartupLog "HotelOps API health is still not OK after startup attempt."
exit 1
