#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

source_icon="build/icon.png"
iconset_dir="build/icon.iconset"
target_icon="build/icon.icns"

if [[ ! -f "$source_icon" ]]; then
  echo "Missing $source_icon. Commit apps/desktop/build/icon.png before running the macOS build." >&2
  exit 1
fi

if ! command -v sips >/dev/null 2>&1; then
  echo "sips is required and is available on macOS runners only." >&2
  exit 1
fi

if ! command -v iconutil >/dev/null 2>&1; then
  echo "iconutil is required and is available on macOS runners only." >&2
  exit 1
fi

rm -rf "$iconset_dir"
mkdir -p "$iconset_dir"

for size in 16 32 128 256 512; do
  sips -z "$size" "$size" "$source_icon" --out "$iconset_dir/icon_${size}x${size}.png" >/dev/null
  retina_size=$((size * 2))
  sips -z "$retina_size" "$retina_size" "$source_icon" --out "$iconset_dir/icon_${size}x${size}@2x.png" >/dev/null
done

iconutil -c icns "$iconset_dir" -o "$target_icon"
rm -rf "$iconset_dir"

echo "Created $target_icon"
