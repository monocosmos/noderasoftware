#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="${APP_DIR:-/opt/noderasoftware}"
BACKUP_ROOT="${BACKUP_ROOT:-/var/backups/noderasoftware/daily}"
BACKUP_TZ="${BACKUP_TZ:-Europe/Istanbul}"
LOCAL_RETENTION_DAYS="${LOCAL_RETENTION_DAYS:-7}"
REMOTE_RETENTION_DAYS="${REMOTE_RETENTION_DAYS:-30}"
RCLONE_REMOTE="${RCLONE_REMOTE:-noderadrive:HotelOpsBackups}"
BACKUP_HOTEL_NAME="${BACKUP_HOTEL_NAME:-}"
UPLOAD_ENABLED="${UPLOAD_ENABLED:-1}"
LOCK_FILE="${LOCK_FILE:-/run/noderasoftware-daily-backup.lock}"
ARCHIVE_PREFIX="${ARCHIVE_PREFIX:-hotelops-backup}"
LAYOUT_VERSION="${LAYOUT_VERSION:-v2}"

export TZ="${BACKUP_TZ}"
umask 077

target_date="${1:-$(date -d "yesterday" +%F)}"
start_at="${target_date} 00:00:00"
end_date="$(date -d "${target_date} +1 day" +%F)"
end_at="${end_date} 00:00:00"
backup_file_date="$(date -d "${target_date}" +%Y-%m-%d)"
backup_year="$(date -d "${target_date}" +%Y)"

month_folder_name() {
  case "$(date -d "$1" +%m)" in
    01) printf "01-Ocak" ;;
    02) printf "02-Subat" ;;
    03) printf "03-Mart" ;;
    04) printf "04-Nisan" ;;
    05) printf "05-Mayis" ;;
    06) printf "06-Haziran" ;;
    07) printf "07-Temmuz" ;;
    08) printf "08-Agustos" ;;
    09) printf "09-Eylul" ;;
    10) printf "10-Ekim" ;;
    11) printf "11-Kasim" ;;
    12) printf "12-Aralik" ;;
  esac
}

sanitize_drive_path_component() {
  printf "%s" "$1" \
    | tr '\r\n\t' '   ' \
    | sed -E 's#[/\\]+#-#g; s/^[[:space:]]+//; s/[[:space:]]+$//; s/[[:space:]]{2,}/ /g'
}

mkdir -p "${BACKUP_ROOT}"
exec 9>"${LOCK_FILE}"
if ! flock -n 9; then
  echo "Another backup run is already active." >&2
  exit 75
fi

if [ ! -f "${APP_DIR}/.env" ]; then
  echo "Missing ${APP_DIR}/.env" >&2
  exit 66
fi

set -a
# shellcheck disable=SC1091
. "${APP_DIR}/.env"
set +a

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is not set in ${APP_DIR}/.env" >&2
  exit 65
fi

hotel_name="${BACKUP_HOTEL_NAME}"
if [ -z "${hotel_name}" ] && command -v psql >/dev/null 2>&1; then
  hotel_name="$(psql "${DATABASE_URL}" -Atq -c 'select name from "Hotel" where code <> '"'"'NODERA_PLATFORM'"'"' order by "createdAt" asc limit 1;' 2>/dev/null || true)"
fi
if [ -z "${hotel_name}" ]; then
  hotel_name="$(hostname)"
fi

hotel_folder="$(sanitize_drive_path_component "${hotel_name}")"
month_folder="$(month_folder_name "${target_date}")"
day_folder="${backup_file_date}"
backup_relative_dir="${hotel_folder}/${backup_year}/${month_folder}/${day_folder}"
backup_name_base="${ARCHIVE_PREFIX}-${hotel_folder}-${backup_file_date}"
remote_target="${RCLONE_REMOTE}/${backup_relative_dir}"
local_target_dir="${BACKUP_ROOT}/${backup_relative_dir}"
archive_name="${backup_name_base}.zip"
archive_path="${local_target_dir}/${archive_name}"
checksum_path="${archive_path}.sha256"
manifest_env_path="${local_target_dir}/manifest.env"
manifest_json_path="${local_target_dir}/manifest.json"
checklist_txt_path="${local_target_dir}/checklist.txt"
checklist_json_path="${local_target_dir}/checklist.json"
summary_txt_path="${local_target_dir}/summary.txt"

