#!/usr/bin/env node
const path = require('path');
const { execSync } = require('child_process');

const zipPath = process.argv[2];
if (!zipPath) {
  console.error('Usage: node scripts/verify-package.js dist/<file>.zip');
  process.exit(1);
}

const list = execSync(`python3 - <<'PY' "${zipPath}"
import json,sys,zipfile
z=zipfile.ZipFile(sys.argv[1])
print(json.dumps(z.namelist()))
PY`).toString();
const names = new Set(JSON.parse(list));

if (!names.has('manifest.json')) {
  throw new Error('manifest.json missing at ZIP root');
}

const manifest = JSON.parse(execSync(`python3 - <<'PY' "${zipPath}"
import sys,zipfile
z=zipfile.ZipFile(sys.argv[1])
print(z.read('manifest.json').decode())
PY`).toString());

const required = [];
if (manifest.action?.default_popup) required.push(manifest.action.default_popup);
if (manifest.options_ui?.page) required.push(manifest.options_ui.page);
if (manifest.background?.service_worker) required.push(manifest.background.service_worker);
if (Array.isArray(manifest.background?.scripts)) required.push(...manifest.background.scripts);
if (manifest.icons) required.push(...Object.values(manifest.icons));

if (manifest.default_locale) {
  const localeFile = `_locales/${manifest.default_locale}/messages.json`;
  required.push(localeFile);

  const manifestText = JSON.stringify(manifest);
  const msgMatches = [...manifestText.matchAll(/__MSG_([A-Za-z0-9_@]+)__/g)].map((m) => m[1]);
  if (msgMatches.length && names.has(localeFile)) {
    const locale = JSON.parse(execSync(`python3 - <<'PY' "${zipPath}" "${localeFile}"
import sys,zipfile
z=zipfile.ZipFile(sys.argv[1])
print(z.read(sys.argv[2]).decode())
PY`).toString());
    const localeKeys = new Set(Object.keys(locale));
    const missingLocaleKeys = [...new Set(msgMatches)].filter((key) => !localeKeys.has(key));
    if (missingLocaleKeys.length) {
      throw new Error(`Missing locale message keys in ${localeFile}: ${missingLocaleKeys.join(', ')}`);
    }
  }
}

const missing = required.filter((p) => !names.has(p));
if (missing.length) {
  throw new Error(`Missing manifest-referenced files: ${missing.join(', ')}`);
}

console.log('Verification passed:', path.basename(zipPath));
