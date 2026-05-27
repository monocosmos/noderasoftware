$ErrorActionPreference = "Stop"

$projectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$startupScript = Join-Path $PSScriptRoot "start-hotelops-stack.ps1"
$installerScript = Join-Path $PSScriptRoot "install-api-service.ps1"
$taskName = "HotelOpsStartupRepair"
$postgresService = "postgresql-x64-18"
$apiService = "HotelOpsApi"

function Assert-Admin {
  $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = [Security.Principal.WindowsPrincipal]::new($identity)
  if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw "Bu script yonetici yetkisiyle calistirilmalidir."
  }
}

Assert-Admin

Push-Location $projectRoot
try {
  npm.cmd run build --workspace @hotel-ops/api
  npm.cmd run seed --workspace @hotel-ops/api

  if (Get-Service -Name $postgresService -ErrorAction SilentlyContinue) {
    sc.exe config $postgresService start= auto | Out-Host
    Start-Service -Name $postgresService -ErrorAction SilentlyContinue
  }

  powershell.exe -NoProfile -ExecutionPolicy Bypass -File $installerScript

  sc.exe config $apiService start= delayed-auto | Out-Host
  sc.exe config $apiService depend= $postgresService | Out-Host
  sc.exe failure $apiService reset= 86400 actions= restart/60000/restart/60000/restart/60000 | Out-Host
  sc.exe failureflag $apiService 1 | Out-Host

  $action = New-ScheduledTaskAction `
    -Execute "powershell.exe" `
    -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$startupScript`""
  $trigger = New-ScheduledTaskTrigger -AtStartup
  $principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -RunLevel Highest
  $settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -MultipleInstances IgnoreNew `
    -RestartCount 5 `
    -RestartInterval (New-TimeSpan -Minutes 1)

  Register-ScheduledTask `
    -TaskName $taskName `
    -Action $action `
    -Trigger $trigger `
    -Principal $principal `
    -Settings $settings `
    -Description "Starts PostgreSQL and HotelOps API after Windows boot, then verifies health endpoints." `
    -Force | Out-Null

  powershell.exe -NoProfile -ExecutionPolicy Bypass -File $startupScript
}
finally {
  Pop-Location
}
