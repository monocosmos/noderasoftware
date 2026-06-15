param(
  [Parameter(Mandatory = $true)]
  [ValidateNotNullOrEmpty()]
  [string] $Message,

  [ValidatePattern("^[A-Za-z0-9._/-]+$")]
  [string] $Branch = "master",

  [switch] $SkipBuild,

  [switch] $Yes
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$root = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
Set-Location $root

function Get-RequiredCommand {
  param(
    [Parameter(Mandatory = $true)]
    [string] $Name,

    [Parameter(Mandatory = $true)]
    [string] $InstallHint
  )

  $command = Get-Command $Name -ErrorAction SilentlyContinue
  if ($command) {
    return $command.Source
  }

  throw "$Name bulunamadi. $InstallHint"
}

function Get-GitCommand {
  $git = Get-Command git -ErrorAction SilentlyContinue
  if ($git) {
    return $git.Source
  }

  $knownPaths = @(
    "C:\Program Files\Git\cmd\git.exe",
    "C:\Program Files\Git\bin\git.exe",
    "C:\Program Files (x86)\Git\cmd\git.exe"
  )

  foreach ($path in $knownPaths) {
    if (Test-Path $path) {
      return $path
    }
  }

  throw "Git bulunamadi. Git for Windows kurulmali ve PATH'e eklenmeli: https://git-scm.com/download/win"
}

function Invoke-CheckedCommand {
  param(
    [Parameter(Mandatory = $true)]
    [string] $Command,

    [Parameter(Mandatory = $true)]
    [string[]] $Arguments
  )

  & $Command @Arguments
  $exitCode = $LASTEXITCODE
  if ($exitCode -ne 0) {
    throw "Komut basarisiz oldu ($exitCode): $Command $($Arguments -join ' ')"
  }
}

function Invoke-CapturedCommand {
  param(
    [Parameter(Mandatory = $true)]
    [string] $Command,

    [Parameter(Mandatory = $true)]
    [string[]] $Arguments
  )

  $output = & $Command @Arguments
  $exitCode = $LASTEXITCODE
  if ($exitCode -ne 0) {
    throw "Komut basarisiz oldu ($exitCode): $Command $($Arguments -join ' ')"
  }

  return $output
}

$git = Get-GitCommand
$npm = Get-RequiredCommand -Name "npm.cmd" -InstallHint "Node.js/npm kurulmali ve PATH'e eklenmeli."

$isRepo = (Invoke-CapturedCommand -Command $git -Arguments @("rev-parse", "--is-inside-work-tree") | Select-Object -First 1)
if ($isRepo -ne "true") {
  throw "Bu klasor bir Git deposu degil: $root"
}

$topLevel = (Invoke-CapturedCommand -Command $git -Arguments @("rev-parse", "--show-toplevel") | Select-Object -First 1)
if ((Resolve-Path $topLevel).Path -ne $root) {
  throw "Beklenmeyen Git kok dizini: $topLevel"
}

if (-not $SkipBuild) {
  Write-Host "==> Build kontrolu"
  Invoke-CheckedCommand -Command $npm -Arguments @("run", "build", "--workspace", "@hotel-ops/api")
  Invoke-CheckedCommand -Command $npm -Arguments @("run", "build", "--workspace", "@hotel-ops/web")
}

Write-Host "==> GitHub referansi aliniyor"
Invoke-CheckedCommand -Command $git -Arguments @("fetch", "origin", $Branch)

$currentBranch = (Invoke-CapturedCommand -Command $git -Arguments @("rev-parse", "--abbrev-ref", "HEAD") | Select-Object -First 1)
if ($currentBranch -ne $Branch) {
  throw "Su an '$currentBranch' dalindasiniz. Once '$Branch' dalina gecin."
}

Invoke-CheckedCommand -Command $git -Arguments @("pull", "--ff-only", "origin", $Branch)
Invoke-CheckedCommand -Command $git -Arguments @("add", "--all")

$status = Invoke-CapturedCommand -Command $git -Arguments @("status", "--short")
if (-not $status) {
  Write-Host "Yayinlanacak degisiklik yok." -ForegroundColor Green
  exit 0
}

Write-Host "==> Yayinlanacak degisiklikler"
$status | ForEach-Object { Write-Host $_ }

if (-not $Yes) {
  $answer = Read-Host "Bu degisiklikleri '$Branch' dalina commit/push yapmak icin EVET yazin"
  if ($answer -ne "EVET") {
    Write-Host "Islem iptal edildi." -ForegroundColor Yellow
    exit 0
  }
}

Write-Host "==> Commit"
Invoke-CheckedCommand -Command $git -Arguments @("commit", "-m", $Message)

Write-Host "==> Push"
Invoke-CheckedCommand -Command $git -Arguments @("push", "origin", $Branch)

Write-Host "Local proje GitHub'a yuklendi: $Branch" -ForegroundColor Green
