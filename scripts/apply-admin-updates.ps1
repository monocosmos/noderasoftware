$ErrorActionPreference = "Stop"

$root = "C:\Users\hfk47\Documents\noderasoftware"
$webOut = Join-Path $root "apps\web\out"
$wwwroot = "C:\inetpub\wwwroot"
$logPath = Join-Path $root "admin-update.log"

function Write-AdminLog {
  param([string] $Message)

  $stamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
  Add-Content -Path $logPath -Value "[$stamp] $Message"
}

Write-AdminLog "Admin update started."

if (-not (Test-Path $webOut)) {
  throw "Web output folder was not found at $webOut"
}

if (-not (Test-Path $wwwroot)) {
  throw "IIS wwwroot folder was not found at $wwwroot"
}

Write-AdminLog "Copying web output to IIS wwwroot."
$robocopy = Start-Process `
  -FilePath "robocopy.exe" `
  -ArgumentList @($webOut, $wwwroot, "/E", "/R:1", "/W:1", "/NFL", "/NDL", "/NJH", "/NJS", "/NP") `
  -Wait `
  -PassThru `
  -WindowStyle Hidden

if ($robocopy.ExitCode -gt 7) {
  throw "Robocopy failed with exit code $($robocopy.ExitCode)"
}

Write-AdminLog "Restarting HotelOpsApi service."
Stop-Service -Name "HotelOpsApi" -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2
Start-Service -Name "HotelOpsApi"

Write-AdminLog "Configuring service recovery actions."
& sc.exe failure HotelOpsApi reset= 86400 actions= restart/60000/restart/60000/restart/60000 | Out-Null
& sc.exe failureflag HotelOpsApi 1 | Out-Null
& sc.exe failure postgresql-x64-18 reset= 86400 actions= restart/60000/restart/60000/restart/60000 | Out-Null
& sc.exe failureflag postgresql-x64-18 1 | Out-Null

Start-Sleep -Seconds 5

try {
  $health = Invoke-RestMethod -Uri "http://127.0.0.1:4000/health" -TimeoutSec 10
  Write-AdminLog "Health check: ok=$($health.ok), db=$($health.db)"
} catch {
  Write-AdminLog "Health check failed: $($_.Exception.Message)"
  throw
}

Write-AdminLog "Admin update completed."
