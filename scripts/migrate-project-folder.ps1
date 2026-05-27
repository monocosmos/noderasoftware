$ErrorActionPreference = "Stop"

$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($identity)
$isAdmin = $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
  throw "This script must be run as Administrator."
}

$oldRoot = "C:\Users\hfk47\Documents\New project"
$newRoot = "C:\Users\hfk47\Documents\noderasoftware"
$parent = Split-Path -Parent $oldRoot
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$archiveName = "noderasoftware-old-$stamp"
$archiveRoot = Join-Path $parent $archiveName
$logFile = Join-Path $parent "noderasoftware-migration.log"
$serviceName = "HotelOpsApi"

function Write-Log {
  param([string]$Message)
  $line = "$(Get-Date -Format o) $Message"
  Write-Host $line
  Add-Content -Path $logFile -Value $line
}

Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;

public static class PendingMove {
  [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
  public static extern bool MoveFileEx(string existingFileName, string newFileName, int flags);
}
"@ -ErrorAction SilentlyContinue

"Migration run started at $(Get-Date -Format o)" | Set-Content -Path $logFile

Get-CimInstance Win32_Process -Filter "Name = 'powershell.exe'" -ErrorAction SilentlyContinue |
  Where-Object { $_.ProcessId -ne $PID -and $_.CommandLine -match "rename-project-folder\.ps1" } |
  ForEach-Object {
    Write-Log "Stopping stale rename script process PID $($_.ProcessId)."
    Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
  }

if (-not (Test-Path -LiteralPath $oldRoot) -and -not (Test-Path -LiteralPath $newRoot)) {
  throw "Neither old nor new project folder exists."
}

Write-Log "Stopping API service/task if present."
$service = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
if ($service -and $service.Status -ne "Stopped") {
  Stop-Service -Name $serviceName -Force -ErrorAction SilentlyContinue
  Start-Sleep -Seconds 3
}

$task = Get-ScheduledTask -TaskName $serviceName -ErrorAction SilentlyContinue
if ($task) {
  Stop-ScheduledTask -TaskName $serviceName -ErrorAction SilentlyContinue
}

Get-NetTCPConnection -LocalPort 4000 -State Listen -ErrorAction SilentlyContinue | ForEach-Object {
  Write-Log "Stopping existing API listener PID $($_.OwningProcess)."
  Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue
}

if (Test-Path -LiteralPath $oldRoot) {
  Write-Log "Copying project to $newRoot."
  robocopy $oldRoot $newRoot /MIR /R:2 /W:2 /NFL /NDL /NP | Add-Content -Path $logFile
  if ($LASTEXITCODE -gt 7) {
    throw "Robocopy failed with exit code $LASTEXITCODE."
  }
} else {
  Write-Log "Old folder not found; using existing $newRoot."
}

if (-not (Test-Path -LiteralPath $newRoot)) {
  throw "New project folder was not found after copy: $newRoot"
}

Write-Log "Reinstalling API service from $newRoot."
& (Join-Path $newRoot "scripts\install-api-service.ps1")

if (Test-Path -LiteralPath $oldRoot) {
  try {
    Write-Log "Archiving old folder to $archiveRoot."
    Rename-Item -LiteralPath $oldRoot -NewName $archiveName -ErrorAction Stop
    Write-Log "Old folder archived immediately."
  } catch {
    Write-Log "Immediate archive failed: $($_.Exception.Message)"
    $scheduled = [PendingMove]::MoveFileEx($oldRoot, $archiveRoot, 4)
    if ($scheduled) {
      Write-Log "Old folder archive scheduled for next reboot: $archiveRoot."
    } else {
      $win32 = [Runtime.InteropServices.Marshal]::GetLastWin32Error()
      Write-Log "Could not schedule old folder archive. Win32 error: $win32"
    }
  }
}

Write-Log "Migration completed."
