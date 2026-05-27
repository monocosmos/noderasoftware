param(
  [string] $PiHost = "noderapi",

  [string] $PiUser = "raspberrypiserveradmin",

  [int] $SshPort = 0,

  [string] $RemoteProjectPath = "/opt/noderasoftware",

  [switch] $SkipLocalBackup
)

$ErrorActionPreference = "Stop"

$root = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$tempRoot = Join-Path $env:TEMP "noderasoftware-sync-$timestamp"
$stage = Join-Path $tempRoot "source"
$downloadArchive = Join-Path $tempRoot "noderasoftware-pi-source.tgz"
$remoteArchive = "/tmp/noderasoftware-source-$timestamp.tgz"
$backupDir = Join-Path $root "_local-backups"
$backupZip = Join-Path $backupDir "before-pi-sync-$timestamp.zip"

$sshPortArgs = @()
$scpPortArgs = @()
if ($SshPort -gt 0) {
  $sshPortArgs = @("-p", "$SshPort")
  $scpPortArgs = @("-P", "$SshPort")
}

$excludeDirs = @(
  ".git",
  "node_modules",
  ".next",
  "out",
  "dist",
  "build",
  "release",
  "mac-artifacts",
  "_android_review",
  "_local-backups",
  "db-backups",
  "coverage",
  "tools",
  "site",
  "lo-profile*",
  "docx-render*",
  "simple-render",
  "render-bin",
  "pdf-png-test"
)

$excludeFiles = @(
  ".env",
  "*.log",
  "*.err",
  "*.zip",
  "*.rar",
  "*.7z",
  "*.docx",
  "*.tsbuildinfo",
  "wwwroot.zip",
  "desktop-*.png",
  "hotelops-task-*.txt",
  "hotelops-start-script-debug.txt"
)

function Copy-SourceTree {
  param(
    [Parameter(Mandatory = $true)]
    [string] $From,

    [Parameter(Mandatory = $true)]
    [string] $To
  )

  $robocopyArgs = @(
    $From,
    $To,
    "/E",
    "/NFL",
    "/NDL",
    "/NJH",
    "/NJS",
    "/NP",
    "/XD"
  ) + $excludeDirs + @("/XF") + $excludeFiles

  & robocopy @robocopyArgs | Out-Null
  if ($LASTEXITCODE -gt 7) {
    throw "robocopy failed with exit code $LASTEXITCODE"
  }
}

try {
  New-Item -ItemType Directory -Path $tempRoot -Force | Out-Null
  New-Item -ItemType Directory -Path $stage -Force | Out-Null

  if (-not $SkipLocalBackup) {
    Write-Host "==> Yerel kaynak yedegi aliniyor" -ForegroundColor Cyan
    New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
    $backupStage = Join-Path $tempRoot "local-backup"
    New-Item -ItemType Directory -Path $backupStage -Force | Out-Null
    Copy-SourceTree -From $root -To $backupStage
    Compress-Archive -Path (Join-Path $backupStage "*") -DestinationPath $backupZip -CompressionLevel Optimal
    Write-Host "    $backupZip"
  }

  $tarExcludes = @(
    "--exclude=.git",
    "--exclude=node_modules",
    "--exclude=.next",
    "--exclude=out",
    "--exclude=dist",
    "--exclude=build",
    "--exclude=release",
    "--exclude=mac-artifacts",
    "--exclude=_android_review",
    "--exclude=_local-backups",
    "--exclude=db-backups",
    "--exclude=coverage",
    "--exclude=*.log",
    "--exclude=*.err",
    "--exclude=*.zip",
    "--exclude=*.rar",
    "--exclude=*.7z",
    "--exclude=.env"
  ) -join " "

  $remoteOwner = "${PiUser}:${PiUser}"
  $remoteCommand = "cd '$RemoteProjectPath' && sudo tar $tarExcludes -czf '$remoteArchive' . && sudo chown '$remoteOwner' '$remoteArchive'"

  Write-Host "==> Pi uzerindeki kaynak paketleniyor" -ForegroundColor Cyan
  ssh @sshPortArgs "${PiUser}@${PiHost}" $remoteCommand

  Write-Host "==> Kaynak paketi indiriliyor" -ForegroundColor Cyan
  scp @scpPortArgs "${PiUser}@${PiHost}:$remoteArchive" "$downloadArchive"

  Write-Host "==> Yerel klasore aciliyor" -ForegroundColor Cyan
  tar -xzf "$downloadArchive" -C "$stage"
  Copy-SourceTree -From $stage -To $root

  Write-Host "==> Uzak gecici paket temizleniyor" -ForegroundColor Cyan
  ssh @sshPortArgs "${PiUser}@${PiHost}" "rm -f '$remoteArchive'"

  Write-Host ""
  Write-Host "Pi kaynak kodu bu bilgisayara cekildi." -ForegroundColor Green
  Write-Host $root
} finally {
  if (Test-Path $tempRoot) {
    Remove-Item -LiteralPath $tempRoot -Recurse -Force
  }
}
