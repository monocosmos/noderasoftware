$ErrorActionPreference = "Stop"

$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($identity)
$isAdmin = $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
  throw "This script must be run as Administrator."
}

$taskName = "HotelOpsApi"
$projectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
$script = Join-Path $PSScriptRoot "start-api.ps1"
$logFile = Join-Path $projectRoot "api-task-install.log"

"Installing API startup task at $(Get-Date -Format o)" | Set-Content -Path $logFile

Get-NetTCPConnection -LocalPort 4000 -State Listen -ErrorAction SilentlyContinue | ForEach-Object {
  "Stopping existing API listener PID $($_.OwningProcess)" | Add-Content -Path $logFile
  Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue
}

if (-not (Get-NetFirewallRule -DisplayName "HotelOps API 4000" -ErrorAction SilentlyContinue)) {
  New-NetFirewallRule -DisplayName "HotelOps API 4000" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 4000 | Out-Null
  "Firewall rule created." | Add-Content -Path $logFile
}

$action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$script`""
$trigger = New-ScheduledTaskTrigger -AtStartup
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -MultipleInstances IgnoreNew -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force | Out-Null
Start-ScheduledTask -TaskName $taskName
Start-Sleep -Seconds 5

Get-ScheduledTask -TaskName $taskName | Select-Object TaskName,State | Format-List | Out-String | Add-Content -Path $logFile
Get-NetTCPConnection -LocalPort 4000 -State Listen -ErrorAction SilentlyContinue | Select-Object LocalAddress,LocalPort,OwningProcess | Format-List | Out-String | Add-Content -Path $logFile
