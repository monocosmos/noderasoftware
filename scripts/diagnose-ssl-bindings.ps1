$ErrorActionPreference = "Continue"

$projectRoot = Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")
$logFile = Join-Path $projectRoot "ssl-diagnose.log"

"SSL diagnose at $(Get-Date -Format o)" | Set-Content -Path $logFile

function Add-Log {
  param([string]$Message)
  $Message | Add-Content -Path $logFile
}

Add-Log ""
Add-Log "== Certificates =="
Get-ChildItem Cert:\LocalMachine\WebHosting,Cert:\LocalMachine\My -ErrorAction SilentlyContinue |
  Where-Object { $_.Subject -like "*noderasoftware.com*" } |
  Select-Object Subject,NotAfter,Thumbprint,PSParentPath |
  Format-List |
  Out-String |
  Add-Content -Path $logFile

Add-Log ""
Add-Log "== IIS bindings =="
Import-Module WebAdministration
Get-Website |
  Select-Object Name,Id,State,PhysicalPath,Bindings |
  Format-List |
  Out-String |
  Add-Content -Path $logFile

Add-Log ""
Add-Log "== Web bindings raw =="
Get-WebBinding |
  Select-Object protocol,bindingInformation,sslFlags |
  Format-Table -AutoSize |
  Out-String |
  Add-Content -Path $logFile

Add-Log ""
Add-Log "== HTTP.SYS SSL cert bindings =="
netsh http show sslcert 2>&1 | Out-String | Add-Content -Path $logFile

Add-Log ""
Add-Log "== Local HTTPS curl =="
curl.exe -Iv -k --resolve noderasoftware.com:443:127.0.0.1 https://noderasoftware.com/ 2>&1 |
  Out-String |
  Add-Content -Path $logFile

curl.exe -Iv -k --resolve www.noderasoftware.com:443:127.0.0.1 https://www.noderasoftware.com/ 2>&1 |
  Out-String |
  Add-Content -Path $logFile

Add-Log ""
Add-Log "Done"
Write-Host "Wrote $logFile"