if ! command -v pg_dump >/dev/null 2>&1; then
  echo "pg_dump is required." >&2
  exit 69
fi

work_dir="$(mktemp -d)"
cleanup() {
  rm -rf "${work_dir}"
}
trap cleanup EXIT

mkdir -p "${work_dir}/db" "${work_dir}/logs" "${work_dir}/metadata" "${work_dir}/manifests" "${work_dir}/reports"
mkdir -p "${local_target_dir}"

pg_dump --format=custom --no-owner --no-acl --file "${work_dir}/db/hotelops-${target_date}.dump" "${DATABASE_URL}"

report_csv="${work_dir}/reports/gunluk-olay-raporu.csv"
report_txt="${work_dir}/reports/gunluk-olay-raporu.txt"
report_summary="${work_dir}/reports/gunluk-ozet.txt"
report_sql="${work_dir}/reports/gunluk-olay-raporu.sql"

cat > "${report_sql}" <<SQL
\set ON_ERROR_STOP on
CREATE TEMP TABLE daily_events AS
WITH audit_events AS (
  SELECT
    a."createdAt" AS sort_at,
    h.name AS hotel_name,
    actor."fullName" AS user_name,
    actor."accountId" AS account_id,
    actor.username AS username,
    d.name AS department_name,
    a."entityType" AS category,
    CASE
      WHEN a."entityType" = 'WorkOrder' AND a.action = 'CREATE' THEN 'Is/Ariza olusturuldu'
      WHEN a."entityType" = 'WorkOrder' AND a.action = 'UPDATE' THEN 'Is/Ariza guncellendi'
      WHEN a."entityType" = 'WorkOrder' AND a.action = 'SOFT_DELETE' THEN 'Is/Ariza silindi'
      WHEN a."entityType" = 'User' AND a.action = 'CREATE' THEN 'Personel olusturuldu'
      WHEN a."entityType" = 'User' AND a.action = 'UPDATE' THEN 'Personel guncellendi'
      WHEN a."entityType" = 'User' AND a.action = 'SOFT_DELETE' THEN 'Personel silindi'
      WHEN a."entityType" = 'User' AND a.action = 'RESET_PASSWORD' THEN 'Personel sifresi sifirlandi'
      WHEN a."entityType" = 'User' AND a.action = 'PLATFORM_RESET_PASSWORD' THEN 'Platform sifre sifirladi'
      WHEN a."entityType" = 'User' AND a.action = 'UPDATE_PROFILE' THEN 'Profil guncellendi'
      WHEN a."entityType" = 'User' AND a.action = 'CHANGE_PASSWORD' THEN 'Sifre degistirildi'
      WHEN a."entityType" = 'Hotel' AND a.action = 'CREATE' THEN 'Otel olusturuldu'
      WHEN a."entityType" = 'Hotel' AND a.action = 'DELETE' THEN 'Otel silindi'
      WHEN a."entityType" = 'ShiftPanel' AND a.action = 'CONFIGURE' THEN 'Vardiya panel ayari degisti'
      WHEN a."entityType" = 'ShiftPanelCell' AND a.action = 'UPSERT' THEN 'Vardiya hucresi duzenlendi'
      WHEN a."entityType" = 'ShiftPanelCell' AND a.action = 'DELETE' THEN 'Vardiya hucresi silindi'
      WHEN a."entityType" = 'ShiftPanelEntry' AND a.action = 'UPSERT' THEN 'Vardiya notu guncellendi'
      WHEN a."entityType" = 'ManagementRequest' AND a.action = 'CREATE' THEN 'Yonetim talebi olusturuldu'
      WHEN a."entityType" = 'ManagementRequest' AND a.action = 'STATUS' THEN 'Yonetim talebi durumu degisti'
      WHEN a."entityType" = 'OperationDocument' AND a.action = 'CREATE' THEN 'Operasyon dokumani olusturuldu'
      WHEN a."entityType" = 'OperationDocument' AND a.action = 'READ' THEN 'Operasyon dokumani okundu'
      WHEN a."entityType" = 'Comment' AND a.action = 'CREATE' THEN 'Not/yorum eklendi'
      WHEN a."entityType" = 'Attachment' AND a.action = 'CREATE' THEN 'Dosya/fotograf eklendi'
      ELSE a."entityType" || ' ' || a.action
    END AS action_label,
    CASE
      WHEN a."entityType" = 'WorkOrder' THEN concat_ws(' | ',
        nullif('Kod: ' || coalesce(a.after->>'code', a.before->>'code', a."entityId"), 'Kod: '),
        nullif('Baslik: ' || coalesce(a.after->>'title', a.before->>'title', ''), 'Baslik: '),
        nullif('Durum: ' || coalesce(a.after->>'status', a.before->>'status', ''), 'Durum: '),
        nullif('Oda: ' || coalesce(a.after->>'room', a.before->>'room', ''), 'Oda: ')
      )
      WHEN a."entityType" = 'User' THEN concat_ws(' | ',
        nullif('Personel: ' || coalesce(a.after->>'fullName', a.before->>'fullName', ''), 'Personel: '),
        nullif('Kullanici: ' || coalesce(a.after->>'username', a.before->>'username', ''), 'Kullanici: '),
        nullif('ID: ' || coalesce(a.after->>'accountId', a.before->>'accountId', ''), 'ID: ')
      )
      WHEN a."entityType" = 'Hotel' THEN concat_ws(' | ',
        nullif('Otel: ' || coalesce(a.after->>'name', a.before->>'name', ''), 'Otel: '),
        nullif('Kod: ' || coalesce(a.after->>'code', a.before->>'code', ''), 'Kod: '),
        nullif('Otel ID: ' || coalesce(a.after->>'publicId', a.before->>'publicId', ''), 'Otel ID: ')
      )
      WHEN a."entityType" = 'ShiftPanelCell' THEN concat_ws(' | ',
        nullif('Departman: ' || coalesce(a.after->>'departmentId', ''), 'Departman: '),
        nullif('Personel: ' || coalesce(target_user."fullName", a.after->>'userId', ''), 'Personel: '),
        nullif('Tarih: ' || coalesce(a.after->>'date', ''), 'Tarih: '),
        nullif('Vardiya: ' || coalesce(nullif(spc.code, ''), nullif(spc."startTime" || '-' || spc."endTime", '-'), ''), 'Vardiya: ')
      )
      WHEN a."entityType" = 'ShiftPanel' THEN concat_ws(' | ',
        nullif('Departman: ' || coalesce(a.after->>'departmentId', ''), 'Departman: '),
        nullif('Aktif: ' || coalesce(a.after->>'enabled', ''), 'Aktif: '),
        nullif('Sorumlu IDleri: ' || coalesce(a.after->>'editorUserIds', ''), 'Sorumlu IDleri: ')
      )
      ELSE coalesce(nullif(left(coalesce(a.after::text, a.before::text, a."entityId"), 600), 'null'), '')
    END AS description,
    coalesce(a."ipAddress", '') AS ip_address,
    coalesce(a."userAgent", '') AS user_agent
  FROM "AuditLog" a
  JOIN "User" actor ON actor.id = a."actorId"
  JOIN "Hotel" h ON h.id = actor."hotelId"
  LEFT JOIN "Department" d ON d.id = actor."departmentId"
  LEFT JOIN "User" target_user ON target_user.id = a.after->>'userId'
  LEFT JOIN "ShiftPanelCell" spc ON spc.id = a."entityId"
  WHERE a."createdAt" >= TIMESTAMP '${start_at}'
    AND a."createdAt" < TIMESTAMP '${end_at}'
),
login_events AS (
  SELECT
    l."createdAt" AS sort_at,
    h.name AS hotel_name,
    u."fullName" AS user_name,
    u."accountId" AS account_id,
    u.username AS username,
    d.name AS department_name,
    'LoginHistory' AS category,
    CASE WHEN l.success THEN 'Basarili giris' ELSE 'Basarisiz giris' END AS action_label,
    concat_ws(' | ',
      nullif('Sonuc: ' || CASE WHEN l.success THEN 'Basarili' ELSE 'Basarisiz' END, 'Sonuc: '),
      nullif('Sebep: ' || coalesce(l.reason, ''), 'Sebep: ')
    ) AS description,
    coalesce(l."ipAddress", '') AS ip_address,
    coalesce(l."userAgent", '') AS user_agent
  FROM "LoginHistory" l
  JOIN "User" u ON u.id = l."userId"
  JOIN "Hotel" h ON h.id = u."hotelId"
  LEFT JOIN "Department" d ON d.id = u."departmentId"
  WHERE l."createdAt" >= TIMESTAMP '${start_at}'
    AND l."createdAt" < TIMESTAMP '${end_at}'
),
shift_events AS (
  SELECT
    s."startedAt" AS sort_at,
    h.name AS hotel_name,
    u."fullName" AS user_name,
    u."accountId" AS account_id,
    u.username AS username,
    d.name AS department_name,
    'ShiftSession' AS category,
    'Vardiya basladi' AS action_label,
    concat_ws(' | ',
      nullif('Departman: ' || d.name, 'Departman: '),
      nullif('Baslangic IP: ' || coalesce(s."startIpAddress", ''), 'Baslangic IP: ')
    ) AS description,
    coalesce(s."startIpAddress", '') AS ip_address,
    coalesce(s."userAgent", '') AS user_agent
  FROM "ShiftSession" s
  JOIN "User" u ON u.id = s."userId"
  JOIN "Hotel" h ON h.id = s."hotelId"
  LEFT JOIN "Department" d ON d.id = s."departmentId"
  WHERE s."startedAt" >= TIMESTAMP '${start_at}'
    AND s."startedAt" < TIMESTAMP '${end_at}'
  UNION ALL
  SELECT
    s."endedAt" AS sort_at,
    h.name AS hotel_name,
    u."fullName" AS user_name,
    u."accountId" AS account_id,
    u.username AS username,
    d.name AS department_name,
    'ShiftSession' AS category,
    'Vardiya bitti' AS action_label,
    concat_ws(' | ',
      nullif('Departman: ' || d.name, 'Departman: '),
      nullif('Bitis IP: ' || coalesce(s."endIpAddress", ''), 'Bitis IP: ')
    ) AS description,
    coalesce(s."endIpAddress", '') AS ip_address,
    coalesce(s."userAgent", '') AS user_agent
  FROM "ShiftSession" s
  JOIN "User" u ON u.id = s."userId"
  JOIN "Hotel" h ON h.id = s."hotelId"
  LEFT JOIN "Department" d ON d.id = s."departmentId"
  WHERE s."endedAt" IS NOT NULL
    AND s."endedAt" >= TIMESTAMP '${start_at}'
    AND s."endedAt" < TIMESTAMP '${end_at}'
)
SELECT
  sort_at,
  to_char(sort_at, 'YYYY-MM-DD HH24:MI:SS') AS "TarihSaat",
  hotel_name AS "Otel",
  user_name AS "Kullanici",
  coalesce(account_id, '') AS "KullaniciID",
  username AS "KullaniciAdi",
  coalesce(department_name, '') AS "Departman",
  category AS "Kaynak",
  action_label AS "Islem",
  coalesce(description, '') AS "Aciklama",
  ip_address AS "IP",
  user_agent AS "CihazTarayici"
