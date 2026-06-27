#!/usr/bin/env bash
set -Eeuo pipefail

PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"

usage() {
  cat <<'USAGE'
Usage:
  sudo bash scripts/pi/migrate-sd-root-to-usb-ssd.sh /dev/sda --yes-i-understand-wipe

This repartitions the target disk, copies the current SD-card root system to it,
updates the copied boot config and fstab, and leaves services stopped so the
machine can be rebooted immediately into the SSD.
USAGE
}

TARGET_DISK="${1:-}"
CONFIRM="${2:-}"
MNT="/mnt/ssd-root"
SUCCESS_READY=0
STOPPED_SERVICES=()

log() {
  printf '\n== %s ==\n' "$*"
}

fail() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}

part_path() {
  local disk="$1"
  local index="$2"
  if [[ "$disk" =~ [0-9]$ ]]; then
    printf '%sp%s\n' "$disk" "$index"
  else
    printf '%s%s\n' "$disk" "$index"
  fi
}

cleanup_mounts() {
  set +e
  mountpoint -q "$MNT/boot/firmware" && umount "$MNT/boot/firmware"
  mountpoint -q "$MNT" && umount "$MNT"
}

restart_stopped_services() {
  set +e
  if ((${#STOPPED_SERVICES[@]} > 0)); then
    log "Restarting services after failure"
    for ((idx=${#STOPPED_SERVICES[@]}-1; idx>=0; idx--)); do
      systemctl start "${STOPPED_SERVICES[$idx]}" || true
    done
  fi
}

on_exit() {
  local status=$?
  cleanup_mounts
  if [[ "$status" -ne 0 && "$SUCCESS_READY" -ne 1 ]]; then
    restart_stopped_services
  fi
  exit "$status"
}
trap on_exit EXIT

run_root_rsync() {
  local label="$1"
  log "$label"
  set +e
  rsync -aHAXx --numeric-ids --delete --info=stats2 \
    --exclude='/dev/*' \
    --exclude='/proc/*' \
    --exclude='/sys/*' \
    --exclude='/tmp/*' \
    --exclude='/run/*' \
    --exclude='/mnt/*' \
    --exclude='/media/*' \
    --exclude='/lost+found' \
    / "$MNT/"
  local rc=$?
  set -e
  if [[ "$rc" -ne 0 && "$rc" -ne 24 ]]; then
    fail "rsync failed with exit code $rc"
  fi
  if [[ "$rc" -eq 24 ]]; then
    printf 'Note: rsync reported vanished files; this is acceptable during a live pre-copy.\n'
  fi
}

run_boot_rsync() {
  local label="$1"
  log "$label"
  rsync -rtD --delete --info=stats2 /boot/firmware/ "$MNT/boot/firmware/"
}

if [[ "$CONFIRM" != "--yes-i-understand-wipe" || -z "$TARGET_DISK" ]]; then
  usage
  exit 2
fi

if [[ "$EUID" -ne 0 ]]; then
  fail "run this script as root via sudo"
fi

for cmd in blkid findmnt fsck.vfat lsblk mount partprobe parted rsync sed sync tune2fs umount wipefs; do
  command -v "$cmd" >/dev/null 2>&1 || fail "missing required command: $cmd"
done
for cmd in mkfs.vfat mkfs.ext4; do
  command -v "$cmd" >/dev/null 2>&1 || fail "missing required formatter: $cmd"
done

TARGET_DISK="$(readlink -f "$TARGET_DISK")"
[[ -b "$TARGET_DISK" ]] || fail "target disk is not a block device: $TARGET_DISK"

case "$TARGET_DISK" in
  /dev/mmcblk*) fail "refusing to wipe an mmc device: $TARGET_DISK" ;;
esac

ROOT_SOURCE="$(readlink -f "$(findmnt -n -o SOURCE /)")"
BOOT_SOURCE="$(findmnt -n -o SOURCE /boot/firmware || true)"

[[ "$ROOT_SOURCE" == /dev/mmcblk* ]] || fail "current root is not on SD/mmc: $ROOT_SOURCE"
[[ "$ROOT_SOURCE" != "$TARGET_DISK"* ]] || fail "target disk is the active root disk"

if lsblk -nrpo MOUNTPOINT "$TARGET_DISK" | grep -q .; then
  fail "target disk or one of its partitions is mounted"
fi

MODEL="$(lsblk -dn -o MODEL "$TARGET_DISK" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
SIZE="$(lsblk -dn -o SIZE "$TARGET_DISK" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
TRAN="$(lsblk -dn -o TRAN "$TARGET_DISK" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"

log "Migration target"
printf 'Target disk: %s\nModel: %s\nSize: %s\nTransport: %s\nCurrent root: %s\nBoot source: %s\n' \
  "$TARGET_DISK" "${MODEL:-unknown}" "${SIZE:-unknown}" "${TRAN:-unknown}" "$ROOT_SOURCE" "${BOOT_SOURCE:-unknown}"

log "Partitioning and formatting target"
wipefs -a "$TARGET_DISK"
parted -s "$TARGET_DISK" mklabel msdos
parted -s -a optimal "$TARGET_DISK" mkpart primary fat32 4MiB 516MiB
parted -s "$TARGET_DISK" set 1 lba on
parted -s -a optimal "$TARGET_DISK" mkpart primary ext4 516MiB 100%
partprobe "$TARGET_DISK"
udevadm settle
sleep 2

BOOT_PART="$(part_path "$TARGET_DISK" 1)"
ROOT_PART="$(part_path "$TARGET_DISK" 2)"
[[ -b "$BOOT_PART" ]] || fail "boot partition was not created: $BOOT_PART"
[[ -b "$ROOT_PART" ]] || fail "root partition was not created: $ROOT_PART"

mkfs.vfat -F 32 -n bootfs "$BOOT_PART"
mkfs.ext4 -F -L rootfs "$ROOT_PART"
tune2fs -m 1 "$ROOT_PART"

log "Mounting target"
mkdir -p "$MNT"
mount "$ROOT_PART" "$MNT"
mkdir -p "$MNT/boot/firmware"
mount "$BOOT_PART" "$MNT/boot/firmware"

run_root_rsync "Initial root copy while services are online"
run_boot_rsync "Initial boot copy"

log "Stopping application services for final consistent copy"
for svc in nginx hotelops-api postgresql; do
  if systemctl is-active --quiet "$svc"; then
    systemctl stop "$svc"
    STOPPED_SERVICES+=("$svc")
    printf 'Stopped %s\n' "$svc"
  fi
done

run_root_rsync "Final root copy with services stopped"
run_boot_rsync "Final boot copy"

BOOT_PARTUUID="$(blkid -s PARTUUID -o value "$BOOT_PART")"
ROOT_PARTUUID="$(blkid -s PARTUUID -o value "$ROOT_PART")"
[[ -n "$BOOT_PARTUUID" ]] || fail "could not read boot PARTUUID"
[[ -n "$ROOT_PARTUUID" ]] || fail "could not read root PARTUUID"

log "Updating copied fstab and kernel command line"
cp "$MNT/etc/fstab" "$MNT/etc/fstab.before-ssd-migration"
cat > "$MNT/etc/fstab" <<EOF
proc            /proc           proc    defaults          0       0
PARTUUID=$BOOT_PARTUUID  /boot/firmware  vfat    defaults          0       2
PARTUUID=$ROOT_PARTUUID  /               ext4    defaults,noatime  0       1
EOF

cp "$MNT/boot/firmware/cmdline.txt" "$MNT/boot/firmware/cmdline.txt.before-ssd-migration"
sed -i -E "s#root=PARTUUID=[^ ]+#root=PARTUUID=$ROOT_PARTUUID#" "$MNT/boot/firmware/cmdline.txt"

log "Copied boot config"
cat "$MNT/boot/firmware/cmdline.txt"
printf '\n'
cat "$MNT/etc/fstab"

log "Flushing and checking copied filesystems"
sync
umount "$MNT/boot/firmware"
umount "$MNT"
e2fsck -fn "$ROOT_PART"
fsck.vfat -n "$BOOT_PART"

SUCCESS_READY=1
log "SSD migration copy is ready"
printf 'Boot partition: %s PARTUUID=%s\n' "$BOOT_PART" "$BOOT_PARTUUID"
printf 'Root partition: %s PARTUUID=%s\n' "$ROOT_PART" "$ROOT_PARTUUID"
printf 'Services were left stopped intentionally. Reboot into SSD next.\n'
