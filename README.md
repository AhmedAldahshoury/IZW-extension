# IZW Prayer Times (Vienna) WebExtension

Firefox Manifest V3 extension that shows the next prayer time for IZW Vienna, with offline prayer times, reminders, and simple language/settings controls.

## Features
- Offline prayer times from bundled JSON data (no API calls).
- Popup with next prayer, countdown, today schedule, Hijri date, and Friday Jumu'ah highlight.
- Optional reminders before prayer and at prayer time.
- Options page and quick popup settings (notifications, badge, Hijri correction, language, Ramadan theme toggle).
- English and Arabic locale metadata.

## Install locally in Firefox
1. Open `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on...**.
3. Select `src/manifest.json` from this repository.

## Troubleshooting temporary add-on install
- Make sure you load **`src/manifest.json`** (not the repository root and not a nested old folder).
- If Firefox shows a generic install error, open **Browser Console** (`Ctrl+Shift+J`) right after loading to see the exact manifest validation message.
- This repo targets Firefox MV3 with service worker support (`strict_min_version: 140.0`), so use Firefox 140+ for local testing.

## Permissions used
- `storage`: save extension settings locally.
- `alarms`: schedule refreshes and prayer reminder timing.
- `notifications`: show prayer reminder notifications.

## Privacy
This extension does **not** collect, transmit, or sell personal data.
All settings and prayer time logic run locally in the browser.

## Build / release ZIP for AMO
Store upload ZIP must contain `manifest.json` at ZIP root.

### Linux / macOS
```bash
bash scripts/make-zip.sh
```

### Windows PowerShell
```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\make-zip.ps1
```

Output ZIPs are written to `dist/` as:
- `dist/<extension-id>-v<version>.zip`

### Optional linting with web-ext
`web-ext` is optional and not required for normal extension use.

```bash
web-ext lint -s src
web-ext build -s src -a dist
```

## Screenshots
- Popup: _add screenshot here_
- Options page: _add screenshot here_

