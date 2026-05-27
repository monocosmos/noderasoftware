param(
  [string] $AppPath = "$env:LOCALAPPDATA\Programs\HotelOps Desktop\HotelOps Desktop.exe",
  [switch] $IncludeCloseToTray
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path $AppPath)) {
  throw "HotelOps Desktop bulunamadi: $AppPath"
}

Add-Type @'
using System;
using System.Runtime.InteropServices;

public static class HotelOpsDesktopWin32 {
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool IsZoomed(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int X, int Y);
  [DllImport("user32.dll")] public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint dwData, UIntPtr dwExtraInfo);

  public const uint MOUSEEVENTF_LEFTDOWN = 0x0002;
  public const uint MOUSEEVENTF_LEFTUP = 0x0004;
  public const int SW_RESTORE = 9;

  public struct RECT {
    public int Left;
    public int Top;
    public int Right;
    public int Bottom;
  }
}
'@

function Get-HotelOpsMainProcess {
  Get-Process |
    Where-Object { $_.ProcessName -eq "HotelOps Desktop" -and $_.MainWindowHandle -ne 0 } |
    Sort-Object Id |
    Select-Object -First 1
}

function Wait-HotelOpsMainProcess {
  param([int] $TimeoutSeconds = 15)

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  do {
    $process = Get-HotelOpsMainProcess
    if ($process) { return $process }
    Start-Sleep -Milliseconds 500
  } while ((Get-Date) -lt $deadline)

  return $null
}

function Click-At {
  param(
    [Parameter(Mandatory = $true)][int] $X,
    [Parameter(Mandatory = $true)][int] $Y
  )

  [HotelOpsDesktopWin32]::SetCursorPos($X, $Y) | Out-Null
  Start-Sleep -Milliseconds 120
  [HotelOpsDesktopWin32]::mouse_event([HotelOpsDesktopWin32]::MOUSEEVENTF_LEFTDOWN, 0, 0, 0, [UIntPtr]::Zero)
  Start-Sleep -Milliseconds 80
  [HotelOpsDesktopWin32]::mouse_event([HotelOpsDesktopWin32]::MOUSEEVENTF_LEFTUP, 0, 0, 0, [UIntPtr]::Zero)
}

function Get-WindowRect {
  param([Parameter(Mandatory = $true)][IntPtr] $Handle)

  $rect = New-Object HotelOpsDesktopWin32+RECT
  [HotelOpsDesktopWin32]::GetWindowRect($Handle, [ref] $rect) | Out-Null
  return $rect
}

function Focus-HotelOpsWindow {
  param([Parameter(Mandatory = $true)][IntPtr] $Handle)

  [HotelOpsDesktopWin32]::ShowWindow($Handle, [HotelOpsDesktopWin32]::SW_RESTORE) | Out-Null
  [HotelOpsDesktopWin32]::SetForegroundWindow($Handle) | Out-Null
  Start-Sleep -Milliseconds 900
}

function Start-Or-Focus-HotelOps {
  $process = Get-HotelOpsMainProcess
  if (-not $process) {
    Start-Process -FilePath $AppPath
    $process = Wait-HotelOpsMainProcess -TimeoutSeconds 20
  } else {
    Start-Process -FilePath $AppPath
    Start-Sleep -Milliseconds 1500
    $process = Wait-HotelOpsMainProcess -TimeoutSeconds 10
  }

  if (-not $process) {
    throw "HotelOps ana penceresi acilamadi."
  }

  Focus-HotelOpsWindow -Handle $process.MainWindowHandle
  Start-Sleep -Milliseconds 1500
  return $process
}

$main = Start-Or-Focus-HotelOps
$handle = $main.MainWindowHandle
$rect = Get-WindowRect -Handle $handle
$buttonY = $rect.Top + 20

# Custom in-page caption controls are pinned to the top-right of the app window:
# [minimize: right-111], [maximize: right-67], [close: right-24]
Click-At -X ($rect.Right - 111) -Y $buttonY
Start-Sleep -Seconds 1

$minimized = [HotelOpsDesktopWin32]::IsIconic($handle)
if (-not $minimized) {
  throw "Pencere kucultme butonu calismadi."
}

Focus-HotelOpsWindow -Handle $handle
$rect = Get-WindowRect -Handle $handle

Click-At -X ($rect.Right - 67) -Y ($rect.Top + 20)
Start-Sleep -Seconds 1
$maximized = [HotelOpsDesktopWin32]::IsZoomed($handle)
if (-not $maximized) {
  throw "Pencere buyutme butonu calismadi."
}

$rect = Get-WindowRect -Handle $handle
Click-At -X ($rect.Right - 67) -Y ($rect.Top + 20)
Start-Sleep -Seconds 1
$restoredFromMaximize = -not [HotelOpsDesktopWin32]::IsZoomed($handle)
if (-not $restoredFromMaximize) {
  throw "Pencere buyutme geri alma butonu calismadi."
}

$closeToTrayWorked = $null
if ($IncludeCloseToTray) {
  $rect = Get-WindowRect -Handle $handle
  Click-At -X ($rect.Right - 24) -Y ($rect.Top + 20)
  Start-Sleep -Seconds 2
  $afterClose = Get-HotelOpsMainProcess
  $closeToTrayWorked = -not $afterClose
  if (-not $closeToTrayWorked) {
    throw "X butonu tray'e indirme davranisini tetiklemedi."
  }

  Start-Process -FilePath $AppPath
  Wait-HotelOpsMainProcess -TimeoutSeconds 15 | Out-Null
}

[pscustomobject]@{
  AppPath = $AppPath
  MinimizeButtonWorked = $true
  MaximizeButtonWorked = $true
  RestoreFromMaximizeWorked = $true
  CloseToTrayWorked = $closeToTrayWorked
}
