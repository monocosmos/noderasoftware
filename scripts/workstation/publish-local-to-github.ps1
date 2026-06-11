param(
  [Parameter(Mandatory = $true)]
  [string] $Message,

  [string] $Branch = "master",
  [switch] $SkipBuild
)

$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
Set-Location $root

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

$git = Get-GitCommand

if (-not $SkipBuild) {
  Write-Host "==> Build kontrolu"
  npm.cmd run build --workspace @hotel-ops/api
  npm.cmd run build --workspace @hotel-ops/web
}

Write-Host "==> GitHub referansi aliniyor"
& $git fetch origin $Branch

$currentBranch = & $git rev-parse --abbrev-ref HEAD
if ($currentBranch -ne $Branch) {
  throw "Su an '$currentBranch' dalindasiniz. Once '$Branch' dalina gecin."
}

& $git pull --ff-only origin $Branch
& $git add .

$status = & $git status --short
if (-not $status) {
  Write-Host "Yayinlanacak degisiklik yok." -ForegroundColor Green
  exit 0
}

Write-Host "==> Commit"
& $git commit -m $Message

Write-Host "==> Push"
& $git push origin $Branch

Write-Host "Local proje GitHub'a yüklendi: $Branch" -ForegroundColor Green
