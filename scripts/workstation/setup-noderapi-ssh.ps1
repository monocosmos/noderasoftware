param(
  [string] $HostName = "noderasoftware.com",
  [string] $User = "raspberrypiserveradmin",
  [int] $Port = 2222,
  [string] $KeyPath = "$env:USERPROFILE\.ssh\noderasoftware_pi_ed25519"
)

$ErrorActionPreference = "Stop"

$sshDir = Join-Path $env:USERPROFILE ".ssh"
$configPath = Join-Path $sshDir "config"
$normalizedKeyPath = $KeyPath.Replace("\", "/")

New-Item -ItemType Directory -Path $sshDir -Force | Out-Null

$existing = ""
if (Test-Path $configPath) {
  $existing = Get-Content -Raw $configPath
}

$block = @"
# >>> noderasoftware pi
Host noderapi
  HostName $HostName
  User $User
  Port $Port
  IdentityFile $normalizedKeyPath
  IdentitiesOnly yes
  ServerAliveInterval 30
  ServerAliveCountMax 3

Host noderapi-sftp
  HostName $HostName
  User $User
  Port $Port
  PreferredAuthentications password,keyboard-interactive
  PubkeyAuthentication no
  ServerAliveInterval 30
  ServerAliveCountMax 3
# <<< noderasoftware pi
"@

$pattern = "(?s)# >>> noderasoftware pi.*?# <<< noderasoftware pi"
if ($existing -match $pattern) {
  $updated = [regex]::Replace($existing, $pattern, $block.TrimEnd())
} elseif ($existing.Trim()) {
  $updated = $existing.TrimEnd() + [Environment]::NewLine + [Environment]::NewLine + $block
} else {
  $updated = $block
}

Set-Content -Path $configPath -Value $updated -Encoding utf8

Write-Host "SSH profilleri hazir:" -ForegroundColor Green
Write-Host "  noderapi      -> Codex/deploy profili"
Write-Host "  noderapi-sftp -> sifreli manuel SFTP profili"
Write-Host ""
Write-Host "Kontrol:"
Write-Host "  ssh -G noderapi | Select-String 'hostname|port|user'"