FROM (
  SELECT * FROM audit_events
  UNION ALL
  SELECT * FROM login_events
  UNION ALL
  SELECT * FROM shift_events
) events;

\copy (SELECT "TarihSaat", "Otel", "Kullanici", "KullaniciID", "KullaniciAdi", "Departman", "Kaynak", "Islem", "Aciklama", "IP", "CihazTarayici" FROM daily_events ORDER BY sort_at, "Islem") TO '${report_csv}.raw' WITH CSV HEADER
\copy (SELECT "TarihSaat", "Kullanici", "Departman", "Islem", "Aciklama" FROM daily_events ORDER BY sort_at, "Islem") TO '${report_txt}.raw' WITH CSV HEADER DELIMITER E'\t'
\copy (SELECT "Islem", count(*) AS "Adet" FROM daily_events GROUP BY "Islem" ORDER BY "Adet" DESC, "Islem") TO '${report_summary}.raw' WITH CSV HEADER DELIMITER E'\t'
SQL

if command -v psql >/dev/null 2>&1; then
  if psql "${DATABASE_URL}" -f "${report_sql}" >/dev/null 2>"${work_dir}/reports/gunluk-olay-raporu-hata.log"; then
    printf '\xEF\xBB\xBF' > "${report_csv}"
    cat "${report_csv}.raw" >> "${report_csv}"
    {
      echo "Gunluk Olay Raporu"
      echo "Tarih: ${target_date}"
      echo "Otel: ${hotel_name}"
      echo
      cat "${report_txt}.raw"
    } > "${report_txt}"
    {
      echo "Gunluk Ozet"
      echo "Tarih: ${target_date}"
      echo "Otel: ${hotel_name}"
      echo
      cat "${report_summary}.raw"
    } > "${report_summary}"
    rm -f "${report_csv}.raw" "${report_txt}.raw" "${report_summary}.raw" "${report_sql}" "${work_dir}/reports/gunluk-olay-raporu-hata.log"
  else
    {
      echo "Gunluk olay raporu olusturulamadi."
      echo "Tarih: ${target_date}"
      echo "Detay:"
      cat "${work_dir}/reports/gunluk-olay-raporu-hata.log"
    } > "${work_dir}/reports/gunluk-olay-raporu-hatasi.txt"
  fi
