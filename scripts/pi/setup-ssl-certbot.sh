#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="${APP_DIR:-/opt/noderasoftware}"
DOMAIN="${1:-${DOMAIN:-noderasoftware.com}}"
EMAIL="${2:-${EMAIL:-}}"
WWW_DOMAIN="${WWW_DOMAIN:-www.${DOMAIN}}"
NGINX_SITE="/etc/nginx/sites-available/noderasoftware"
ENV_FILE="${APP_DIR}/.env"

if [ "${EUID}" -ne 0 ]; then
  echo "Bu script sudo/root ile calistirilmalidir."
  echo "Ornek: sudo bash scripts/pi/setup-ssl-certbot.sh noderasoftware.com mail@example.com"
  exit 1
fi

if [ ! -f "${NGINX_SITE}" ]; then
  echo "Nginx site dosyasi bulunamadi: ${NGINX_SITE}"
  echo "Once setup-raspberry-pi.sh calistirin."
  exit 1
fi

apt-get update
apt-get install -y certbot python3-certbot-nginx

sed -i -E "s/^[[:space:]]*server_name .*/    server_name ${DOMAIN} ${WWW_DOMAIN};/" "${NGINX_SITE}"
nginx -t
systemctl reload nginx

if [ -n "${EMAIL}" ]; then
  certbot --nginx --non-interactive --agree-tos --redirect -m "${EMAIL}" -d "${DOMAIN}" -d "${WWW_DOMAIN}"
else
  certbot --nginx -d "${DOMAIN}" -d "${WWW_DOMAIN}"
fi

if [ -f "${ENV_FILE}" ]; then
  if grep -q '^WEB_ORIGIN=' "${ENV_FILE}"; then
    sed -i -E "s|^WEB_ORIGIN=.*|WEB_ORIGIN=\"https://${DOMAIN}\"|" "${ENV_FILE}"
  else
    echo "WEB_ORIGIN=\"https://${DOMAIN}\"" >> "${ENV_FILE}"
  fi
  systemctl restart hotelops-api || true
fi

systemctl reload nginx

echo
echo "SSL kurulumu tamamlandi:"
echo "https://${DOMAIN}/"
echo "https://${DOMAIN}/hotel/"
