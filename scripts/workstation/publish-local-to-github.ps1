param(
  [ValidateSet("all", "home", "hotel", "videowallplayer")]
  [string] $Section = "all",

  [string] $Message = "",

  [ValidatePattern("^[A-Za-z0-9._/-]+$")]
  [string] $Branch = "master",

  [string] $RepoRoot = "C:\Users\hfk47\Documents\noderasoftware\github-sync",

  [switch] $SkipBuild,

  [switch] $Yes
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

. (Join-Path $PSScriptRoot "site-sections.ps1")
$sectionDefinition = Get-NoderaSiteSection -Name $Section

function Invoke-Checked {
  param(
    [Parameter(Mandatory = $true)]
    [string] $Command,

    [Parameter(Mandatory = $true)]
    [string[]] $Arguments
  )

  & $Command @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "Komut basarisiz oldu ($LASTEXITCODE): $Command $($Arguments -join ' ')"
  }
}

function Invoke-Captured {
  param(
    [Parameter(Mandatory = $true)]
    [string] $Command,

    [Parameter(Mandatory = $true)]
    [string[]] $Arguments
  )

  $output = & $Command @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "Komut basarisiz oldu ($LASTEXITCODE): $Command $($Arguments -join ' ')"
  }
  return $output
}

function Write-Utf8NoBomFile {
  param(
    [Parameter(Mandatory = $true)]
    [string] $Path,

    [Parameter(Mandatory = $true)]
    [string] $Content
  )

  $parent = Split-Path -Parent $Path
  New-Item -ItemType Directory -Path $parent -Force | Out-Null
  [System.IO.File]::WriteAllText($Path, $Content, [System.Text.UTF8Encoding]::new($false))
}

function Update-WebBuildManifest {
  $buildIdPath = Join-Path $RepoRoot "apps\web\.next\BUILD_ID"
  if (-not (Test-Path -LiteralPath $buildIdPath)) {
    throw "Web build kimligi bulunamadi: $buildIdPath"
  }

  $buildId = (Get-Content -LiteralPath $buildIdPath -Raw).Trim()
  if (-not $buildId) {
    throw "Web build kimligi bos: $buildIdPath"
  }

  $manifest = [ordered]@{
    schema = 1
    buildId = $buildId
    generatedAt = (Get-Date).ToUniversalTime().ToString("o")
    source = "next-build"
  } | ConvertTo-Json

  Write-Utf8NoBomFile -Path (Join-Path $RepoRoot "apps\web\out\web-build.json") -Content ($manifest + "`n")
  Write-Utf8NoBomFile -Path (Join-Path $RepoRoot "apps\web\public\web-build.json") -Content ($manifest + "`n")
}

function Get-StageablePaths {
  param(
    [Parameter(Mandatory = $true)]
    [string[]] $Paths
  )

  $stageable = New-Object System.Collections.Generic.List[string]
  foreach ($path in $Paths) {
    $localPath = Join-Path $RepoRoot $path
    $exists = Test-Path -Path $localPath
    $tracked = & $git ls-files -- $path
    if ($LASTEXITCODE -ne 0) {
      throw "Git path kontrolu basarisiz oldu: $path"
    }
    if ($exists -or $tracked) {
      $stageable.Add($path)
    } else {
      Write-Host "Atlandi, repo icinde bulunamadi: $path" -ForegroundColor DarkYellow
    }
  }
  return $stageable.ToArray()
}

if (-not $Message.Trim()) {
  $Message = Read-Host "Commit mesaji"
}
if (-not $Message.Trim()) {
  throw "Commit mesaji bos olamaz."
}

$git = (Get-Command git -ErrorAction Stop).Source
$npm = (Get-Command npm.cmd -ErrorAction Stop).Source
$RepoRoot = (Resolve-Path $RepoRoot).Path
Set-Location $RepoRoot

$inside = (Invoke-Captured $git @("rev-parse", "--is-inside-work-tree") | Select-Object -First 1)
if ($inside -ne "true") {
  throw "Repo klasoru degil: $RepoRoot"
}

$topLevel = (Invoke-Captured $git @("rev-parse", "--show-toplevel") | Select-Object -First 1)
if ((Resolve-Path $topLevel).Path -ne $RepoRoot) {
  throw "Beklenmeyen git kok dizini: $topLevel"
}

$currentBranch = (Invoke-Captured $git @("rev-parse", "--abbrev-ref", "HEAD") | Select-Object -First 1)
if ($currentBranch -ne $Branch) {
  throw "Su an '$currentBranch' dalindasiniz. Once '$Branch' dalina gecin."
}

Write-Host "==> GitHub referansi aliniyor"
Invoke-Checked $git @("fetch", "origin", $Branch)

$aheadBehind = (Invoke-Captured $git @("rev-list", "--left-right", "--count", "HEAD...origin/$Branch") | Select-Object -First 1)
$parts = $aheadBehind -split "\s+"
$ahead = [int]$parts[0]
$behind = [int]$parts[1]
$workingDirty = [bool](Invoke-Captured $git @("status", "--porcelain"))

if ($behind -gt 0) {
  if ($workingDirty) {
    throw "Local dal GitHub'dan $behind commit geride ve calisma agaci kirli. Once elle kontrol edip senkronlayin."
  }
  Invoke-Checked $git @("pull", "--ff-only", "origin", $Branch)
}

if (-not $SkipBuild) {
  Write-Host "==> Build kontrolu: $($sectionDefinition.DisplayName)"
  if ($sectionDefinition.RequiresApiBuild) {
    Invoke-Checked $npm @("run", "build", "--workspace", "@hotel-ops/api")
  }
  if ($sectionDefinition.RequiresWebBuild) {
    Invoke-Checked $npm @("run", "build", "--workspace", "@hotel-ops/web")
    Update-WebBuildManifest
  }
}

if ($Section -eq "all") {
  Write-Host "UYARI: Section 'all' tum calisma agacini stage eder." -ForegroundColor Yellow
  if (-not $Yes) {
    $allAnswer = Read-Host "Tum degisiklikleri stage etmek icin ALL yazin"
    if ($allAnswer -ne "ALL") {
      Write-Host "Islem iptal edildi." -ForegroundColor Yellow
      exit 0
    }
  }
  Invoke-Checked $git @("add", "--all")
} else {
  Write-Host "==> Sadece '$Section' bolumu stage ediliyor"
  $stageablePaths = Get-StageablePaths -Paths $sectionDefinition.CommitPaths
  if (-not $stageablePaths) {
    throw "Stage edilecek gecerli path bulunamadi: $Section"
  }
  Invoke-Checked $git (@("add", "-A", "-f", "--") + $stageablePaths)
}

$staged = Invoke-Captured $git @("diff", "--cached", "--name-status")
if (-not $staged) {
  Write-Host "Yayinlanacak degisiklik yok: $($sectionDefinition.DisplayName)" -ForegroundColor Green
  exit 0
}

Write-Host "==> Commit edilecek dosyalar:"
$staged | ForEach-Object { Write-Host $_ }

if (-not $Yes) {
  $answer = Read-Host "Bu degisiklikleri '$Branch' dalina commit/push yapmak icin EVET yazin"
  if ($answer -ne "EVET") {
    Write-Host "Islem iptal edildi." -ForegroundColor Yellow
    Invoke-Checked $git @("restore", "--staged", "--")
    exit 0
  }
}

Invoke-Checked $git @("commit", "-m", $Message)
Invoke-Checked $git @("push", "origin", $Branch)

Write-Host "GitHub'a yuklendi: $Branch / $Message" -ForegroundColor Green
