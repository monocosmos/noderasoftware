#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="${APP_DIR:-/opt/noderasoftware}"
APP_USER="${APP_USER:-hotelops}"
APP_GROUP="${APP_GROUP:-hotelops}"
BRANCH="${BRANCH:-master}"
REPO_URL="${REPO_URL:-}"
PORT="${PORT:-4000}"
ALLOW_APP_DIR_RECREATE="${ALLOW_APP_DIR_RECREATE:-0}"

die() {
  echo "HATA: $*" >&2
  exit 1
}

on_error() {
  local exit_code=$?
  echo "HATA: Deploy ${exit_code} kodu ile durdu. Satir: ${BASH_LINENO[0]}." >&2
}
trap on_error ERR

require_command() {
  local command_name="$1"
  local message="$2"
  if ! command -v "${command_name}" >/dev/null 2>&1; then
    die "${message}"
  fi
}

install_deb_command() {
  local command_name="$1"
  local package_name="$2"
  if ! command -v "${command_name}" >/dev/null 2>&1; then
    apt-get update
    apt-get install -y "${package_name}"
  fi
}

case "${APP_DIR}" in
  /*) ;;
  *) die "APP_DIR mutlak Linux yolu olmali: ${APP_DIR}" ;;
esac

case "${APP_DIR}" in
  "/"|"/opt"|"/home"|"/usr"|"/var"|"/etc"|"/tmp")
    die "APP_DIR guvenlik icin cok genis bir sistem dizini olamaz: ${APP_DIR}"
    ;;
esac

if [[ ! "${APP_USER}" =~ ^[a-z_][a-z0-9_-]*[$]?$ ]]; then
  die "Gecersiz APP_USER: ${APP_USER}"
fi

if [[ ! "${APP_GROUP}" =~ ^[a-z_][a-z0-9_-]*[$]?$ ]]; then
  die "Gecersiz APP_GROUP: ${APP_GROUP}"
fi

if [[ ! "${PORT}" =~ ^[0-9]+$ ]] || [ "${PORT}" -lt 1 ] || [ "${PORT}" -gt 65535 ]; then
  die "Gecersiz PORT: ${PORT}"
fi

if [ "${EUID}" -ne 0 ]; then
  echo "Bu script sudo/root ile calistirilmalidir."
  echo "Ornek: sudo BRANCH=master bash scripts/pi/deploy-from-github.sh"
  exit 1
fi

install_deb_command git git
install_deb_command git-lfs git-lfs
install_deb_command curl curl

if ! git check-ref-format --branch "${BRANCH}" >/dev/null 2>&1; then
  die "Gecersiz Git branch adi: ${BRANCH}"
fi

git config --system --get-all safe.directory 2>/dev/null | grep -Fxq "${APP_DIR}" \
  || git config --system --add safe.directory "${APP_DIR}" 2>/dev/null || true

if [ ! -d "${APP_DIR}/.git" ]; then
  if [ -z "${REPO_URL}" ]; then
    echo "${APP_DIR} icinde Git deposu yok ve REPO_URL verilmedi."
    echo "Ilk kurulum ornegi:"
    echo "sudo REPO_URL=https://github.com/OWNER/REPO.git BRANCH=master bash scripts/pi/deploy-from-github.sh"
    exit 1
  fi

  echo "==> Depo GitHub'dan klonlaniyor"
  if [ -e "${APP_DIR}" ]; then
    if [ "${ALLOW_APP_DIR_RECREATE}" != "1" ] && [ -n "$(find "${APP_DIR}" -mindepth 1 -maxdepth 1 -print -quit 2>/dev/null)" ]; then
      die "${APP_DIR} var ama Git deposu degil. Silip yeniden klonlamak icin ALLOW_APP_DIR_RECREATE=1 verin."
    fi
    rm -rf -- "${APP_DIR}"
  fi
  mkdir -p "$(dirname "${APP_DIR}")"
  git clone --branch "${BRANCH}" --single-branch "${REPO_URL}" "${APP_DIR}"
fi

cd "${APP_DIR}"

if [ -d "${APP_DIR}/.git/lfs/tmp" ]; then
  rm -f "${APP_DIR}"/.git/lfs/tmp/* 2>/dev/null || true
fi

echo "==> GitHub guncel kaynak aliniyor"
git fetch --prune origin "+refs/heads/${BRANCH}:refs/remotes/origin/${BRANCH}"

GIT_LFS_SKIP_SMUDGE=1 git checkout -f -B "${BRANCH}" "origin/${BRANCH}"
GIT_LFS_SKIP_SMUDGE=1 git reset --hard "origin/${BRANCH}"
git lfs install --local
git lfs pull
git clean -fd \
  -e .env \
  -e node_modules/ \
  -e apps/web/out/ \
  -e apps/api/dist/ \
  -e apps/web/public/downloads/

echo "==> Dosya izinleri ayarlaniyor"
if ! getent group "${APP_GROUP}" >/dev/null; then
  groupadd --system "${APP_GROUP}"
fi

if ! id "${APP_USER}" >/dev/null 2>&1; then
  useradd --system --gid "${APP_GROUP}" --home-dir "${APP_DIR}" --shell /usr/sbin/nologin "${APP_USER}"
fi

chown -R "${APP_USER}:${APP_GROUP}" "${APP_DIR}"
chmod +x "${APP_DIR}"/scripts/pi/*.sh 2>/dev/null || true

if [ ! -f "${APP_DIR}/.env" ]; then
  echo "${APP_DIR}/.env bulunamadi. Once canli ortam degiskenlerini olusturun."
  echo "Ornek: sudo cp .env.example .env && sudo nano .env"
  exit 1
fi

require_command npm "npm bulunamadi. Once Node.js kurulumunu tamamlayin."
require_command npx "npx bulunamadi. Once Node.js kurulumunu tamamlayin."
require_command systemctl "systemctl bulunamadi. Bu deploy systemd gerektirir."
require_command nginx "nginx bulunamadi. Once Raspberry Pi kurulum scriptini calistirin."

echo "==> Bagimliliklar kuruluyor"
runuser -u "${APP_USER}" -- npm ci --include-workspace-root --workspace @hotel-ops/api --workspace @hotel-ops/web

echo "==> Prisma ve build islemleri"
runuser -u "${APP_USER}" -- npx prisma generate --schema prisma/schema.prisma
runuser -u "${APP_USER}" -- npx prisma db push --schema prisma/schema.prisma
runuser -u "${APP_USER}" -- npm run build --workspace @hotel-ops/api
runuser -u "${APP_USER}" -- npm run build --workspace @hotel-ops/web

echo "==> Servisler yenileniyor"
cp "${APP_DIR}/scripts/pi/hotelops-api.service" /etc/systemd/system/hotelops-api.service
systemctl daemon-reload
systemctl restart hotelops-api

if [ -f "/etc/letsencrypt/live/noderasoftware.com/fullchain.pem" ] && [ -f "${APP_DIR}/scripts/pi/noderasoftware-nginx-ssl.conf" ]; then
  cp "${APP_DIR}/scripts/pi/noderasoftware-nginx-ssl.conf" /etc/nginx/sites-available/noderasoftware
elif [ -f "${APP_DIR}/scripts/pi/noderasoftware-nginx.conf" ]; then
  cp "${APP_DIR}/scripts/pi/noderasoftware-nginx.conf" /etc/nginx/sites-available/noderasoftware
fi
ln -sfn /etc/nginx/sites-available/noderasoftware /etc/nginx/sites-enabled/noderasoftware

nginx -t
systemctl reload nginx

echo "==> Canli saglik kontrolu"
systemctl is-active --quiet hotelops-api
systemctl is-active --quiet nginx
for attempt in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:${PORT}/health"; then
    break
  fi
  if [ "${attempt}" -eq 30 ]; then
    echo "API health kontrolu basarisiz oldu."
    journalctl -u hotelops-api -n 80 --no-pager || true
    exit 1
  fi
  sleep 1
done
echo

echo "==> Android update event bildirimi"
runuser -u "${APP_USER}" -- node "${APP_DIR}/scripts/pi/send-android-app-update-push.mjs"

echo "Deploy tamamlandi: ${BRANCH} -> ${APP_DIR}"
