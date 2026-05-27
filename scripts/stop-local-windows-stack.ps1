$ErrorActionPreference = "Continue"

$root = Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")
$logPath = Join-Path $root "stop-local-windows-stack.log"

function Write-StackLog {
  param([string] $Message)
  $stamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
  Add-Content -Path $logPath -Value "[$stamp] $Message"
}

function Test-IsAdmin {
  $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
  $principal = New-Object Security.Principal.WindowsPrincipal($identity)
  return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Stop-And-DisableService {
  param(
    [string] $Name,
    [string] $StartupType = "Disabled"
  )

  $service = Get-Service -Name $Name -ErrorAction SilentlyContinue
  if (-not $service) {
    Write-StackLog "Service not found: $Name"
    return
  }

  try {
    if ($service.Status -ne "Stopped") {
      Write-StackLog "Stopping service: $Name"
      Stop-Service -Name $Name -Force -ErrorAction Stop
      $service.WaitForStatus("Stopped", "00:00:30")
    }
  } catch {
    Write-StackLog "Stop failed for ${Name}: $($_.Exception.Message)"
  }

  try {
    Write-StackLog "Setting startup ${StartupType}: $Name"
    Set-Service -Name $Name -StartupType $StartupType -ErrorAction Stop
  } catch {
    Write-StackLog "Startup change failed for ${Name}: $($_.Exception.Message)"
  }
}

Write-StackLog "==== Stop local Windows web stack started ===="

if (-not (Test-IsAdmin)) {
  Write-StackLog "ERROR: Script must run as Administrator."
  throw "This script must run as Administrator."
}

foreach ($taskName in @("HotelOpsApiUserAutostart", "HotelOpsKeepOnline")) {
  try {
    $task = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
    if ($task) {
      Disable-ScheduledTask -TaskName $taskName | Out-Null
      Write-StackLog "Disabled scheduled task: $taskName"
    } else {
      Write-StackLog "Scheduled task not found: $taskName"
    }
  } catch {
    Write-StackLog "Scheduled task disable failed for ${taskName}: $($_.Exception.Message)"
  }
}

Stop-And-DisableService -Name "HotelOpsApi" -StartupType Disabled
Stop-And-DisableService -Name "postgresql-x64-18" -StartupType Disabled
Stop-And-DisableService -Name "W3SVC" -StartupType Disabled
Stop-And-DisableService -Name "WAS" -StartupType Manual

try {
  $ports = 3000, 4000
  $ownerPids = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
    Where-Object { $_.LocalPort -in $ports } |
    Select-Object -ExpandProperty OwningProcess -Unique

  foreach ($ownerPid in $ownerPids) {
    $process = Get-Process -Id $ownerPid -ErrorAction SilentlyContinue
    if ($process -and $process.ProcessName -eq "node") {
      Write-StackLog "Stopping orphan node process on local dev/API port: $ownerPid"
      Stop-Process -Id $ownerPid -Force -ErrorAction Stop
    }
  }
} catch {
  Write-StackLog "Node listener cleanup failed: $($_.Exception.Message)"
}

Write-StackLog "Remaining relevant services:"
Get-Service -Name "HotelOpsApi", "postgresql-x64-18", "W3SVC", "WAS" -ErrorAction SilentlyContinue |
  ForEach-Object { Write-StackLog ("{0} Status={1} StartType={2}" -f $_.Name, $_.Status, $_.StartType) }

Write-StackLog "Remaining listeners on 80/443/3000/4000/5432:"
Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
  Where-Object { $_.LocalPort -in 80, 443, 3000, 4000, 5432 } |
  ForEach-Object {
    $proc = Get-Process -Id $_.OwningProcess -ErrorAction SilentlyContinue
    Write-StackLog ("Port={0} Address={1} PID={2} Process={3}" -f $_.LocalPort, $_.LocalAddress, $_.OwningProcess, $proc.ProcessName)
  }

Write-StackLog "==== Stop local Windows web stack completed ===="
