#requires -RunAsAdministrator
param(
  [char]$BootDriveLetter = 'D',
  [string]$WslDistro = "nodera-fsck"
)

$ErrorActionPreference = "Stop"
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$logPath = Join-Path ([Environment]::GetFolderPath("Desktop")) "pi-card-repair-$timestamp.log"

function Write-Log {
  param([string]$Message)
  $line = "[{0}] {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $Message
  $line | Tee-Object -FilePath $logPath -Append
}

function Invoke-Logged {
  param(
    [string]$FilePath,
    [string[]]$ArgumentList,
    [int[]]$AllowedExitCodes = @(0)
  )
  Write-Log ("> {0} {1}" -f $FilePath, ($ArgumentList -join " "))
  $output = & $FilePath @ArgumentList 2>&1
  $exitCode = $LASTEXITCODE
  if ($output) {
    $output | ForEach-Object { Write-Log ([string]$_) }
  }
  Write-Log ("exit={0}" -f $exitCode)
  if ($AllowedExitCodes -notcontains $exitCode) {
    throw "{0} failed with exit code {1}" -f $FilePath, $exitCode
  }
  return $output
}

Write-Log "Pi card repair started."

$partition = Get-Partition -DriveLetter $BootDriveLetter
$disk = $partition | Get-Disk
$partitions = Get-Partition -DiskNumber $disk.Number | Sort-Object PartitionNumber

Write-Log ("Boot drive: {0}: disk={1} size={2} partitions={3} model={4}" -f $BootDriveLetter, $disk.Number, $disk.Size, $disk.NumberOfPartitions, $disk.FriendlyName)
$partitions | ForEach-Object {
  Write-Log ("Partition {0}: type={1} mbr={2} size={3} drive={4}" -f $_.PartitionNumber, $_.Type, $_.MbrType, $_.Size, $_.DriveLetter)
}

if ($disk.NumberOfPartitions -lt 2 -or $disk.Size -lt 50GB -or $disk.Size -gt 80GB) {
  throw "Disk shape does not look like the 58GB Raspberry Pi card. Refusing to continue."
}

$bootRoot = "{0}:\" -f $BootDriveLetter
if (-not (Test-Path (Join-Path $bootRoot "cmdline.txt"))) {
  throw "cmdline.txt not found on $bootRoot. Refusing to continue."
}

$physicalDrive = "\\.\PHYSICALDRIVE$($disk.Number)"
$removedAccessPath = $false
$diskWasOffline = [bool]$disk.IsOffline
$mounted = $false

try {
  $before = @(Invoke-Logged -FilePath "wsl.exe" -ArgumentList @("-d", $WslDistro, "-u", "root", "--", "sh", "-lc", "lsblk -b -rno NAME,SIZE,TYPE 2>/dev/null || true"))

  Write-Log "Removing Windows drive letter before raw WSL attach."
  Remove-PartitionAccessPath -DiskNumber $disk.Number -PartitionNumber $partition.PartitionNumber -AccessPath $bootRoot
  $removedAccessPath = $true

  try {
    Invoke-Logged -FilePath "wsl.exe" -ArgumentList @("--mount", $physicalDrive, "--bare")
  } catch {
    Write-Log ("Direct WSL attach failed, trying offline attach: {0}" -f $_)
    Write-Log "Taking card disk offline for raw attach."
    Set-Disk -Number $disk.Number -IsOffline $true
    Invoke-Logged -FilePath "wsl.exe" -ArgumentList @("--mount", $physicalDrive, "--bare")
  }
  $mounted = $true
  Start-Sleep -Seconds 2

  $after = @(Invoke-Logged -FilePath "wsl.exe" -ArgumentList @("-d", $WslDistro, "-u", "root", "--", "sh", "-lc", "lsblk -b -rno NAME,SIZE,TYPE"))
  $newRows = @($after | Where-Object { $before -notcontains $_ })
  Write-Log "New WSL block rows:"
  $newRows | ForEach-Object { Write-Log $_ }

  $target = $null
  foreach ($row in $newRows) {
    $parts = ($row -split "\s+") | Where-Object { $_ }
    if ($parts.Count -ge 3) {
      $name = $parts[0]
      $size = [int64]$parts[1]
      $type = $parts[2]
      if ($type -eq "part" -and $size -gt 55GB -and $size -lt 65GB) {
        $target = $name
        break
      }
    }
  }

  if (-not $target) {
    $allRows = @(Invoke-Logged -FilePath "wsl.exe" -ArgumentList @("-d", $WslDistro, "-u", "root", "--", "sh", "-lc", "lsblk -b -rno NAME,SIZE,TYPE"))
    foreach ($row in $allRows) {
      $parts = ($row -split "\s+") | Where-Object { $_ }
      if ($parts.Count -ge 3) {
        $name = $parts[0]
        $size = [int64]$parts[1]
        $type = $parts[2]
        if ($type -eq "part" -and $size -gt 55GB -and $size -lt 65GB) {
          $target = $name
          break
        }
      }
    }
  }

  if (-not $target) {
    throw "Could not identify the 57GB ext4 root partition in WSL."
  }

  Write-Log ("Target ext4 partition: {0}" -f $target)
  Invoke-Logged -FilePath "wsl.exe" -ArgumentList @("-d", $WslDistro, "-u", "root", "--", "sh", "-lc", "command -v e2fsck || command -v fsck.ext4")
  Invoke-Logged -FilePath "wsl.exe" -ArgumentList @("-d", $WslDistro, "-u", "root", "--", "e2fsck", "-f", "-y", $target) -AllowedExitCodes @(0, 1, 2)
  Invoke-Logged -FilePath "wsl.exe" -ArgumentList @("-d", $WslDistro, "-u", "root", "--", "e2fsck", "-f", "-n", $target) -AllowedExitCodes @(0, 1, 2)
  Write-Log "Pi card repair completed."
} catch {
  Write-Log ("ERROR: {0}" -f $_)
  throw
} finally {
  if ($mounted) {
    try { Invoke-Logged -FilePath "wsl.exe" -ArgumentList @("--unmount", $physicalDrive) -AllowedExitCodes @(0, 1) } catch { Write-Log ("Unmount warning: {0}" -f $_) }
  }

  try {
    Set-Disk -Number $disk.Number -IsOffline $diskWasOffline
  } catch {
    Write-Log ("Set-Disk restore warning: {0}" -f $_)
  }

  Start-Sleep -Seconds 2

  if ($removedAccessPath) {
    try {
      $restored = Get-Partition -DiskNumber $disk.Number -PartitionNumber $partition.PartitionNumber
      if (-not $restored.DriveLetter) {
        Add-PartitionAccessPath -DiskNumber $disk.Number -PartitionNumber $partition.PartitionNumber -AccessPath $bootRoot
      }
    } catch {
      Write-Log ("Drive letter restore warning: {0}" -f $_)
    }
  }

  Write-Log ("Log file: {0}" -f $logPath)
}
