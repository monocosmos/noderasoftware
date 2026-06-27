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

function Get-DesktopAppVersionCode {
  $preloadPath = Join-Path $RepoRoot "apps\desktop\src\preload.cjs"
  $mainPath = Join-Path $RepoRoot "apps\desktop\src\main.cjs"
  $preloadContent = Get-Content -LiteralPath $preloadPath -Raw
  $mainContent = Get-Content -LiteralPath $mainPath -Raw

  if ($preloadContent -notmatch "const\s+appVersionCode\s*=\s*(\d+)\s*;") {
    throw "Desktop appVersionCode bulunamadi: $preloadPath"
  }
  $preloadCode = [int] $Matches[1]

  if ($mainContent -notmatch "const\s+DESKTOP_APP_BUILD\s*=\s*(\d+)\s*;") {
    throw "Desktop DESKTOP_APP_BUILD bulunamadi: $mainPath"
  }
  $mainCode = [int] $Matches[1]

  if ($preloadCode -ne $mainCode) {
    throw "Desktop surum kodlari eslesmiyor. preload=$preloadCode main=$mainCode"
  }

  return $preloadCode
}

function Assert-HotelDesktopReleaseManifest {
  if ($Section -notin @("all", "hotel")) { return }

  $packagePath = Join-Path $RepoRoot "apps\desktop\package.json"
  $packageJson = Get-Content -LiteralPath $packagePath -Raw | ConvertFrom-Json
  $desktopVersion = [string] $packageJson.version
  $desktopCode = Get-DesktopAppVersionCode

  foreach ($manifestPath in @(
    (Join-Path $RepoRoot "apps\web\public\app-version.json"),
    (Join-Path $RepoRoot "apps\web\out\app-version.json")
  )) {
    if (-not (Test-Path -LiteralPath $manifestPath)) {
      throw "App version manifest bulunamadi: $manifestPath"
    }

    $manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
    $platform = $manifest.platforms.desktop
    if (-not $platform) {
      throw "Desktop platform app-version.json icinde yok: $manifestPath"
    }
    if ([string] $platform.latestVersion -ne $desktopVersion) {
      throw "Desktop manifest surumu eski. $manifestPath latestVersion=$($platform.latestVersion), package=$desktopVersion. Once build-windows-desktop-release.ps1 -CopyToWebDownloads calistirin."
    }
    if ([int64] $platform.latestCode -ne [int64] $desktopCode -or [int64] $platform.minimumCode -ne [int64] $desktopCode) {
      throw "Desktop manifest code eski. $manifestPath latestCode=$($platform.latestCode), minimumCode=$($platform.minimumCode), appCode=$desktopCode. Once build-windows-desktop-release.ps1 -CopyToWebDownloads calistirin."
    }
  }

  foreach ($downloadPath in @(
    (Join-Path $RepoRoot "apps\web\public\downloads\HotelOps-Setup-V1-x64.exe"),
    (Join-Path $RepoRoot "apps\web\public\downloads\HotelOps-Portable-V1-x64.exe"),
    (Join-Path $RepoRoot "apps\web\out\downloads\HotelOps-Setup-V1-x64.exe"),
    (Join-Path $RepoRoot "apps\web\out\downloads\HotelOps-Portable-V1-x64.exe")
  )) {
    if (-not (Test-Path -LiteralPath $downloadPath)) {
      throw "HotelOps desktop download dosyasi bulunamadi: $downloadPath"
    }
    $versionInfo = (Get-Item -LiteralPath $downloadPath).VersionInfo
    if ([string] $versionInfo.ProductVersion -ne $desktopVersion) {
      throw "HotelOps desktop download surumu manifest/package ile eslesmiyor: $downloadPath ProductVersion=$($versionInfo.ProductVersion), package=$desktopVersion"
    }
  }

  Write-Host "Desktop app-version manifest ve download surumleri dogrulandi: $desktopVersion / code $desktopCode" -ForegroundColor Green
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

function Unstage-LargeBuildOutputs {
  $downloadPaths = @(
    "apps/web/public/downloads",
    "apps/web/out/downloads"
  )

  $stagedDownloads = & $git diff --cached --name-only -- $downloadPaths
  if ($LASTEXITCODE -ne 0) {
    throw "Download stage kontrolu basarisiz oldu."
  }

  if ($stagedDownloads) {
    Invoke-Checked $git (@("reset", "-q", "HEAD", "--") + $downloadPaths)
    Write-Host "Buyuk uygulama ciktilari GitHub stage disinda birakildi. Bunlari LAN ici SFTP deploy hattiyla gonderin." -ForegroundColor Yellow
  }
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

Assert-HotelDesktopReleaseManifest

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

Unstage-LargeBuildOutputs

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
