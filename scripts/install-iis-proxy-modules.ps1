$ErrorActionPreference = "Stop"

$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($identity)
$isAdmin = $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
  throw "This script must be run as Administrator."
}

$projectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
$logFile = Join-Path $projectRoot "iis-proxy-install.log"
"Installing IIS proxy modules at $(Get-Date -Format o)" | Set-Content -Path $logFile

choco install UrlRewrite iis-arr --yes --no-progress 2>&1 | Add-Content -Path $logFile

$appcmd = "$env:windir\system32\inetsrv\appcmd.exe"
& $appcmd set config -section:system.webServer/proxy /enabled:"True" /preserveHostHeader:"True" /commit:apphost 2>&1 | Add-Content -Path $logFile

iisreset 2>&1 | Add-Content -Path $logFile

"Done" | Add-Content -Path $logFile
