$ErrorActionPreference = "Stop"

$root = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$envPath = Join-Path $root ".env"
$backupDir = Join-Path $root "db-backups"

if (-not (Test-Path $envPath)) {
  throw ".env dosyasi bulunamadi: $envPath"
}

$databaseUrlLine = Get-Content $envPath | Where-Object { $_ -match '^DATABASE_URL=' } | Select-Object -First 1
if (-not $databaseUrlLine) {
  throw ".env icinde DATABASE_URL bulunamadi."
}

$databaseUrl = ($databaseUrlLine -replace '^DATABASE_URL=', '').Trim().Trim('"').Trim("'")

$pgDumpCandidates = @(
  "pg_dump.exe",
  "C:\Program Files\PostgreSQL\18\bin\pg_dump.exe",
  "C:\Program Files\PostgreSQL\17\bin\pg_dump.exe",
  "C:\Program Files\PostgreSQL\16\bin\pg_dump.exe",
  "C:\Program Files\PostgreSQL\15\bin\pg_dump.exe"
)

$pgDump = $null
foreach ($candidate in $pgDumpCandidates) {
  $resolved = Get-Command $candidate -ErrorAction SilentlyContinue
  if ($resolved) {
    $pgDump = $resolved.Source
    break
  }
  if (Test-Path $candidate) {
    $pgDump = $candidate
    break
  }
}

if (-not $pgDump) {
  throw "pg_dump.exe bulunamadi. PostgreSQL bin klasorunu PATH'e ekleyin veya scriptteki aday yollari guncelleyin."
}

New-Item -ItemType Directory -Path $backupDir -Force | Out-Null

$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$dumpPath = Join-Path $backupDir "hotelops-$stamp.dump"

& $pgDump `
  --format=custom `
  --no-owner `
  --no-privileges `
  --dbname=$databaseUrl `
  --file=$dumpPath

if ($LASTEXITCODE -ne 0) {
  throw "pg_dump basarisiz oldu."
}

Write-Host "Veritabani yedegi hazir:" -ForegroundColor Green
Write-Host $dumpPath
Write-Host ""
Write-Host "Raspberry Pi'ye kopyalama ornegi:"
Write-Host "scp `"$dumpPath`" pi@RASPBERRY_PI_IP:/tmp/"
