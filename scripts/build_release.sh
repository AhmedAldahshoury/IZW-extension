#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
EXT_DIR="$ROOT_DIR/izw-next-prayer-extension"
ARTIFACTS_DIR="$ROOT_DIR/artifacts"
ZIP_PATH="$ARTIFACTS_DIR/izw-extension-amo.zip"

mkdir -p "$ARTIFACTS_DIR"
rm -f "$ZIP_PATH"

(
  cd "$EXT_DIR"
  zip -qr "$ZIP_PATH" . -x "*.DS_Store" "*/.DS_Store"
)

echo "Created $ZIP_PATH"
