$ErrorActionPreference = "Stop"

$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($identity)
$isAdmin = $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
  throw "This script must be run as Administrator."
}

$pgRoot = "C:\Program Files\PostgreSQL\18"
$bin = Join-Path $pgRoot "bin"
$data = Join-Path $pgRoot "data"
$serviceName = "postgresql-x64-18"
$projectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
$logFile = Join-Path $projectRoot "postgres-initialize.log"
$pwFile = Join-Path $env:TEMP "postgres-pw.txt"

"hotelops" | Set-Content -Path $pwFile -NoNewline
"Initialize at $(Get-Date -Format o)" | Set-Content -Path $logFile

if (-not (Test-Path -LiteralPath (Join-Path $data "postgresql.conf"))) {
  if (-not (Test-Path -LiteralPath $data)) {
    New-Item -ItemType Directory -Path $data -Force | Out-Null
  }
  "Running initdb" | Add-Content -Path $logFile
  & (Join-Path $bin "initdb.exe") -D $data -U postgres --pwfile $pwFile -E UTF8 --locale=C 2>&1 | Add-Content -Path $logFile
}

$service = Get-CimInstance Win32_Service -Filter "Name='$serviceName'" -ErrorAction SilentlyContinue
if (-not $service) {
  "Registering service" | Add-Content -Path $logFile
  & (Join-Path $bin "pg_ctl.exe") register -N $serviceName -D $data -S auto 2>&1 | Add-Content -Path $logFile
}

if ((Get-Service -Name $serviceName).Status -ne "Running") {
  "Starting service" | Add-Content -Path $logFile
  Start-Service -Name $serviceName
  Start-Sleep -Seconds 5
}

$env:PGPASSWORD = "hotelops"
$sql = @"
DO
`$do`$
BEGIN
   IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'hotelops') THEN
      CREATE ROLE hotelops LOGIN PASSWORD 'hotelops';
   END IF;
END
`$do`$;
SELECT 'CREATE DATABASE hotelops OWNER hotelops'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'hotelops')\gexec
GRANT ALL PRIVILEGES ON DATABASE hotelops TO hotelops;
"@
$sqlFile = Join-Path $env:TEMP "hotelops-create-db.sql"
$sql | Set-Content -Path $sqlFile -Encoding UTF8

"Creating hotelops role/database" | Add-Content -Path $logFile
& (Join-Path $bin "psql.exe") -h 127.0.0.1 -p 5432 -U postgres -d postgres -f $sqlFile 2>&1 | Add-Content -Path $logFile

Remove-Item -LiteralPath $pwFile -Force -ErrorAction SilentlyContinue
Remove-Item -LiteralPath $sqlFile -Force -ErrorAction SilentlyContinue

Get-Service -Name $serviceName | Select-Object Name,Status,DisplayName | Format-List | Out-String | Add-Content -Path $logFile
