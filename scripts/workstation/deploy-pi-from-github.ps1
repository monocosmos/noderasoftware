param(
  [ValidatePattern("^[A-Za-z0-9._@-]+$")]
  [string] $PiHost = "noderapi",

  [ValidatePattern("^[A-Za-z0-9._/-]+$")]
  [string] $Branch = "master",

  [ValidateSet("all", "home", "hotel", "videowallplayer")]
  [string] $Section = "hotel",

  [ValidatePattern("^/[A-Za-z0-9._/-]+$")]
  [string] $AppDir = "/opt/noderasoftware",

  [string] $RepoRoot = "C:\Users\hfk47\Documents\noderasoftware\github-sync",

  [switch] $ForceSourceFallback,

  [switch] $KeepTemp
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

if ($AppDir -in @("/", "/opt", "/home", "/usr", "/var", "/etc", "/tmp")) {
  throw "Guvenlik icin APP_DIR cok genis bir sistem dizini olamaz: $AppDir"
}

$ssh = (Get-Command ssh -ErrorAction Stop).Source
$scp = (Get-Command scp -ErrorAction Stop).Source
$git = (Get-Command git -ErrorAction Stop).Source
$RepoRoot = (Resolve-Path $RepoRoot).Path

function Quote-BashValue {
  param(
    [Parameter(Mandatory = $true)]
    [string] $Value
  )
  return "'" + ($Value -replace "'", "'\''") + "'"
}

function Invoke-External {
  param(
    [Parameter(Mandatory = $true)]
    [string] $Command,

    [Parameter(Mandatory = $true)]
    [string[]] $Arguments,

    [switch] $AllowFailure
  )

  & $Command @Arguments
  $exitCode = $LASTEXITCODE
  if ($exitCode -ne 0 -and -not $AllowFailure) {
    throw "Komut basarisiz oldu ($exitCode): $Command $($Arguments -join ' ')"
  }
  return $exitCode
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

function Invoke-RemoteDeployFromGitHub {
  $quotedAppDir = Quote-BashValue -Value $AppDir
  $quotedBranch = Quote-BashValue -Value $Branch
  $quotedSection = Quote-BashValue -Value $Section
  $quotedFetchRefSpec = Quote-BashValue -Value "+refs/heads/${Branch}:refs/remotes/origin/${Branch}"
  $quotedDeployScriptRef = Quote-BashValue -Value "origin/${Branch}:scripts/pi/deploy-from-github.sh"
  $quotedTempDeployScript = Quote-BashValue -Value "/tmp/noderasoftware-deploy-from-github.sh"
  $sectionGuard = if ($Section -eq "all") {
    "true"
  } else {
    "grep -q 'deploy_section_from_github' $quotedTempDeployScript || { echo 'GitHub deploy scripti SECTION desteklemiyor; source fallback kullanilacak.' >&2; exit 42; }"
  }
  $remoteCommand = "sudo git -C $quotedAppDir fetch --prune origin $quotedFetchRefSpec && sudo git -C $quotedAppDir show $quotedDeployScriptRef > $quotedTempDeployScript && $sectionGuard && sudo APP_DIR=$quotedAppDir BRANCH=$quotedBranch SECTION=$quotedSection bash $quotedTempDeployScript"
  return Invoke-External $ssh @($PiHost, $remoteCommand) -AllowFailure
}

function Assert-LocalHeadIsPushed {
  Set-Location $RepoRoot
  Invoke-External $git @("fetch", "origin", $Branch) | Out-Null
  $head = (Invoke-Captured $git @("rev-parse", "HEAD") | Select-Object -First 1).Trim()
  $remote = (Invoke-Captured $git @("rev-parse", "origin/$Branch") | Select-Object -First 1).Trim()
  if ($head -ne $remote) {
    throw "Yerel HEAD GitHub origin/$Branch ile ayni degil. Once GitHub'a push edin."
  }
  return $head.Substring(0, 7)
}

function Invoke-SourceFallbackDeploy {
  if ($Section -eq "all") {
    throw "Source fallback section=all icin desteklenmiyor. Pi GitHub erisimini duzeltin veya section deploy kullanin."
  }

  $shortSha = Assert-LocalHeadIsPushed
  $archive = Join-Path $env:TEMP "noderasoftware-$shortSha-lite.tar.gz"
  $remoteArchive = "/tmp/noderasoftware-source-$shortSha-lite.tar.gz"
  $remoteSourceDir = "/tmp/noderasoftware-source-$shortSha-lite"
  $remoteScript = "/tmp/noderasoftware-deploy-from-source-$shortSha.sh"
  $localDeployScript = Join-Path $RepoRoot "scripts\pi\deploy-from-github.sh"

  if (-not (Test-Path -LiteralPath $localDeployScript)) {
    throw "Deploy script bulunamadi: $localDeployScript"
  }

  if (Test-Path -LiteralPath $archive) {
    Remove-Item -LiteralPath $archive -Force
  }

  Write-Host "==> Kucuk kaynak arsivi hazirlaniyor: $shortSha"
  Set-Location $RepoRoot
  $archiveArgs = @(
    "archive",
    "--format=tar.gz",
    "--output=$archive",
    "HEAD",
    "--",
    ".",
    ":(exclude)apps/web/out/*"
  )
  if ($Section -ne "videowallplayer") {
    $archiveArgs += ":(exclude)apps/web/public/downloads/*"
  }
  Invoke-External $git $archiveArgs | Out-Null

  Write-Host "==> Kaynak arsivi Pi'ye aktariliyor"
  Invoke-External $scp @($archive, "${PiHost}:$remoteArchive") | Out-Null
  Invoke-External $scp @($localDeployScript, "${PiHost}:$remoteScript") | Out-Null

  $quotedArchive = Quote-BashValue -Value $remoteArchive
  $quotedSourceDir = Quote-BashValue -Value $remoteSourceDir
  $quotedScript = Quote-BashValue -Value $remoteScript
  $quotedAppDir = Quote-BashValue -Value $AppDir
  $quotedBranch = Quote-BashValue -Value $Branch
  $quotedSection = Quote-BashValue -Value $Section

  $cleanup = if ($KeepTemp) { "true" } else { "sudo rm -rf $quotedSourceDir $quotedArchive $quotedScript" }
  $remoteCommand = "sudo rm -rf $quotedSourceDir && sudo mkdir -p $quotedSourceDir && sudo tar -xzf $quotedArchive -C $quotedSourceDir && sudo APP_DIR=$quotedAppDir BRANCH=$quotedBranch SECTION=$quotedSection SOURCE_DIR=$quotedSourceDir bash $quotedScript; status=`$?; $cleanup; exit `$status"

  Write-Host "==> Pi SOURCE_DIR deploy baslatiliyor"
  Invoke-External $ssh @($PiHost, $remoteCommand) | Out-Null
}

if ($ForceSourceFallback) {
  Invoke-SourceFallbackDeploy
} else {
  Write-Host "==> Pi GitHub deploy deneniyor"
  $exitCode = Invoke-RemoteDeployFromGitHub
  if ($exitCode -ne 0) {
    Write-Host "GitHub deploy basarisiz oldu. Source fallback deneniyor..." -ForegroundColor Yellow
    Invoke-SourceFallbackDeploy
  }
}

Write-Host "==> Canli servis kontrolu"
Invoke-External $ssh @($PiHost, "curl -fsS http://127.0.0.1:4000/health && echo && sudo systemctl is-active hotelops-api && sudo systemctl is-active nginx && sudo nginx -t") | Out-Null
Write-Host "Raspberry Pi yayin tamam: $Section / $Branch" -ForegroundColor Green
