#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="${APP_DIR:-/opt/noderasoftware}"
APP_USER="${APP_USER:-hotelops}"
APP_GROUP="${APP_GROUP:-hotelops}"
BRANCH="${BRANCH:-master}"
REPO_URL="${REPO_URL:-}"
PORT="${PORT:-4000}"
SECTION="${SECTION:-all}"
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
install_deb_command rsync rsync

if ! git check-ref-format --branch "${BRANCH}" >/dev/null 2>&1; then
  die "Gecersiz Git branch adi: ${BRANCH}"
fi

case "${SECTION}" in
  all|home|hotel|videowallplayer) ;;
  *) die "Gecersiz SECTION: ${SECTION}. Beklenen: all, home, hotel, videowallplayer" ;;
esac

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

ensure_app_account() {
  if ! getent group "${APP_GROUP}" >/dev/null; then
    groupadd --system "${APP_GROUP}"
  fi

  if ! id "${APP_USER}" >/dev/null 2>&1; then
    useradd --system --gid "${APP_GROUP}" --home-dir "${APP_DIR}" --shell /usr/sbin/nologin "${APP_USER}"
  fi
}

sync_file_if_exists() {
  local source_path="$1"
  local target_path="$2"
  if [ -f "${source_path}" ]; then
    mkdir -p "$(dirname "${target_path}")"
    cp -a "${source_path}" "${target_path}"
  fi
}

sync_required_file() {
  local source_path="$1"
  local target_path="$2"
  if [ ! -s "${source_path}" ]; then
    die "Gerekli dosya eksik veya bos: ${source_path}"
  fi
  mkdir -p "$(dirname "${target_path}")"
  cp -a "${source_path}" "${target_path}"
}

sync_dir_replace() {
  local source_path="$1"
  local target_path="$2"
  if [ -d "${source_path}" ]; then
    mkdir -p "${target_path}"
    rsync -a --delete "${source_path}/" "${target_path}/"
  else
    rm -rf "${target_path}"
  fi
}

sync_next_static() {
  local build_dir="$1"
  if [ -d "${build_dir}/apps/web/out/_next/static" ]; then
    mkdir -p "${APP_DIR}/apps/web/out/_next/static"
    rsync -a "${build_dir}/apps/web/out/_next/static/" "${APP_DIR}/apps/web/out/_next/static/"
  fi
}

sync_web_build_manifest() {
  local build_dir="$1"
  sync_file_if_exists "${build_dir}/apps/web/out/web-build.json" "${APP_DIR}/apps/web/out/web-build.json"
  sync_file_if_exists "${build_dir}/apps/web/public/web-build.json" "${APP_DIR}/apps/web/public/web-build.json"
}

update_web_build_manifest() {
  local build_dir="$1"
  local build_id_path="${build_dir}/apps/web/.next/BUILD_ID"
  if [ ! -s "${build_id_path}" ]; then
    return 0
  fi

  local build_id
  local generated_at
  build_id="$(cat "${build_id_path}")"
  generated_at="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

  cat > "${build_dir}/apps/web/out/web-build.json" <<JSON
{
  "schema": 1,
  "buildId": "${build_id}",
  "generatedAt": "${generated_at}",
  "source": "next-build"
}
JSON
  cp "${build_dir}/apps/web/out/web-build.json" "${build_dir}/apps/web/public/web-build.json"
}

sync_home_section() {
  local build_dir="$1"
  sync_required_file "${build_dir}/apps/web/out/index.html" "${APP_DIR}/apps/web/out/index.html"
  sync_file_if_exists "${build_dir}/apps/web/out/index.txt" "${APP_DIR}/apps/web/out/index.txt"
  sync_file_if_exists "${build_dir}/apps/web/out/brand/nodera-logo.png" "${APP_DIR}/apps/web/out/brand/nodera-logo.png"
  sync_dir_replace "${build_dir}/apps/web/out/animations/hotelops-ad" "${APP_DIR}/apps/web/out/animations/hotelops-ad"
  sync_required_file "${build_dir}/apps/web/src/app/page.tsx" "${APP_DIR}/apps/web/src/app/page.tsx"
  sync_dir_replace "${build_dir}/apps/web/src/sections/home" "${APP_DIR}/apps/web/src/sections/home"
  sync_file_if_exists "${build_dir}/apps/web/public/brand/nodera-logo.png" "${APP_DIR}/apps/web/public/brand/nodera-logo.png"
  sync_dir_replace "${build_dir}/apps/web/public/animations/hotelops-ad" "${APP_DIR}/apps/web/public/animations/hotelops-ad"
  sync_next_static "${build_dir}"
  sync_web_build_manifest "${build_dir}"
  test -s "${APP_DIR}/apps/web/out/index.html"
}

