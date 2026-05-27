param(
  [string] $GoogleServicesJson = "",
  [string] $ServiceAccountJson = "",
  [string] $PiHost = "noderapi",
  [string] $PiUser = "raspberrypiserveradmin"
)

$ErrorActionPreference = "Stop"

$root = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$androidFirebaseTarget = Join-Path $root "apps\android\app\google-services.json"
$localServiceAccountTarget = Join-Path $root "secrets\firebase-service-account.json"

if (-not $GoogleServicesJson -and (Test-Path -LiteralPath $androidFirebaseTarget)) {
  $GoogleServicesJson = $androidFirebaseTarget
}

if (-not $ServiceAccountJson -and (Test-Path -LiteralPath $localServiceAccountTarget)) {
  $ServiceAccountJson = $localServiceAccountTarget
}

if (-not $GoogleServicesJson) {
  throw "Android google-services.json yolu verilmedi ve apps\android\app\google-services.json bulunamadi."
}

if (-not $ServiceAccountJson) {
  throw "Firebase service account JSON yolu verilmedi ve secrets\firebase-service-account.json bulunamadi."
}

if (-not (Test-Path -LiteralPath $GoogleServicesJson)) {
  throw "google-services.json bulunamadi: $GoogleServicesJson"
}

if (-not (Test-Path -LiteralPath $ServiceAccountJson)) {
  throw "Firebase service account JSON bulunamadi: $ServiceAccountJson"
}

New-Item -ItemType Directory -Path (Split-Path -Parent $androidFirebaseTarget) -Force | Out-Null
New-Item -ItemType Directory -Path (Split-Path -Parent $localServiceAccountTarget) -Force | Out-Null

Copy-Item -LiteralPath $GoogleServicesJson -Destination $androidFirebaseTarget -Force
Copy-Item -LiteralPath $ServiceAccountJson -Destination $localServiceAccountTarget -Force

Write-Host "==> Firebase Android config local projeye kopyalandi" -ForegroundColor Cyan
Write-Host $androidFirebaseTarget

Write-Host "==> Firebase service account Pi'ye yukleniyor" -ForegroundColor Cyan
scp "$localServiceAccountTarget" "${PiUser}@${PiHost}:/tmp/firebase-service-account.json"

$remoteScript = @"
set -Eeuo pipefail
sudo mkdir -p /opt/noderasoftware/secrets
sudo mv /tmp/firebase-service-account.json /opt/noderasoftware/secrets/firebase-service-account.json
sudo chown hotelops:hotelops /opt/noderasoftware/secrets/firebase-service-account.json
sudo chmod 600 /opt/noderasoftware/secrets/firebase-service-account.json

sudo touch /opt/noderasoftware/.env
sudo cp /opt/noderasoftware/.env /tmp/hotelops-env-firebase
sudo sed -i '/^FIREBASE_SERVICE_ACCOUNT_PATH=/d' /tmp/hotelops-env-firebase
printf '%s\n' 'FIREBASE_SERVICE_ACCOUNT_PATH="/opt/noderasoftware/secrets/firebase-service-account.json"' | sudo tee -a /tmp/hotelops-env-firebase >/dev/null
sudo mv /tmp/hotelops-env-firebase /opt/noderasoftware/.env
sudo chown hotelops:hotelops /opt/noderasoftware/.env
sudo chmod 600 /opt/noderasoftware/.env

sudo systemctl restart hotelops-api
for i in 1 2 3 4 5 6 7 8 9 10; do
  if curl -fsS http://127.0.0.1:4000/health; then
    break
  fi
  sleep 1
done
"@

$remoteScript | ssh "${PiUser}@${PiHost}" "bash -s"

Write-Host ""
Write-Host "Firebase push dosyalari yerlestirildi." -ForegroundColor Green
Write-Host "Sonraki adim: Android APK'yi tekrar build edip Pi'ye yuklemek."
