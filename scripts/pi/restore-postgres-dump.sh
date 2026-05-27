#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="${APP_DIR:-/opt/noderasoftware}"
DB_NAME="${DB_NAME:-hotelops}"
DB_USER="${DB_USER:-hotelops}"
DB_PASSWORD="${DB_PASSWORD:-hotelops}"
DUMP_PATH="${1:-}"

if [ "${EUID}" -ne 0 ]; then
  echo "Bu script sudo/root ile calistirilmalidir."
  echo "Ornek: sudo bash scripts/pi/restore-postgres-dump.sh /tmp/hotelops.dump"
  exit 1
fi

if [ -z "${DUMP_PATH}" ] || [ ! -f "${DUMP_PATH}" ]; then
  echo "Gecerli bir dump dosyasi verin."
  echo "Ornek: sudo bash scripts/pi/restore-postgres-dump.sh /tmp/hotelops-20260518.dump"
  exit 1
fi

systemctl stop hotelops-api || true

PGPASSWORD="${DB_PASSWORD}" pg_restore \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges \
  --host localhost \
  --username "${DB_USER}" \
  --dbname "${DB_NAME}" \
  "${DUMP_PATH}"

cd "${APP_DIR}"
runuser -u hotelops -- npx prisma generate --schema prisma/schema.prisma

systemctl start hotelops-api
systemctl --no-pager --full status hotelops-api | sed -n '1,12p'
