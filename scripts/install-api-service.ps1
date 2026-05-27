$ErrorActionPreference = "Stop"

$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($identity)
$isAdmin = $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
  throw "This script must be run as Administrator."
}

$projectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
$logFile = Join-Path $projectRoot "api-service-install.log"
$serviceName = "HotelOpsApi"
$node = "C:\Program Files\nodejs\node.exe"
$server = Join-Path $projectRoot "apps\api\dist\server.js"
$stdout = Join-Path $projectRoot "api-service.log"
$stderr = Join-Path $projectRoot "api-service.err"
$nssm = "C:\ProgramData\chocolatey\bin\nssm.exe"

Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
using System.Text;

public static class PathShortener {
  [DllImport("kernel32.dll", CharSet = CharSet.Auto)]
  public static extern int GetShortPathName(string longPath, StringBuilder shortPath, int buffer);
}
"@ -ErrorAction SilentlyContinue

function Get-ServiceSafePath {
  param([string]$Path)

  if ($Path -notmatch "\s") {
    return $Path
  }

  $buffer = New-Object System.Text.StringBuilder 1024
  $length = [PathShortener]::GetShortPathName($Path, $buffer, $buffer.Capacity)
  if ($length -gt 0) {
    return $buffer.ToString()
  }

  return $Path
}

$serviceProjectRoot = Get-ServiceSafePath $projectRoot
$serviceServer = Join-Path $serviceProjectRoot "apps\api\dist\server.js"

"Installing HotelOps API service at $(Get-Date -Format o)" | Set-Content -Path $logFile

Get-ScheduledTask -TaskName $serviceName -ErrorAction SilentlyContinue | Unregister-ScheduledTask -Confirm:$false -ErrorAction SilentlyContinue

Get-NetTCPConnection -LocalPort 4000 -State Listen -ErrorAction SilentlyContinue | ForEach-Object {
  "Stopping existing listener PID $($_.OwningProcess)" | Add-Content -Path $logFile
  Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue
}

if (-not (Test-Path -LiteralPath $nssm)) {
  Get-ChildItem -LiteralPath "C:\ProgramData\chocolatey\lib" -Filter "*nssm*" -Force -ErrorAction SilentlyContinue | ForEach-Object {
    Remove-Item -LiteralPath $_.FullName -Recurse -Force -ErrorAction SilentlyContinue
  }
  Get-ChildItem -LiteralPath "C:\ProgramData\chocolatey\lib" -Filter "*d7d547f76d3d73b3c9aff04ccc96a542116e4938*" -Force -ErrorAction SilentlyContinue | ForEach-Object {
    Remove-Item -LiteralPath $_.FullName -Force -ErrorAction SilentlyContinue
  }
  choco install nssm --yes --no-progress 2>&1 | Add-Content -Path $logFile
}

if (-not (Test-Path -LiteralPath $nssm)) {
  throw "nssm.exe not found after installation."
}

$existing = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
if ($existing) {
  if ($existing.Status -ne "Stopped") {
    Stop-Service -Name $serviceName -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
  }
  & $nssm remove $serviceName confirm 2>&1 | Add-Content -Path $logFile
}

& $nssm install $serviceName $node 2>&1 | Add-Content -Path $logFile
& $nssm set $serviceName AppParameters $serviceServer 2>&1 | Add-Content -Path $logFile
& $nssm set $serviceName AppDirectory $serviceProjectRoot 2>&1 | Add-Content -Path $logFile
& $nssm set $serviceName AppStdout $stdout 2>&1 | Add-Content -Path $logFile
& $nssm set $serviceName AppStderr $stderr 2>&1 | Add-Content -Path $logFile
& $nssm set $serviceName AppRotateFiles 1 2>&1 | Add-Content -Path $logFile
& $nssm set $serviceName AppRotateOnline 1 2>&1 | Add-Content -Path $logFile
& $nssm set $serviceName AppRestartDelay 5000 2>&1 | Add-Content -Path $logFile
& $nssm set $serviceName AppEnvironmentExtra "NODE_ENV=production" "Path=C:\Windows\System32;C:\Program Files\nodejs" 2>&1 | Add-Content -Path $logFile
& $nssm set $serviceName Start SERVICE_AUTO_START 2>&1 | Add-Content -Path $logFile

Start-Service -Name $serviceName
Start-Sleep -Seconds 5

Get-Service -Name $serviceName | Select-Object Name,Status,DisplayName | Format-List | Out-String | Add-Content -Path $logFile
Get-NetTCPConnection -LocalPort 4000 -State Listen -ErrorAction SilentlyContinue | Select-Object LocalAddress,LocalPort,OwningProcess | Format-List | Out-String | Add-Content -Path $logFile
