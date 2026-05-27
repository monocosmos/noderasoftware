#requires -RunAsAdministrator
param(
  [int]$DiskNumber = 1,
  [int]$RootPartitionNumber = 2,
  [char]$BootDriveLetter = 'D',
  [string]$WslDistro = "nodera-fsck",
  [string]$ImagePath,
  [string]$LogPath,
  [switch]$SkipImageCopy
)

$ErrorActionPreference = "Stop"

if (-not $ImagePath) {
  $ImagePath = Join-Path ([Environment]::GetFolderPath("Desktop")) ("pi-rootfs-repair-{0}.img" -f (Get-Date -Format "yyyyMMdd-HHmmss"))
}
if (-not $LogPath) {
  $LogPath = Join-Path ([Environment]::GetFolderPath("Desktop")) "pi-card-image-repair-current.log"
}

if (Test-Path $LogPath) {
  Remove-Item -LiteralPath $LogPath -Force
}

function Write-Log {
  param([string]$Message)
  $line = "[{0}] {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $Message
  $line | Tee-Object -FilePath $LogPath -Append
}

function Invoke-Logged {
  param(
    [string]$FilePath,
    [string[]]$ArgumentList,
    [int[]]$AllowedExitCodes = @(0)
  )
  Write-Log ("> {0} {1}" -f $FilePath, ($ArgumentList -join " "))
  $previousErrorActionPreference = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    $output = & $FilePath @ArgumentList 2>&1
    $exitCode = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $previousErrorActionPreference
  }
  if ($output) {
    $output | ForEach-Object { Write-Log ([string]$_) }
  }
  Write-Log ("exit={0}" -f $exitCode)
  if ($AllowedExitCodes -notcontains $exitCode) {
    throw "{0} failed with exit code {1}" -f $FilePath, $exitCode
  }
}

