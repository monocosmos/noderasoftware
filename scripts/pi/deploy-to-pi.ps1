param(
  [Parameter(Mandatory = $true)]
  [string] $PiHost,

  [string] $PiUser = "raspberrypiserveradmin",

  [int] $SshPort = 0,

  [string] $SourceZip = "",

  [string] $DatabaseDump = "",

  [switch] $ExportDatabase,

  [switch] $RestoreDatabase,

  [switch] $SetupSftp,

  [switch] $SetupSsl,

  [string] $Domain = "noderasoftware.com",

  [string] $Email = ""
)

$ErrorActionPreference = "Stop"

$root = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$sshPortArgs = @()
$scpPortArgs = @()
if ($SshPort -gt 0) {
  $sshPortArgs = @("-p", "$SshPort")
  $scpPortArgs = @("-P", "$SshPort")
}

if (-not $SourceZip) {
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "package-for-pi.ps1")
  $SourceZip = Join-Path $root "noderasoftware-pi-source.zip"
}

if ($ExportDatabase) {
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "export-current-db.ps1")
  $DatabaseDump = Get-ChildItem -Path (Join-Path $root "db-backups") -Filter "*.dump" |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1 -ExpandProperty FullName
}

if (-not (Test-Path $SourceZip)) {
  throw "Kaynak zip bulunamadi: $SourceZip"
}

Write-Host "==> Kaynak paket Pi'ye kopyalaniyor" -ForegroundColor Cyan
scp @scpPortArgs "$SourceZip" "${PiUser}@${PiHost}:/tmp/noderasoftware-pi-source.zip"

if ($RestoreDatabase) {
  if (-not $DatabaseDump) {
    throw "-RestoreDatabase icin -DatabaseDump verin veya -ExportDatabase kullanin."
  }
  if (-not (Test-Path $DatabaseDump)) {
    throw "Database dump bulunamadi: $DatabaseDump"
  }

  Write-Host "==> Veritabani yedegi Pi'ye kopyalaniyor" -ForegroundColor Cyan
  scp @scpPortArgs "$DatabaseDump" "${PiUser}@${PiHost}:/tmp/hotelops-current.dump"
}

$remoteCommands = @(
  "sudo mkdir -p /opt/noderasoftware",
  'sudo unzip -o /tmp/noderasoftware-pi-source.zip -d /opt/noderasoftware || [ $? -le 1 ]',
  "sudo find /opt/noderasoftware -path /opt/noderasoftware/node_modules -prune -o -type d -exec chmod 755 {} +",
  "sudo find /opt/noderasoftware -path /opt/noderasoftware/node_modules -prune -o -type f -exec chmod 644 {} +",
  "sudo chmod +x /opt/noderasoftware/scripts/pi/*.sh /opt/noderasoftware/apps/desktop/scripts/*.sh 2>/dev/null || true",
  "cd /opt/noderasoftware && sudo bash scripts/pi/setup-raspberry-pi.sh"
)

if ($RestoreDatabase) {
  $remoteCommands += "cd /opt/noderasoftware && sudo bash scripts/pi/restore-postgres-dump.sh /tmp/hotelops-current.dump"
}

if ($SetupSftp) {
  $remoteCommands += "cd /opt/noderasoftware && sudo bash scripts/pi/setup-sftp-editor.sh"
}

if ($SetupSsl) {
  if ($Email.Trim()) {
    $remoteCommands += "cd /opt/noderasoftware && sudo bash scripts/pi/setup-ssl-certbot.sh '$Domain' '$Email'"
  } else {
    $remoteCommands += "cd /opt/noderasoftware && sudo bash scripts/pi/setup-ssl-certbot.sh '$Domain'"
  }
}

$remoteScript = $remoteCommands -join " && "

Write-Host "==> Pi uzerinde kurulum calistiriliyor" -ForegroundColor Cyan
ssh @sshPortArgs -tt "${PiUser}@${PiHost}" $remoteScript

Write-Host "==> Uzak saglik kontrolu" -ForegroundColor Cyan
ssh @sshPortArgs "${PiUser}@${PiHost}" "curl -fsS http://127.0.0.1:4000/health && echo && systemctl --no-pager --full status hotelops-api | sed -n '1,10p'"
