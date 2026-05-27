param(
  [string] $PiHost = "192.168.1.126",

  [string] $PiUser = "raspberrypiserveradmin",

  [int] $SshPort = 0,

  [string] $HostAlias = "noderapi",

  [string] $KeyPath = "$HOME\.ssh\noderasoftware_pi_ed25519",

  [string] $SftpUser = "webedit",

  [switch] $DisableSshPasswordLogin
)

$ErrorActionPreference = "Stop"

$sshKeygen = Get-Command ssh-keygen.exe -ErrorAction SilentlyContinue
if (-not $sshKeygen) {
  throw "ssh-keygen.exe bulunamadi. Windows OpenSSH Client kurulu olmali."
}

$ssh = Get-Command ssh.exe -ErrorAction SilentlyContinue
if (-not $ssh) {
  throw "ssh.exe bulunamadi. Windows OpenSSH Client kurulu olmali."
}

$sshDir = Split-Path -Parent $KeyPath
New-Item -ItemType Directory -Path $sshDir -Force | Out-Null
$sshPortArgs = @()
if ($SshPort -gt 0) {
  $sshPortArgs = @("-p", "$SshPort")
}

function New-NoderaSshKey {
  if (Test-Path $KeyPath) {
    Remove-Item -LiteralPath $KeyPath -Force
  }
  if (Test-Path "$KeyPath.pub") {
    Remove-Item -LiteralPath "$KeyPath.pub" -Force
  }

  Write-Host "==> SSH key olusturuluyor: $KeyPath" -ForegroundColor Cyan
  $keyComment = "noderasoftware-pi"
  $keygenArgs = @(
    "-q",
    "-t",
    "ed25519",
    "-f",
    "`"$KeyPath`"",
    "-N",
    '""',
    "-C",
    "`"$keyComment`""
  )
  $keygenProcess = Start-Process -FilePath $sshKeygen.Source -ArgumentList $keygenArgs -Wait -NoNewWindow -PassThru
  if ($keygenProcess.ExitCode -ne 0) {
    throw "ssh-keygen basarisiz oldu. Exit code: $($keygenProcess.ExitCode)"
  }
}

$publicKeyPath = "$KeyPath.pub"
if (-not (Test-Path $KeyPath)) {
  New-NoderaSshKey
}

if (-not (Test-Path $publicKeyPath)) {
  if (Test-Path $KeyPath) {
    Write-Host "==> Public key dosyasi eksik; private key uzerinden yeniden uretiliyor." -ForegroundColor Yellow
    $derivedPublicKey = & $sshKeygen.Source -y -f $KeyPath
    if ($LASTEXITCODE -eq 0 -and $derivedPublicKey) {
      $derivedPublicKey | Set-Content -Path $publicKeyPath -Encoding ascii
    } else {
      Write-Host "==> Mevcut key okunamadi; temiz key yeniden olusturuluyor." -ForegroundColor Yellow
      New-NoderaSshKey
    }
  }
}

if (-not (Test-Path $publicKeyPath)) {
  throw "Public key bulunamadi: $publicKeyPath"
}

$publicKey = (Get-Content $publicKeyPath -Raw).Trim()
if (-not $publicKey) {
  Write-Host "==> Public key bos gorunuyor; temiz key yeniden olusturuluyor." -ForegroundColor Yellow
  New-NoderaSshKey
  $publicKey = (Get-Content $publicKeyPath -Raw).Trim()
}

if (-not $publicKey) {
  throw "Public key bos veya okunamiyor: $publicKeyPath"
}

$publicKeyB64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($publicKey))
$disablePasswordLoginValue = if ($DisableSshPasswordLogin) { "yes" } else { "no" }

$bootstrapScript = @"
set -Eeuo pipefail

PUB_KEY_B64='$publicKeyB64'
PUB_KEY=`$(printf '%s' "`$PUB_KEY_B64" | base64 -d)

mkdir -p "`$HOME/.ssh"
chmod 700 "`$HOME/.ssh"
touch "`$HOME/.ssh/authorized_keys"
if ! grep -qxF "`$PUB_KEY" "`$HOME/.ssh/authorized_keys"; then
  printf '%s\n' "`$PUB_KEY" >> "`$HOME/.ssh/authorized_keys"
fi
chmod 600 "`$HOME/.ssh/authorized_keys"

cat > /tmp/noderasoftware-enable-passwordless-root.sh <<'ROOTSCRIPT'
#!/usr/bin/env bash
set -Eeuo pipefail