else
  echo "psql bulunamadigi icin gunluk olay raporu olusturulamadi." > "${work_dir}/reports/gunluk-olay-raporu-hatasi.txt"
fi

journalctl --since "${start_at}" --until "${end_at}" -u hotelops-api -o short-iso --no-pager > "${work_dir}/logs/hotelops-api.journal.log" 2>/dev/null || true
journalctl --since "${start_at}" --until "${end_at}" -u nginx -o short-iso --no-pager > "${work_dir}/logs/nginx.journal.log" 2>/dev/null || true
journalctl --since "${start_at}" --until "${end_at}" -u postgresql -o short-iso --no-pager > "${work_dir}/logs/postgresql.journal.log" 2>/dev/null || true

nginx_access_day="$(LC_ALL=C date -d "${target_date}" +%d/%b/%Y)"
nginx_error_day="$(date -d "${target_date}" +%Y/%m/%d)"
if compgen -G "/var/log/nginx/access.log*" >/dev/null; then
  zgrep -h "\\[${nginx_access_day}:" /var/log/nginx/access.log* > "${work_dir}/logs/nginx-access-${target_date}.log" 2>/dev/null || true
fi
if compgen -G "/var/log/nginx/error.log*" >/dev/null; then
  zgrep -h "^${nginx_error_day}" /var/log/nginx/error.log* > "${work_dir}/logs/nginx-error-${target_date}.log" 2>/dev/null || true
