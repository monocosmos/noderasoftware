#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="${APP_DIR:-/opt/noderasoftware}"
APP_USER="${APP_USER:-hotelops}"
WEBEDIT_USER="${WEBEDIT_USER:-webedit}"
WEBEDIT_PASSWORD="${WEBEDIT_PASSWORD:-}"
LIVE_ROOT="${LIVE_ROOT:-${APP_DIR}/apps/web/out}"

if [ "${EUID}" -ne 0 ]; then
  echo "Bu script sudo/root ile calistirilmalidir."
  echo "Ornek: sudo bash scripts/pi/setup-sftp-editor.sh"
  exit 1
fi

if [ ! -d "${LIVE_ROOT}" ]; then
  echo "Canli web klasoru bulunamadi: ${LIVE_ROOT}"
  echo "Once setup-raspberry-pi.sh calistirilmis olmali."
  exit 1
fi

apt-get update
apt-get install -y openssh-server acl openssl
systemctl enable --now ssh

if ! id "${WEBEDIT_USER}" >/dev/null 2>&1; then
  useradd --create-home --shell /bin/bash "${WEBEDIT_USER}"
fi

if [ -z "${WEBEDIT_PASSWORD}" ]; then
  WEBEDIT_PASSWORD="$(openssl rand -base64 18)"
fi

echo "${WEBEDIT_USER}:${WEBEDIT_PASSWORD}" | chpasswd

usermod -aG www-data "${WEBEDIT_USER}" || true
usermod -aG "${APP_USER}" "${WEBEDIT_USER}" || true

chown -R "${APP_USER}:www-data" "${LIVE_ROOT}"
find "${LIVE_ROOT}" -type d -exec chmod 2775 {} \;
find "${LIVE_ROOT}" -type f -exec chmod 664 {} \;

setfacl -R -m "u:${WEBEDIT_USER}:rwX" "${LIVE_ROOT}"
setfacl -R -d -m "u:${WEBEDIT_USER}:rwX" "${LIVE_ROOT}"
setfacl -R -m "g:www-data:rwX" "${LIVE_ROOT}"
setfacl -R -d -m "g:www-data:rwX" "${LIVE_ROOT}"

cat > "/home/${WEBEDIT_USER}/README-SFTP.txt" <<EOF
Nodera Software SFTP edit user

Live static web root:
${LIVE_ROOT}

FileZilla / WinSCP settings:
Protocol: SFTP
Host: Raspberry Pi IP or domain
Port: 22
User: ${WEBEDIT_USER}
Password: ${WEBEDIT_PASSWORD}

Note:
Files edited directly under ${LIVE_ROOT} are live static output files.
They can be overwritten after a new app build/deploy.
EOF

chown "${WEBEDIT_USER}:${WEBEDIT_USER}" "/home/${WEBEDIT_USER}/README-SFTP.txt"

echo
echo "SFTP editor kullanicisi hazir."
echo "Protocol: SFTP"
echo "Port: 22"
echo "User: ${WEBEDIT_USER}"
echo "Password: ${WEBEDIT_PASSWORD}"
echo "Live root: ${LIVE_ROOT}"
