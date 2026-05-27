$ErrorActionPreference = "Stop"

$root = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$output = Join-Path $root "noderasoftware-pi-source.zip"
$stage = Join-Path $env:TEMP ("noderasoftware-pi-package-" + [guid]::NewGuid().ToString("N"))

if (Test-Path $output) {
  Remove-Item -LiteralPath $output -Force
}

New-Item -ItemType Directory -Path $stage -Force | Out-Null

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

try {
  $robocopyArgs = @(
    $root,
    $stage,
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

  Compress-Archive -Path (Join-Path $stage "*") -DestinationPath $output -CompressionLevel Optimal
} finally {
  if (Test-Path $stage) {
    Remove-Item -LiteralPath $stage -Recurse -Force
  }
}

Write-Host "Pi kaynak paketi hazir:" -ForegroundColor Green
Write-Host $output
Write-Host ""
Write-Host "Raspberry Pi'ye kopyalama ornegi:"
Write-Host "scp `"$output`" raspberrypiserveradmin@192.168.1.126:/tmp/"