sync_videowallplayer_section() {
  local build_dir="$1"
  local download_file
  sync_dir_replace "${build_dir}/apps/web/out/videowallplayer" "${APP_DIR}/apps/web/out/videowallplayer"
  sync_dir_replace "${build_dir}/apps/web/out/brand/videowallplayer" "${APP_DIR}/apps/web/out/brand/videowallplayer"
  sync_dir_replace "${build_dir}/apps/web/src/app/videowallplayer" "${APP_DIR}/apps/web/src/app/videowallplayer"
  sync_dir_replace "${build_dir}/apps/web/src/sections/videowallplayer" "${APP_DIR}/apps/web/src/sections/videowallplayer"
  sync_dir_replace "${build_dir}/apps/web/public/brand/videowallplayer" "${APP_DIR}/apps/web/public/brand/videowallplayer"
  mkdir -p "${APP_DIR}/apps/web/out/downloads" "${APP_DIR}/apps/web/public/downloads"

  for download_file in \
    VideoWallPlayer-Windows-Setup-x64.exe \
    VideoWallPlayer-Windows-Portable-x64.zip \
    VideoWallPlayer-Android.apk
  do
    sync_required_file "${build_dir}/apps/web/public/downloads/${download_file}" "${APP_DIR}/apps/web/public/downloads/${download_file}"
    sync_required_file "${build_dir}/apps/web/public/downloads/${download_file}" "${APP_DIR}/apps/web/out/downloads/${download_file}"
  done

  sync_next_static "${build_dir}"
  sync_web_build_manifest "${build_dir}"
  test -s "${APP_DIR}/apps/web/out/videowallplayer/index.html"
  test -s "${APP_DIR}/apps/web/out/brand/videowallplayer/brand-logo.png"
  test -s "${APP_DIR}/apps/web/out/brand/videowallplayer/brand-model.png"
}

sync_hotel_downloads() {
  local build_dir="$1"
  local source_file
  shopt -s nullglob
  for source_file in "${build_dir}"/apps/web/public/downloads/HotelOps-*; do
    mkdir -p "${APP_DIR}/apps/web/public/downloads" "${APP_DIR}/apps/web/out/downloads"
    cp -a "${source_file}" "${APP_DIR}/apps/web/public/downloads/$(basename "${source_file}")"
    cp -a "${source_file}" "${APP_DIR}/apps/web/out/downloads/$(basename "${source_file}")"
  done
  shopt -u nullglob
}

