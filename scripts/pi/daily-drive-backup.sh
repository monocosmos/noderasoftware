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

export TZ="${BACKUP_TZ}"
umask 077

target_date="${1:-$(date -d "yesterday" +%F)}"
start_at="${target_date} 00:00:00"
end_date="$(date -d "${target_date} +1 day" +%F)"
end_at="${end_date} 00:00:00"
backup_file_date="$(date -d "${target_date}" +%-Y-%-m-%-d)"
archive_name="${backup_file_date}.zip"
archive_path="${BACKUP_ROOT}/${archive_name}"

month_folder_name() {
  case "$(date -d "$1" +%m)" in
    01) printf "Ocak" ;;
    02) printf "Şubat" ;;
    03) printf "Mart" ;;
    04) printf "Nisan" ;;
    05) printf "Mayıs" ;;
    06) printf "Haziran" ;;
    07) printf "Temmuz" ;;
    08) printf "Ağustos" ;;
    09) printf "Eylül" ;;
    10) printf "Ekim" ;;
    11) printf "Kasım" ;;
    12) printf "Aralık" ;;
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
remote_target="${RCLONE_REMOTE}/${hotel_folder}/${month_folder}"

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

pg_dump --format=custom --no-owner --no-acl --file "${work_dir}/db/hotelops-${target_date}.dump" "${DATABASE_URL}"

report_csv="${work_dir}/reports/gunluk-olay-raporu.csv"
report_txt="${work_dir}/reports/gunluk-olay-raporu.txt"
report_summary="${work_dir}/reports/gunluk-ozet.txt"
report_sql="${work_dir}/reports/gunluk-olay-raporu.sql"

cat > "${report_sql}" <<SQL
\\set ON_ERROR_STOP on
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

\\copy (SELECT "TarihSaat", "Otel", "Kullanici", "KullaniciID", "KullaniciAdi", "Departman", "Kaynak", "Islem", "Aciklama", "IP", "CihazTarayici" FROM daily_events ORDER BY sort_at, "Islem") TO '${report_csv}.raw' WITH CSV HEADER
\\copy (SELECT "TarihSaat", "Kullanici", "Departman", "Islem", "Aciklama" FROM daily_events ORDER BY sort_at, "Islem") TO '${report_txt}.raw' WITH CSV HEADER DELIMITER E'\\t'
\\copy (SELECT "Islem", count(*) AS "Adet" FROM daily_events GROUP BY "Islem" ORDER BY "Adet" DESC, "Islem") TO '${report_summary}.raw' WITH CSV HEADER DELIMITER E'\\t'
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

{
  echo "backup_date=${target_date}"
  echo "window_start=${start_at} ${BACKUP_TZ}"
  echo "window_end=${end_at} ${BACKUP_TZ}"
  echo "created_at=$(date --iso-8601=seconds)"
  echo "host=$(hostname)"
  echo "hotel_name=${hotel_name}"
  echo "app_dir=${APP_DIR}"
  echo "remote=${remote_target}"
  echo
  echo "[services]"
  systemctl is-active hotelops-api nginx postgresql || true
  echo
  echo "[disk]"
  df -h / /boot/firmware || true
} > "${work_dir}/metadata/manifest.txt"

if ! command -v zip >/dev/null 2>&1; then
  echo "zip is required." >&2
  exit 69
fi

(cd "${work_dir}" && zip -qr -9 "${archive_path}" .)

sha256sum "${archive_path}" > "${archive_path}.sha256"

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
  rclone copy "${archive_path}.sha256" "${remote_target}" --checksum --drive-chunk-size 64M
fi

find "${BACKUP_ROOT}" -type f -name "20??-*-*.zip" -mtime +"${LOCAL_RETENTION_DAYS}" -delete
find "${BACKUP_ROOT}" -type f -name "20??-*-*.zip.sha256" -mtime +"${LOCAL_RETENTION_DAYS}" -delete
find "${BACKUP_ROOT}" -type f -name "20??-*-*.tar.*" -mtime +"${LOCAL_RETENTION_DAYS}" -delete
find "${BACKUP_ROOT}" -type f -name "20??-*-*.tar.*.sha256" -mtime +"${LOCAL_RETENTION_DAYS}" -delete
find "${BACKUP_ROOT}" -type f -name "hotelops-daily-*.tar.*" -mtime +"${LOCAL_RETENTION_DAYS}" -delete
find "${BACKUP_ROOT}" -type f -name "hotelops-daily-*.tar.*.sha256" -mtime +"${LOCAL_RETENTION_DAYS}" -delete

if [ "${UPLOAD_ENABLED}" = "1" ]; then
  rclone delete "${RCLONE_REMOTE}" --min-age "${REMOTE_RETENTION_DAYS}d" --include "20??-*-*.zip" --include "20??-*-*.zip.sha256" --include "20??-*-*.tar.*" --include "20??-*-*.tar.*.sha256" --include "hotelops-daily-*.tar.*" --include "hotelops-daily-*.sha256" || true
  rclone rmdirs "${RCLONE_REMOTE}" --leave-root || true
fi

if [ "${UPLOAD_ENABLED}" = "1" ]; then
  echo "Backup uploaded: ${archive_name}"
else
  echo "Backup created locally: ${archive_path}"
fi
