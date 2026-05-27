$ErrorActionPreference = "Continue"
$projectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
$log = Join-Path $projectRoot "api-task-check.log"
"=== Scheduled Task ===" | Set-Content $log
Get-ScheduledTask -TaskName HotelOpsApi -ErrorAction SilentlyContinue | Select-Object TaskName,State | Format-List | Out-String | Add-Content $log
"=== Task Info ===" | Add-Content $log
schtasks /Query /TN HotelOpsApi /FO LIST /V 2>&1 | Add-Content $log
"=== Port 4000 ===" | Add-Content $log
Get-NetTCPConnection -LocalPort 4000 -State Listen -ErrorAction SilentlyContinue | Select-Object LocalAddress,LocalPort,OwningProcess | Format-List | Out-String | Add-Content $log