sync_hotel_section() {
  local build_dir="$1"
  local route_dir
  local legacy_routes=(
    login
    dashboard
    jobs
    maintenance
    meter-tracking
    housekeeping
    calendar
    reminders
    notifications
    shift-panels
    modules
    department
    hotel-floor-planning
    reports
    users
    hotelpanel
    app-settings
    settings
  )

  sync_dir_replace "${build_dir}/apps/api/src" "${APP_DIR}/apps/api/src"
  sync_dir_replace "${build_dir}/apps/api/dist" "${APP_DIR}/apps/api/dist"
  sync_required_file "${build_dir}/apps/api/package.json" "${APP_DIR}/apps/api/package.json"
  sync_required_file "${build_dir}/apps/api/tsconfig.json" "${APP_DIR}/apps/api/tsconfig.json"
  sync_required_file "${build_dir}/prisma/schema.prisma" "${APP_DIR}/prisma/schema.prisma"

  sync_dir_replace "${build_dir}/apps/web/src/app/hotel" "${APP_DIR}/apps/web/src/app/hotel"
  sync_dir_replace "${build_dir}/apps/web/src/app/[...slug]" "${APP_DIR}/apps/web/src/app/[...slug]"
  sync_dir_replace "${build_dir}/apps/web/src/sections/hotel" "${APP_DIR}/apps/web/src/sections/hotel"
  sync_dir_replace "${build_dir}/apps/web/src/components/hotel-ops" "${APP_DIR}/apps/web/src/components/hotel-ops"
  sync_required_file "${build_dir}/apps/web/src/components/hotel-ops-system.tsx" "${APP_DIR}/apps/web/src/components/hotel-ops-system.tsx"
  sync_file_if_exists "${build_dir}/apps/web/src/components/hotel-ops-app.tsx" "${APP_DIR}/apps/web/src/components/hotel-ops-app.tsx"
  sync_required_file "${build_dir}/apps/web/src/components/legacy-hotel-redirect.tsx" "${APP_DIR}/apps/web/src/components/legacy-hotel-redirect.tsx"
  sync_required_file "${build_dir}/apps/web/src/components/meter-tracking-page.tsx" "${APP_DIR}/apps/web/src/components/meter-tracking-page.tsx"
  sync_required_file "${build_dir}/apps/web/src/lib/hotel-data.ts" "${APP_DIR}/apps/web/src/lib/hotel-data.ts"
  sync_required_file "${build_dir}/apps/web/src/lib/rbac.ts" "${APP_DIR}/apps/web/src/lib/rbac.ts"
  sync_required_file "${build_dir}/apps/web/src/lib/utils.ts" "${APP_DIR}/apps/web/src/lib/utils.ts"

  sync_dir_replace "${build_dir}/apps/web/out/hotel" "${APP_DIR}/apps/web/out/hotel"
  for route_dir in "${legacy_routes[@]}"; do
    sync_dir_replace "${build_dir}/apps/web/out/${route_dir}" "${APP_DIR}/apps/web/out/${route_dir}"
  done

  sync_file_if_exists "${build_dir}/apps/web/out/app-version.json" "${APP_DIR}/apps/web/out/app-version.json"
  sync_file_if_exists "${build_dir}/apps/web/public/app-version.json" "${APP_DIR}/apps/web/public/app-version.json"
  sync_file_if_exists "${build_dir}/apps/web/out/maintenance-status.json" "${APP_DIR}/apps/web/out/maintenance-status.json"
  sync_file_if_exists "${build_dir}/apps/web/public/maintenance-status.json" "${APP_DIR}/apps/web/public/maintenance-status.json"
  sync_hotel_downloads "${build_dir}"
  sync_next_static "${build_dir}"
  sync_web_build_manifest "${build_dir}"

  test -s "${APP_DIR}/apps/web/out/hotel/index.html"
  test -s "${APP_DIR}/apps/web/out/hotel/hotelpanel/index.html"
  test -s "${APP_DIR}/apps/web/out/hotelpanel/index.html"
}