function Convert-ToWslPath {
  param([string]$WindowsPath)
  $full = [System.IO.Path]::GetFullPath($WindowsPath)
  $drive = $full.Substring(0, 1).ToLowerInvariant()
  $rest = $full.Substring(2).Replace('\', '/')
  return "/mnt/$drive$rest"
}

function Copy-RawPartition {
  param(
    [string]$SourcePath,
    [string]$DestinationPath,
    [Int64]$Bytes,
    [string]$Direction
  )

  $bufferSize = 8MB
  $buffer = New-Object byte[] $bufferSize
  $mode = [System.IO.FileMode]::Open
  $source = [System.IO.File]::Open($SourcePath, $mode, [System.IO.FileAccess]::Read, [System.IO.FileShare]::ReadWrite)
  try {
    $destination = [System.IO.File]::Open($DestinationPath, [System.IO.FileMode]::Create, [System.IO.FileAccess]::ReadWrite, [System.IO.FileShare]::None)
    try {
      $copied = [Int64]0
      $lastGb = -1
      while ($copied -lt $Bytes) {
        $toRead = [int][Math]::Min([int64]$buffer.Length, [int64]($Bytes - $copied))
        $read = $source.Read($buffer, 0, [int]$toRead)
        if ($read -le 0) {
          throw "Unexpected end of source after $copied bytes."
        }
        $destination.Write($buffer, 0, $read)
        $copied += $read
        $gb = [int][Math]::Floor($copied / 1GB)
        if ($gb -ne $lastGb) {
          $lastGb = $gb
          Write-Log ("{0}: {1:N1} GB / {2:N1} GB" -f $Direction, ($copied / 1GB), ($Bytes / 1GB))
        }
      }
      $destination.SetLength($Bytes)
      $destination.Flush($true)
    } finally {
      $destination.Dispose()
    }
  } finally {
    $source.Dispose()
  }
}

function Write-ImageToRawPartition {
  param(
    [string]$SourceImage,
    [string]$DestinationDevice,
    [Int64]$Bytes
  )

  $bufferSize = 8MB
  $buffer = New-Object byte[] $bufferSize
  $source = [System.IO.File]::Open($SourceImage, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::Read)
  try {
    $destination = [System.IO.File]::Open($DestinationDevice, [System.IO.FileMode]::Open, [System.IO.FileAccess]::ReadWrite, [System.IO.FileShare]::ReadWrite)
    try {
      $copied = [Int64]0
      $lastGb = -1
      while ($copied -lt $Bytes) {
        $toRead = [int][Math]::Min([int64]$buffer.Length, [int64]($Bytes - $copied))
        $read = $source.Read($buffer, 0, [int]$toRead)
        if ($read -le 0) {
          throw "Unexpected end of image after $copied bytes."
        }
        $destination.Write($buffer, 0, $read)
        $copied += $read
        $gb = [int][Math]::Floor($copied / 1GB)
        if ($gb -ne $lastGb) {
          $lastGb = $gb
          Write-Log ("write-back: {0:N1} GB / {1:N1} GB" -f ($copied / 1GB), ($Bytes / 1GB))
        }
      }
      $destination.Flush($true)
    } finally {
      $destination.Dispose()
    }
  } finally {
    $source.Dispose()
  }
}

try {
  Write-Log "Pi card image repair started."
  $disk = Get-Disk -Number $DiskNumber
  $partition = Get-Partition -DiskNumber $DiskNumber -PartitionNumber $RootPartitionNumber
  $bootPartition = Get-Partition -DiskNumber $DiskNumber -PartitionNumber 1
  Write-Log ("Disk {0}: {1}, size={2}, partitions={3}, bus={4}" -f $disk.Number, $disk.FriendlyName, $disk.Size, $disk.NumberOfPartitions, $disk.BusType)
  Write-Log ("Root partition {0}: size={1}, mbr={2}" -f $partition.PartitionNumber, $partition.Size, $partition.MbrType)

  if ($disk.NumberOfPartitions -lt 2 -or $disk.Size -lt 50GB -or $disk.Size -gt 80GB -or $partition.Size -lt 55GB -or $partition.Size -gt 65GB) {
    throw "Disk shape does not look like the 58GB Raspberry Pi card. Refusing to continue."
  }

  $freeBytes = (Get-PSDrive -Name ([System.IO.Path]::GetPathRoot($ImagePath).Substring(0, 1))).Free
  if ($freeBytes -lt ($partition.Size + 5GB)) {
    throw "Not enough free space for rootfs image. Need at least $([Math]::Round(($partition.Size + 5GB) / 1GB, 1)) GB."
  }

  $devicePath = "\\.\Harddisk$DiskNumber" + "Partition$RootPartitionNumber"
  Write-Log ("Raw root device: {0}" -f $devicePath)
  Write-Log ("Image path: {0}" -f $ImagePath)

  if ($SkipImageCopy) {
    if (-not (Test-Path $ImagePath)) {
      throw "SkipImageCopy was set but image does not exist: $ImagePath"
    }
    $imageLength = (Get-Item -LiteralPath $ImagePath).Length
    if ($imageLength -ne $partition.Size) {
      throw "SkipImageCopy image size mismatch. Expected $($partition.Size), found $imageLength."
    }
    Write-Log "Image copy skipped; using existing full-size image."
  } else {
    Copy-RawPartition -SourcePath $devicePath -DestinationPath $ImagePath -Bytes $partition.Size -Direction "image-copy"
    Write-Log "Image copy completed."
  }

  $wslImagePath = Convert-ToWslPath $ImagePath
  Invoke-Logged -FilePath "wsl.exe" -ArgumentList @("-d", $WslDistro, "-u", "root", "--", "e2fsck", "-V")
  Invoke-Logged -FilePath "wsl.exe" -ArgumentList @("-d", $WslDistro, "-u", "root", "--", "e2fsck", "-f", "-y", $wslImagePath) -AllowedExitCodes @(0, 1, 2)
  Invoke-Logged -FilePath "wsl.exe" -ArgumentList @("-d", $WslDistro, "-u", "root", "--", "e2fsck", "-f", "-n", $wslImagePath) -AllowedExitCodes @(0, 1, 2)
  Write-Log "Image filesystem repair completed."

  Write-ImageToRawPartition -SourceImage $ImagePath -DestinationDevice $devicePath -Bytes $partition.Size
  Write-Log "Write-back completed."

  try {
    if (-not $bootPartition.DriveLetter) {
      Add-PartitionAccessPath -DiskNumber $DiskNumber -PartitionNumber 1 -AccessPath ("{0}:\" -f $BootDriveLetter)
    }
  } catch {
    Write-Log ("Boot drive letter restore warning: {0}" -f $_)
  }

  Write-Log "Pi card image repair completed."
} catch {
  Write-Log ("ERROR: {0}" -f $_)
  throw
} finally {
  Write-Log ("Log file: {0}" -f $LogPath)
}
