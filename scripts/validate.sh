#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
EXT_DIR="$ROOT_DIR/izw-next-prayer-extension"

python -m json.tool "$EXT_DIR/manifest.json" > /dev/null
python -m json.tool "$EXT_DIR/data/izw_prayer_times_2026.json" > /dev/null

if command -v web-ext >/dev/null 2>&1; then
  web-ext lint --source-dir "$EXT_DIR"
else
  echo "web-ext not installed; skipped web-ext lint" >&2
fi

echo "Validation complete"
