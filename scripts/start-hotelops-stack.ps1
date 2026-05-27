$ErrorActionPreference = "Continue"

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$logFile = Join-Path $projectRoot "hotelops-startup.log"
$postgresService = "postgresql-x64-18"
$apiService = "HotelOpsApi"

function Write-StartupLog {
  param([string]$Message)
  $stamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
  Add-Content -Path $logFile -Value "[$stamp] $Message"
}

function Wait-HttpOk {
  param(
    [string]$Url,
    [int]$Attempts = 45,
    [int]$DelaySeconds = 2
  )

  for ($i = 1; $i -le $Attempts; $i++) {
    try {
      $response = Invoke-RestMethod -Uri $Url -TimeoutSec 5 -UseBasicParsing
      if ($response.ok -eq $true) {
        Write-StartupLog "$Url is ready."
        return $true
      }
    } catch {
      Write-StartupLog "$Url is not ready yet. Attempt $i/${Attempts}: $($_.Exception.Message)"
    }

    Start-Sleep -Seconds $DelaySeconds
  }

  return $false
}

Write-StartupLog "HotelOps startup check started."

$postgres = Get-Service -Name $postgresService -ErrorAction SilentlyContinue
if ($postgres) {
  if ($postgres.Status -ne "Running") {
    Write-StartupLog "Starting $postgresService."
    Start-Service -Name $postgresService -ErrorAction SilentlyContinue
  } else {
    Write-StartupLog "$postgresService is already running."
  }
} else {
  Write-StartupLog "$postgresService service was not found."
}

for ($i = 1; $i -le 60; $i++) {
  if (Test-NetConnection -ComputerName 127.0.0.1 -Port 5432 -InformationLevel Quiet) {
    Write-StartupLog "PostgreSQL port is reachable."
    break
  }

  Write-StartupLog "Waiting for PostgreSQL port. Attempt $i/60."
  Start-Sleep -Seconds 2
}

$api = Get-Service -Name $apiService -ErrorAction SilentlyContinue
if ($api) {
  if ($api.Status -eq "Running") {
    Write-StartupLog "Restarting $apiService."
    Restart-Service -Name $apiService -Force -ErrorAction SilentlyContinue
  } else {
    Write-StartupLog "Starting $apiService."
    Start-Service -Name $apiService -ErrorAction SilentlyContinue
  }
} else {
  Write-StartupLog "$apiService service was not found."
}

$directReady = Wait-HttpOk -Url "http://127.0.0.1:4000/health"
$iisReady = Wait-HttpOk -Url "http://127.0.0.1/api/health" -Attempts 20

if ($directReady -or $iisReady) {
  Write-StartupLog "HotelOps startup check completed successfully."
  exit 0
}

Write-StartupLog "HotelOps startup check completed with errors."
exit 1
