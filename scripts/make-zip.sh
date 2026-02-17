#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC_DIR="$ROOT_DIR/src"
DIST_DIR="$ROOT_DIR/dist"
TMP_DIR="$ROOT_DIR/.tmp-package"
MANIFEST_PATH="$SRC_DIR/manifest.json"

if [[ ! -f "$MANIFEST_PATH" ]]; then
  echo "Error: $MANIFEST_PATH not found" >&2
  exit 1
fi

VERSION="$(python3 -c 'import json,sys;print(json.load(open(sys.argv[1]))["version"])' "$MANIFEST_PATH")"
EXTENSION_ID="$(python3 -c 'import json,sys,re;m=json.load(open(sys.argv[1]));gid=((m.get("browser_specific_settings",{}).get("gecko",{}) or {}).get("id","")).split("@")[0];name=(gid or "extension").strip();print(re.sub(r"[^a-z0-9._-]+","-",name.lower()))' "$MANIFEST_PATH")"
ZIP_NAME="${EXTENSION_ID}-v${VERSION}.zip"
ZIP_PATH="$DIST_DIR/$ZIP_NAME"

rm -rf "$DIST_DIR" "$TMP_DIR"
mkdir -p "$DIST_DIR" "$TMP_DIR"

rsync -a \
  --exclude '.git' \
  --exclude 'node_modules' \
  --exclude 'dist' \
  --exclude 'scripts' \
  --exclude 'docs' \
  --exclude '*.psd' \
  --exclude '*.ai' \
  --exclude '*.sketch' \
  --exclude '*.xcf' \
  --exclude '*.log' \
  "$SRC_DIR/" "$TMP_DIR/"

(
  cd "$TMP_DIR"
  zip -qr "$ZIP_PATH" .
)

python3 - <<'PY' "$ZIP_PATH" "$MANIFEST_PATH"
import json,sys,zipfile
from pathlib import Path

zip_path=Path(sys.argv[1])
manifest_path=Path(sys.argv[2])

with zipfile.ZipFile(zip_path) as zf:
    names=set(zf.namelist())
    if 'manifest.json' not in names:
        raise SystemExit('Verification failed: manifest.json is not at ZIP root')

    manifest=json.loads(zf.read('manifest.json').decode('utf-8'))

    required=[]
    action=(manifest.get('action') or {}).get('default_popup')
    options=(manifest.get('options_ui') or {}).get('page')
    bg=manifest.get('background') or {}
    if action: required.append(action)
    if options: required.append(options)
    service_worker=bg.get('service_worker')
    if service_worker: required.append(service_worker)
    for script in (bg.get('scripts') or []):
      required.append(script)
    for icon in (manifest.get('icons') or {}).values():
      required.append(icon)

    default_locale = manifest.get('default_locale')
    if default_locale:
      locale_file = f"_locales/{default_locale}/messages.json"
      required.append(locale_file)
      manifest_text = json.dumps(manifest)
      if '__MSG_' in manifest_text:
        missing_msgs = []
        locale_data = json.loads(zf.read(locale_file).decode('utf-8')) if locale_file in names else {}
        import re
        for key in sorted(set(re.findall(r'__MSG_([A-Za-z0-9_@]+)__', manifest_text))):
          if key not in locale_data:
            missing_msgs.append(key)
        if missing_msgs:
          raise SystemExit('Verification failed: missing locale message keys in ' + locale_file + ': ' + ', '.join(missing_msgs))

    missing=[p for p in required if p not in names]
    if missing:
        raise SystemExit('Verification failed: missing manifest-referenced files in ZIP: ' + ', '.join(missing))

print(f'Created {zip_path}')
print('Verification passed')
PY

rm -rf "$TMP_DIR"
