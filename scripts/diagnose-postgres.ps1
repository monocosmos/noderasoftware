$ErrorActionPreference = "Continue"

$pgRoot = "C:\Program Files\PostgreSQL\18"
$data = Join-Path $pgRoot "data"
$projectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
$logFile = Join-Path $projectRoot "postgres-diagnose.log"

"Diagnostics at $(Get-Date -Format o)" | Set-Content -Path $logFile
"Services:" | Add-Content -Path $logFile
Get-CimInstance Win32_Service | Where-Object { $_.Name -like "*postgres*" -or $_.DisplayName -like "*Postgre*" } |
  Select-Object Name,State,StartName,PathName,ExitCode |
  Format-List | Out-String | Add-Content -Path $logFile

"Data listing:" | Add-Content -Path $logFile
Get-ChildItem -LiteralPath $data -Force |
  Select-Object Name,Mode,Length,LastWriteTime |
  Format-Table | Out-String | Add-Content -Path $logFile

"postgresql.conf exists: $(Test-Path -LiteralPath (Join-Path $data 'postgresql.conf'))" | Add-Content -Path $logFile

"Event log:" | Add-Content -Path $logFile
Get-EventLog -LogName Application -Newest 40 |
  Where-Object { $_.Source -like "*postgres*" -or $_.Message -like "*postgres*" } |
  Select-Object TimeGenerated,EntryType,Source,Message |
  Format-List | Out-String | Add-Content -Path $logFile
