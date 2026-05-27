param(
  [switch] $InstallDependencies,
  [switch] $SkipDependencies,
  [switch] $CopyPrivateKey,
  [switch] $CheckPi,
  [switch] $StartDev,
  [switch] $DeployToPi
)

$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
Set-Location $root

function Write-Step {
  param([string] $Message)
  Write-Host "==> $Message" -ForegroundColor Cyan
}

function Test-CommandExists {
  param([string] $Name)
  return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

Write-Step "Nodera Software / HotelOps offline proje baslatiliyor"
Write-Host "Proje klasoru: $root"

$handoff = Join-Path $root "docs\CODEX_PROJECT_HANDOFF.md"
$privateHandoff = Join-Path $root "docs\CODEX_PRIVATE_HANDOFF.local.md"

if (Test-Path $handoff) {
  Write-Host "Handoff bulundu: $handoff" -ForegroundColor Green
} else {
  throw "Handoff dosyasi bulunamadi: $handoff"
}

if (Test-Path $privateHandoff) {
  Write-Host "Private handoff bulundu: $privateHandoff" -ForegroundColor Green
} else {
  Write-Host "Private handoff yok. Pi sifresi/key bilgisi bu pakette olmayabilir." -ForegroundColor Yellow
}

if (-not (Test-CommandExists "ssh.exe")) {
  throw "OpenSSH bulunamadi. Windows Optional Features icinden OpenSSH Client kurulmalidir."
}

if (-not (Test-CommandExists "node.exe")) {
  throw "Node.js bulunamadi. Once Node.js LTS kurulmalidir."
}

if (-not (Test-CommandExists "npm.cmd")) {
  throw "npm bulunamadi. Node.js kurulumu kontrol edilmelidir."
}

if ($CopyPrivateKey) {
  Write-Step "Private SSH key kullanici .ssh klasorune kopyalaniyor"
  $sshDir = Join-Path $env:USERPROFILE ".ssh"
  New-Item -ItemType Directory -Path $sshDir -Force | Out-Null

  $sourceKey = Join-Path $root "secrets\noderasoftware_pi_ed25519"
  $sourcePub = Join-Path $root "secrets\noderasoftware_pi_ed25519.pub"
  $targetKey = Join-Path $sshDir "noderasoftware_pi_ed25519"
  $targetPub = Join-Path $sshDir "noderasoftware_pi_ed25519.pub"

  if (Test-Path $sourceKey) {
    Copy-Item -LiteralPath $sourceKey -Destination $targetKey -Force
    Write-Host "Private key kopyalandi: $targetKey" -ForegroundColor Green
  } else {
    Write-Host "Private key pakette yok: $sourceKey" -ForegroundColor Yellow
  }

  if (Test-Path $sourcePub) {
    Copy-Item -LiteralPath $sourcePub -Destination $targetPub -Force
    Write-Host "Public key kopyalandi: $targetPub" -ForegroundColor Green
  }
}

Write-Step "SSH profilleri hazirlaniyor"
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $root "scripts\workstation\setup-noderapi-ssh.ps1")

if ($SkipDependencies) {
  Write-Host "Dependency kurulumu SkipDependencies ile atlandi." -ForegroundColor Yellow
} elseif ($InstallDependencies -or -not (Test-Path (Join-Path $root "node_modules"))) {
  Write-Step "Node bagimliliklari kuruluyor"
  npm.cmd ci
} else {
  Write-Host "node_modules bulundu, npm ci atlandi." -ForegroundColor Green
}

if ($CheckPi) {
  Write-Step "Raspberry Pi baglantisi kontrol ediliyor"
  & ssh.exe -o BatchMode=yes noderapi "hostname; whoami; systemctl is-active hotelops-api nginx postgresql ssh; curl -fsS http://127.0.0.1:4000/health"
}

if ($DeployToPi) {
  Write-Step "Deploy oncesi build ciktisi kontrol ediliyor"
  $apiDist = Join-Path $root "apps\api\dist"
  $webOut = Join-Path $root "apps\web\out"
  if (-not (Test-Path $apiDist) -or -not (Test-Path $webOut)) {
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $root "scripts\workstation\build-local.ps1")
  }

  Write-Step "Raspberry Pi'ye deploy ediliyor"
  & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $root "scripts\workstation\publish-to-pi.ps1") -SkipBuild -IncludeDownloads

  Write-Step "Deploy sonrasi saglik kontrolu"
  & ssh.exe noderapi "systemctl is-active hotelops-api nginx postgresql ssh; curl -fsS http://127.0.0.1:4000/health; sudo nginx -t"
}

if ($StartDev) {
  Write-Step "Local gelistirme servisleri baslatiliyor"
  Start-Process powershell.exe -ArgumentList @("-NoExit", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", "cd `"$root`"; npm run api:dev") -WorkingDirectory $root
  Start-Sleep -Seconds 2
  Start-Process powershell.exe -ArgumentList @("-NoExit", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", "cd `"$root`"; npm run dev") -WorkingDirectory $root
  Write-Host "Web: http://127.0.0.1:3000/hotel/login" -ForegroundColor Green
  Write-Host "API: http://127.0.0.1:4000/health" -ForegroundColor Green
}

Write-Host ""
Write-Host "Offline proje baslatma tamamlandi." -ForegroundColor Green
Write-Host "Yeni Codex oturumunda once docs\CODEX_PROJECT_HANDOFF.md ve docs\CODEX_PRIVATE_HANDOFF.local.md okutulmalidir."
