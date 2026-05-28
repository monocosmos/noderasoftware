#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="${APP_DIR:-/opt/noderasoftware}"
APP_USER="${APP_USER:-hotelops}"
APP_GROUP="${APP_GROUP:-hotelops}"
DB_NAME="${DB_NAME:-hotelops}"
DB_USER="${DB_USER:-hotelops}"
DB_PASSWORD="${DB_PASSWORD:-hotelops}"
PORT="${PORT:-4000}"
HOST="${HOST:-127.0.0.1}"
DOMAIN="${DOMAIN:-noderasoftware.com}"
WWW_DOMAIN="${WWW_DOMAIN:-www.${DOMAIN}}"

if [ "${EUID}" -ne 0 ]; then
  echo "Bu script sudo/root ile calistirilmalidir."
  echo "Ornek: sudo bash scripts/pi/setup-raspberry-pi.sh"
  exit 1
fi

if [ ! -f "${APP_DIR}/package.json" ]; then
  echo "${APP_DIR}/package.json bulunamadi."
  echo "Once proje dosyalarini ${APP_DIR} klasorune kopyalayin."
  exit 1
fi

echo "==> Sistem paketleri kuruluyor"
apt-get update
apt-get install -y ca-certificates curl gnupg git nginx openssl postgresql postgresql-contrib rsync unzip

NODE_MAJOR=0
if command -v node >/dev/null 2>&1; then
  NODE_MAJOR="$(node -p 'Number(process.versions.node.split(".")[0])')"
fi

if [ "${NODE_MAJOR}" -lt 20 ]; then
  echo "==> Node.js 22 kuruluyor"
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi

echo "==> Servis kullanicisi hazirlaniyor"
if ! getent group "${APP_GROUP}" >/dev/null; then
  groupadd --system "${APP_GROUP}"
fi

if ! id "${APP_USER}" >/dev/null 2>&1; then
  useradd --system --gid "${APP_GROUP}" --home-dir "${APP_DIR}" --shell /usr/sbin/nologin "${APP_USER}"
fi

mkdir -p "${APP_DIR}"
chown -R "${APP_USER}:${APP_GROUP}" "${APP_DIR}"

echo "==> PostgreSQL hazirlaniyor"
systemctl enable --now postgresql

if ! runuser -u postgres -- psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'" | grep -q 1; then
  runuser -u postgres -- psql -c "CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASSWORD}';"
else
  runuser -u postgres -- psql -c "ALTER USER ${DB_USER} WITH PASSWORD '${DB_PASSWORD}';"
fi

if ! runuser -u postgres -- psql -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1; then
  runuser -u postgres -- createdb -O "${DB_USER}" "${DB_NAME}"
fi

echo "==> Ortam dosyasi hazirlaniyor"
if [ ! -f "${APP_DIR}/.env" ]; then
  JWT_SECRET="$(openssl rand -hex 32)"
  WEB_ORIGIN="${WEB_ORIGIN:-http://$(hostname -I | awk '{print $1}')}"
  cat > "${APP_DIR}/.env" <<EOF
DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@localhost:5432/${DB_NAME}"
JWT_SECRET="${JWT_SECRET}"
WEB_ORIGIN="${WEB_ORIGIN}"
PORT=${PORT}
HOST=${HOST}
EOF
  chown "${APP_USER}:${APP_GROUP}" "${APP_DIR}/.env"
  chmod 600 "${APP_DIR}/.env"
fi

echo "==> Node bagimliliklari ve build islemleri"
cd "${APP_DIR}"
find "${APP_DIR}" -path "${APP_DIR}/node_modules" -prune -o -type d -exec chmod 755 {} \;
find "${APP_DIR}" -path "${APP_DIR}/node_modules" -prune -o -type f -exec chmod 644 {} \;
chmod +x "${APP_DIR}"/scripts/pi/*.sh 2>/dev/null || true
chmod +x "${APP_DIR}"/apps/desktop/scripts/*.sh 2>/dev/null || true
runuser -u "${APP_USER}" -- npm ci --include-workspace-root --workspace @hotel-ops/api --workspace @hotel-ops/web
find "${APP_DIR}/node_modules/.bin" -type f -exec chmod 755 {} \; 2>/dev/null || true
find "${APP_DIR}/node_modules/@prisma/engines" -type f -exec chmod 755 {} \; 2>/dev/null || true
find "${APP_DIR}/node_modules/prisma" -type f -name "*engine*" -exec chmod 755 {} \; 2>/dev/null || true
runuser -u "${APP_USER}" -- npx prisma generate --schema prisma/schema.prisma
runuser -u "${APP_USER}" -- npx prisma db push --schema prisma/schema.prisma
runuser -u "${APP_USER}" -- npm run seed --workspace @hotel-ops/api
runuser -u "${APP_USER}" -- npm run build --workspace @hotel-ops/api
runuser -u "${APP_USER}" -- npm run build --workspace @hotel-ops/web

echo "==> systemd servisi kuruluyor"
cp "${APP_DIR}/scripts/pi/hotelops-api.service" /etc/systemd/system/hotelops-api.service
systemctl daemon-reload
systemctl enable --now hotelops-api

echo "==> Nginx yapilandirmasi kuruluyor"
cp "${APP_DIR}/scripts/pi/noderasoftware-nginx.conf" /etc/nginx/sites-available/noderasoftware
if [ -f "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" ] && [ -f "/etc/letsencrypt/live/${DOMAIN}/privkey.pem" ]; then
  cat > /etc/nginx/sites-available/noderasoftware <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN} ${WWW_DOMAIN};
    return 301 https://${DOMAIN}\$request_uri;
}

server {
    listen 443 ssl;
    listen [::]:443 ssl;
    http2 on;

    server_name ${DOMAIN} ${WWW_DOMAIN};
    root ${APP_DIR}/apps/web/out;
    index index.html;

    ssl_certificate /etc/letsencrypt/live/${DOMAIN}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${DOMAIN}/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    client_max_body_size 20m;

    add_header Cache-Control "no-cache, no-store, must-revalidate";
    add_header Pragma "no-cache";
    add_header Expires "0";

    location /api/ {
        proxy_pass http://127.0.0.1:${PORT}/;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location /socket.io/ {
        proxy_pass http://127.0.0.1:${PORT}/socket.io/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location ~ ^/hotel/modules/(inventory|rooms|lost-found|guest-requests|requests|operation-documents|training|minibar|equipment|announcements|vip)(/|$) {
        try_files \$uri \$uri/ /hotel/index.html;
    }

    location ~ ^/hotel/modules/ {
        return 301 /hotel/dashboard/;
    }

    location /hotel/ {
        try_files \$uri \$uri/ /hotel/index.html;
    }

    location / {
        try_files \$uri \$uri/ /index.html;
    }
}
EOF
fi
ln -sfn /etc/nginx/sites-available/noderasoftware /etc/nginx/sites-enabled/noderasoftware
if [ -f "${APP_DIR}/scripts/pi/ip-redirect-nginx.conf" ]; then
  cp "${APP_DIR}/scripts/pi/ip-redirect-nginx.conf" /etc/nginx/sites-available/ip-redirect
  ln -sfn /etc/nginx/sites-available/ip-redirect /etc/nginx/sites-enabled/00-ip-redirect
fi
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl enable --now nginx
systemctl reload nginx

echo "==> Kontrol"
curl -fsS "http://127.0.0.1:${PORT}/health"
echo
systemctl --no-pager --full status hotelops-api | sed -n '1,12p'
echo
echo "Kurulum tamamlandi. Siteyi Raspberry Pi IP adresiyle acabilirsiniz."