PI_USER='$PiUser'
SFTP_USER='$SftpUser'
PUB_KEY_B64='$publicKeyB64'
DISABLE_PASSWORD_LOGIN='$disablePasswordLoginValue'
PUB_KEY=`$(printf '%s' "`$PUB_KEY_B64" | base64 -d)

cat > /etc/sudoers.d/010-noderasoftware-passwordless <<EOF
$PiUser ALL=(ALL) NOPASSWD:ALL
EOF
chmod 440 /etc/sudoers.d/010-noderasoftware-passwordless
visudo -cf /etc/sudoers.d/010-noderasoftware-passwordless

if id "`$SFTP_USER" >/dev/null 2>&1; then
  SFTP_HOME=`$(getent passwd "`$SFTP_USER" | cut -d: -f6)
  install -d -m 700 -o "`$SFTP_USER" -g "`$SFTP_USER" "`$SFTP_HOME/.ssh"
  touch "`$SFTP_HOME/.ssh/authorized_keys"
  if ! grep -qxF "`$PUB_KEY" "`$SFTP_HOME/.ssh/authorized_keys"; then
    printf '%s\n' "`$PUB_KEY" >> "`$SFTP_HOME/.ssh/authorized_keys"
  fi
  chown "`$SFTP_USER:`$SFTP_USER" "`$SFTP_HOME/.ssh/authorized_keys"
  chmod 600 "`$SFTP_HOME/.ssh/authorized_keys"
fi

if [ "`$DISABLE_PASSWORD_LOGIN" = "yes" ]; then
  cp /etc/ssh/sshd_config /etc/ssh/sshd_config.noderasoftware-backup
  if grep -qE '^[#[:space:]]*PasswordAuthentication' /etc/ssh/sshd_config; then
    sed -i -E 's/^[#[:space:]]*PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
  else
    echo 'PasswordAuthentication no' >> /etc/ssh/sshd_config
  fi
  systemctl reload ssh || systemctl reload sshd
fi

rm -f /tmp/noderasoftware-enable-passwordless-root.sh
echo 'PASSWORDLESS_READY'
ROOTSCRIPT

chmod 700 /tmp/noderasoftware-enable-passwordless-root.sh
echo 'USER_KEY_READY'
"@

Write-Host "==> Pi'ye baglaniliyor. Bu adimda Pi SSH sifreni bir kez isteyebilir." -ForegroundColor Yellow
$bootstrapScript | & $ssh.Source @sshPortArgs "${PiUser}@${PiHost}" "bash -s"

Write-Host "==> Passwordless sudo ayarlaniyor. Bu adim sudo sifreni bir kez isteyebilir." -ForegroundColor Yellow
& $ssh.Source @sshPortArgs -tt -i $KeyPath "${PiUser}@${PiHost}" "sudo bash /tmp/noderasoftware-enable-passwordless-root.sh"

$configPath = Join-Path $sshDir "config"
$identityFileForConfig = $KeyPath.Replace("\", "/")
$portLine = if ($SshPort -gt 0) { "  Port $SshPort`r`n" } else { "" }
$configBlock = @"
# >>> noderasoftware pi
Host $HostAlias
  HostName $PiHost
  User $PiUser
${portLine}  IdentityFile $identityFileForConfig
  IdentitiesOnly yes
# <<< noderasoftware pi
"@

$existingConfig = if (Test-Path $configPath) { Get-Content $configPath -Raw } else { "" }
$updatedConfig = if ($existingConfig -match "(?s)# >>> noderasoftware pi.*?# <<< noderasoftware pi\r?\n?") {
  $existingConfig -replace "(?s)# >>> noderasoftware pi.*?# <<< noderasoftware pi\r?\n?", "$configBlock`r`n"
} else {
  ($existingConfig.TrimEnd() + "`r`n`r`n" + $configBlock + "`r`n").TrimStart()
}

Set-Content -Path $configPath -Value $updatedConfig -Encoding ascii

Write-Host "==> Test ediliyor" -ForegroundColor Cyan
& $ssh.Source @sshPortArgs -i $KeyPath -o BatchMode=yes "${PiUser}@${PiHost}" "sudo -n true && echo SSH_AND_SUDO_PASSWORDLESS_OK"

Write-Host ""
Write-Host "Hazir. Bundan sonra su komutlar sifresiz calismali:" -ForegroundColor Green
Write-Host "ssh $HostAlias"
Write-Host "ssh $HostAlias `"sudo systemctl status hotelops-api`""
Write-Host "scp `"C:\path\file.txt`" ${HostAlias}:/home/${PiUser}/Desktop/"