deploy_section_from_github() {
  local stage_root
  local build_dir
  local origin_url
  stage_root="$(mktemp -d "/tmp/noderasoftware-section-${SECTION}-XXXXXX")"
  build_dir="${stage_root}/repo"

  cleanup_section() {
    rm -rf "${stage_root}"
  }
  trap cleanup_section EXIT

  ensure_app_account
  require_command npm "npm bulunamadi. Once Node.js kurulumunu tamamlayin."
  require_command npx "npx bulunamadi. Once Node.js kurulumunu tamamlayin."
  require_command rsync "rsync bulunamadi."

  echo "==> ${SECTION} bolumu icin GitHub kaynaklari hazirlaniyor"
  git -C "${APP_DIR}" fetch --prune origin "+refs/heads/${BRANCH}:refs/remotes/origin/${BRANCH}"
  origin_url="$(git -C "${APP_DIR}" config --get remote.origin.url || true)"
  git clone --shared "${APP_DIR}" "${build_dir}"
  if [ -n "${origin_url}" ]; then
    git -C "${build_dir}" remote set-url origin "${origin_url}"
  fi

  cd "${build_dir}"
  GIT_LFS_SKIP_SMUDGE=1 git checkout -f -B "${BRANCH}" "origin/${BRANCH}"
  GIT_LFS_SKIP_SMUDGE=1 git reset --hard "origin/${BRANCH}"
  git lfs install --local
  git lfs pull
  git clean -fd -e .env -e node_modules/ -e apps/web/public/downloads/

  if [ -f "${APP_DIR}/.env" ]; then
    cp "${APP_DIR}/.env" "${build_dir}/.env"
  elif [ "${SECTION}" = "hotel" ]; then
    die "${APP_DIR}/.env bulunamadi. Hotel bolum deploy'u icin canli ortam degiskenleri gerekli."
  fi

  chown -R "${APP_USER}:${APP_GROUP}" "${stage_root}"

  echo "==> ${SECTION} bolumu build ediliyor"
  if [ "${SECTION}" = "hotel" ]; then
    runuser -u "${APP_USER}" -- npm ci --include-workspace-root --workspace @hotel-ops/api --workspace @hotel-ops/web
    runuser -u "${APP_USER}" -- npx prisma generate --schema prisma/schema.prisma
    runuser -u "${APP_USER}" -- npx prisma db push --schema prisma/schema.prisma
    runuser -u "${APP_USER}" -- npm run build --workspace @hotel-ops/api
  else
    runuser -u "${APP_USER}" -- npm ci --include-workspace-root --workspace @hotel-ops/web
  fi
  runuser -u "${APP_USER}" -- npm run build --workspace @hotel-ops/web
  update_web_build_manifest "${build_dir}"

  echo "==> ${SECTION} bolumu canli klasore uygulaniyor"
  case "${SECTION}" in
    home)
      sync_home_section "${build_dir}"
      ;;
    hotel)
      sync_hotel_section "${build_dir}"
      ;;
    videowallplayer)
      sync_videowallplayer_section "${build_dir}"
      ;;
  esac

  chown -R "${APP_USER}:${APP_GROUP}" "${APP_DIR}/apps/web/out" "${APP_DIR}/apps/web/public" "${APP_DIR}/apps/web/src"
  chmod +x "${APP_DIR}"/scripts/pi/*.sh 2>/dev/null || true
  find "${APP_DIR}/apps/web/out" -type d -exec chmod 755 {} +
  find "${APP_DIR}/apps/web/out" -type f -exec chmod 644 {} +
  find "${APP_DIR}/apps/web/public" -type d -exec chmod 755 {} +
  find "${APP_DIR}/apps/web/public" -type f -exec chmod 644 {} +

  if [ "${SECTION}" = "hotel" ]; then
    chown -R "${APP_USER}:${APP_GROUP}" "${APP_DIR}/apps/api" "${APP_DIR}/prisma"
    cp "${APP_DIR}/scripts/pi/hotelops-api.service" /etc/systemd/system/hotelops-api.service
    systemctl daemon-reload
    systemctl restart hotelops-api
    systemctl is-active --quiet hotelops-api
    for attempt in $(seq 1 30); do
      if curl -fsS "http://127.0.0.1:${PORT}/health"; then
        break
      fi
      if [ "${attempt}" -eq 30 ]; then
        journalctl -u hotelops-api -n 80 --no-pager || true
        die "Hotel API health kontrolu basarisiz oldu."
      fi
      sleep 1
    done
    echo
    runuser -u "${APP_USER}" -- node "${APP_DIR}/scripts/pi/send-android-app-update-push.mjs"
  fi

  require_command nginx "nginx bulunamadi. Once Raspberry Pi kurulum scriptini calistirin."
  nginx -t
  systemctl reload nginx
  systemctl is-active --quiet nginx

  echo "Bolum deploy tamamlandi: ${SECTION} (${BRANCH}) -> ${APP_DIR}"
}

cd "${APP_DIR}"

if [ -d "${APP_DIR}/.git/lfs/tmp" ]; then
  rm -f "${APP_DIR}"/.git/lfs/tmp/* 2>/dev/null || true
fi

if [ "${SECTION}" != "all" ]; then
  deploy_section_from_github
  exit 0
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