fi

for manifest in app-version.json web-build.json; do
  if [ -f "${APP_DIR}/apps/web/out/${manifest}" ]; then
    cp "${APP_DIR}/apps/web/out/${manifest}" "${work_dir}/manifests/${manifest}"
  fi
done

included_items=(
  "db/hotelops-${target_date}.dump|PostgreSQL custom-format veritabani dump'i"
  "reports/gunluk-olay-raporu.csv|Tum gunluk olaylarin tablo raporu"
  "reports/gunluk-olay-raporu.txt|Hizli okunur gunluk olay listesi"
  "reports/gunluk-ozet.txt|Islem bazli gunluk toplu sayim ozeti"
  "logs/hotelops-api.journal.log|hotelops-api systemd loglari"
  "logs/nginx.journal.log|nginx systemd loglari"
  "logs/postgresql.journal.log|postgresql systemd loglari"
  "logs/nginx-access-${target_date}.log|O gunun nginx access kayitlari"
  "logs/nginx-error-${target_date}.log|O gunun nginx error kayitlari"
  "manifests/app-version.json|Canli web surum bilgisi"
  "manifests/web-build.json|Web build metadata bilgisi"
  "metadata/manifest.env|Anahtar=deger yedek metaverisi"
  "metadata/manifest.json|Makine tarafinda ayrisabilir yedek metaverisi"
  "metadata/checklist.txt|Insan okunur yedek kapsami listesi"
  "metadata/checklist.json|Makine tarafinda ayrisabilir yedek kapsami listesi"
)

