param(
  [string] $Branch = "master",
  [switch] $StatusOnly,
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
$repoRoot = & $git rev-parse --show-toplevel
if ((Resolve-Path $repoRoot).Path -ne $root) {
  throw "Bu script sadece ana local proje klasorunde calismali: $root"
}

$origin = & $git remote get-url origin
if ($origin -ne "https://github.com/monocosmos/noderasoftware.git") {
  throw "Beklenen origin degil. Beklenen: https://github.com/monocosmos/noderasoftware.git / Mevcut: $origin"
}

Write-Host "==> GitHub'dan guncel referanslar aliniyor"
& $git fetch origin $Branch

$currentBranch = & $git rev-parse --abbrev-ref HEAD
$localHead = & $git rev-parse HEAD
$remoteHead = & $git rev-parse "origin/$Branch"
$status = & $git status --short

Write-Host "Branch: $currentBranch"
Write-Host "Local HEAD:  $localHead"
Write-Host "GitHub HEAD: $remoteHead"

if ($localHead -ne $remoteHead) {
  Write-Host "Local ve GitHub HEAD farkli." -ForegroundColor Yellow
} else {
  Write-Host "Local HEAD GitHub ile ayni." -ForegroundColor Green
}

if ($status) {
  Write-Host "Localde commit edilmemis degisiklik var:" -ForegroundColor Yellow
  $status | ForEach-Object { Write-Host $_ }
} else {
  Write-Host "Local calisma alani temiz." -ForegroundColor Green
}

if ($StatusOnly) {
  exit 0
}

if ($currentBranch -ne $Branch) {
  throw "Su an '$currentBranch' dalindasiniz. Once hedef dala gecin veya -Branch ile dogru dali verin."
}

if ($status) {
  throw "Commit edilmemis degisiklik var. Once commit/push akisini tamamlayin."
}

& $git pull --ff-only origin $Branch

if (-not $SkipBuild) {
  Write-Host "==> Local build kontrolu"
  npm.cmd run build --workspace @hotel-ops/api
  npm.cmd run build --workspace @hotel-ops/web
}

Write-Host "Local proje GitHub $Branch ile senkron." -ForegroundColor Green
