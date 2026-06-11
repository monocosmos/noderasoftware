#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="${APP_DIR:-/opt/noderasoftware}"
APP_USER="${APP_USER:-hotelops}"
APP_GROUP="${APP_GROUP:-hotelops}"
BRANCH="${BRANCH:-master}"
REPO_URL="${REPO_URL:-}"
PORT="${PORT:-4000}"

if [ "${EUID}" -ne 0 ]; then
  echo "Bu script sudo/root ile calistirilmalidir."
  echo "Ornek: sudo BRANCH=master bash scripts/pi/deploy-from-github.sh"
  exit 1
fi

if ! command -v git >/dev/null 2>&1; then
  apt-get update
  apt-get install -y git
fi

if ! command -v git-lfs >/dev/null 2>&1; then
  apt-get update
  apt-get install -y git-lfs
fi

git config --system --add safe.directory "${APP_DIR}" 2>/dev/null || true

if [ ! -d "${APP_DIR}/.git" ]; then
  if [ -z "${REPO_URL}" ]; then
    echo "${APP_DIR} icinde Git deposu yok ve REPO_URL verilmedi."
    echo "Ilk kurulum ornegi:"
    echo "sudo REPO_URL=https://github.com/OWNER/REPO.git BRANCH=master bash scripts/pi/deploy-from-github.sh"
    exit 1
  fi

  echo "==> Depo GitHub'dan klonlaniyor"
  rm -rf "${APP_DIR}"
  mkdir -p "${APP_DIR}"
  git clone --branch "${BRANCH}" --single-branch "${REPO_URL}" "${APP_DIR}"
fi

cd "${APP_DIR}"

echo "==> GitHub guncel kaynak aliniyor"
git fetch origin "${BRANCH}"

CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [ "${CURRENT_BRANCH}" != "${BRANCH}" ]; then
  git switch "${BRANCH}"
fi

git reset --hard "origin/${BRANCH}"
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

if [ -f "${APP_DIR}/scripts/pi/noderasoftware-nginx.conf" ]; then
  cp "${APP_DIR}/scripts/pi/noderasoftware-nginx.conf" /etc/nginx/sites-available/noderasoftware
  ln -sfn /etc/nginx/sites-available/noderasoftware /etc/nginx/sites-enabled/noderasoftware
fi

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
echo "Deploy tamamlandi: ${BRANCH} -> ${APP_DIR}"