{
  echo "backup_date=${target_date}"
  echo "window_start=${start_at} ${BACKUP_TZ}"
  echo "window_end=${end_at} ${BACKUP_TZ}"
  echo "created_at=$(date --iso-8601=seconds)"
  echo "host=$(hostname)"
  echo "hotel_name=${hotel_name}"
  echo "hotel_folder=${hotel_folder}"
  echo "app_dir=${APP_DIR}"
  echo "layout_version=${LAYOUT_VERSION}"
  echo "archive_name=${archive_name}"
  echo "archive_path=${archive_path}"
  echo "remote=${remote_target}"
  echo
  echo "[services]"
  systemctl is-active hotelops-api nginx postgresql || true
  echo
  echo "[disk]"
  df -h / /boot/firmware || true
} > "${work_dir}/metadata/manifest.env"

{
  printf '{\n'
  printf '  "layoutVersion": "%s",\n' "${LAYOUT_VERSION}"
  printf '  "backupDate": "%s",\n' "${target_date}"
  printf '  "windowStart": "%s %s",\n' "${start_at}" "${BACKUP_TZ}"
  printf '  "windowEnd": "%s %s",\n' "${end_at}" "${BACKUP_TZ}"
  printf '  "createdAt": "%s",\n' "$(date --iso-8601=seconds)"
  printf '  "host": "%s",\n' "$(hostname)"
  printf '  "hotelName": "%s",\n' "${hotel_name}"
  printf '  "hotelFolder": "%s",\n' "${hotel_folder}"
  printf '  "archiveName": "%s",\n' "${archive_name}"
  printf '  "archivePath": "%s",\n' "${archive_path}"
  printf '  "remoteTarget": "%s",\n' "${remote_target}"
  printf '  "appDir": "%s",\n' "${APP_DIR}"
  printf '  "includes": [\n'
  for i in "${!included_items[@]}"; do
    item="${included_items[$i]}"
    path_part="${item%%|*}"
    desc_part="${item#*|}"
    suffix=","
    if [ "$i" -eq "$((${#included_items[@]} - 1))" ]; then
      suffix=""
    fi
    printf '    { "path": "%s", "description": "%s" }%s\n' "${path_part}" "${desc_part}" "${suffix}"
  done
  printf '  ]\n'
  printf '}\n'
} > "${work_dir}/metadata/manifest.json"

{
  echo "HotelOps Daily Backup Checklist"
  echo "Tarih: ${target_date}"
  echo "Otel: ${hotel_name}"
  echo "Duzen: ${LAYOUT_VERSION}"
  echo
  echo "[x] Veritabani dump'i"
  echo "[x] Gunluk olay raporu (CSV)"
  echo "[x] Gunluk olay raporu (TXT)"
  echo "[x] Gunluk olay ozeti"
  echo "[x] API systemd loglari"
  echo "[x] Nginx systemd loglari"
  echo "[x] PostgreSQL systemd loglari"
  echo "[x] Nginx access loglari"
  echo "[x] Nginx error loglari"
  echo "[x] app-version.json"
  echo "[x] web-build.json"
  echo "[x] Manifest metadata"
  echo "[x] Makine okunur checklist metadata"
} > "${work_dir}/metadata/checklist.txt"

checks=(
  "Veritabani dump'i"
  "Gunluk olay raporu (CSV)"
  "Gunluk olay raporu (TXT)"
  "Gunluk olay ozeti"
  "API systemd loglari"
  "Nginx systemd loglari"
  "PostgreSQL systemd loglari"
  "Nginx access loglari"
  "Nginx error loglari"
  "app-version.json"
  "web-build.json"
  "Manifest metadata"
  "Makine okunur checklist metadata"
)

{
  printf '{\n'
  printf '  "backupDate": "%s",\n' "${target_date}"
  printf '  "hotelName": "%s",\n' "${hotel_name}"
  printf '  "layoutVersion": "%s",\n' "${LAYOUT_VERSION}"
  printf '  "checks": [\n'
  for i in "${!checks[@]}"; do
    suffix=","
    if [ "$i" -eq "$((${#checks[@]} - 1))" ]; then
      suffix=""
    fi
    printf '    { "label": "%s", "included": true }%s\n' "${checks[$i]}" "${suffix}"
  done
  printf '  ]\n'
  printf '}\n'
} > "${work_dir}/metadata/checklist.json"

cp "${work_dir}/metadata/manifest.env" "${manifest_env_path}"
cp "${work_dir}/metadata/manifest.json" "${manifest_json_path}"
cp "${work_dir}/metadata/checklist.txt" "${checklist_txt_path}"
cp "${work_dir}/metadata/checklist.json" "${checklist_json_path}"

{
  echo "HotelOps Gunluk Yedek Ozeti"
  echo "Tarih: ${target_date}"
  echo "Otel: ${hotel_name}"
  echo "Drive klasoru: ${remote_target}"
  echo "Arsiv: ${archive_name}"
  echo "Manifest: manifest.json"
  echo "Checklist: checklist.txt"
} > "${summary_txt_path}"

if ! command -v zip >/dev/null 2>&1; then
  echo "zip is required." >&2
  exit 69
fi

(cd "${work_dir}" && zip -qr -9 "${archive_path}" .)

sha256sum "${archive_path}" > "${checksum_path}"

if [ "${UPLOAD_ENABLED}" = "1" ]; then
  if ! command -v rclone >/dev/null 2>&1; then
    echo "Backup created locally, but rclone is required for upload: ${archive_path}" >&2
    exit 69
  fi
  remote_name="${RCLONE_REMOTE%%:*}:"
  if ! rclone listremotes | grep -Fxq "${remote_name}"; then
    echo "Backup created locally, but rclone remote ${remote_name} is not configured. Run: rclone config" >&2
    exit 78
  fi
  rclone copy "${archive_path}" "${remote_target}" --checksum --drive-chunk-size 64M
  rclone copy "${checksum_path}" "${remote_target}" --checksum --drive-chunk-size 64M
  rclone copy "${manifest_env_path}" "${remote_target}" --checksum --drive-chunk-size 64M
  rclone copy "${manifest_json_path}" "${remote_target}" --checksum --drive-chunk-size 64M
  rclone copy "${checklist_txt_path}" "${remote_target}" --checksum --drive-chunk-size 64M
  rclone copy "${checklist_json_path}" "${remote_target}" --checksum --drive-chunk-size 64M
  rclone copy "${summary_txt_path}" "${remote_target}" --checksum --drive-chunk-size 64M
fi

find "${BACKUP_ROOT}" -type f \( -name "*.zip" -o -name "*.sha256" -o -name "manifest.*" -o -name "checklist.*" -o -name "summary.txt" -o -name "*.tar.*" \) -mtime +"${LOCAL_RETENTION_DAYS}" -delete
find "${BACKUP_ROOT}" -mindepth 1 -type d -empty -delete

if [ "${UPLOAD_ENABLED}" = "1" ]; then
  rclone delete "${RCLONE_REMOTE}" --min-age "${REMOTE_RETENTION_DAYS}d" --include "*.zip" --include "*.sha256" --include "manifest.*" --include "checklist.*" --include "summary.txt" --include "*.tar.*" || true
  rclone rmdirs "${RCLONE_REMOTE}" --leave-root || true
fi

if [ "${UPLOAD_ENABLED}" = "1" ]; then
  echo "Backup uploaded: ${remote_target}/${archive_name}"
else
  echo "Backup created locally: ${archive_path}"
fi
