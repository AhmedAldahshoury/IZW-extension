# IZW Extension Release Readiness Report

## Current state (discovery)
- Manifest was MV2 with a persistent background page; now migrated to MV3 service worker for current AMO compatibility.
- Popup page existed (`popup.html` + `popup.js`) and contains the core UI, settings panel, Hijri date, Ramadan styles, and Jumu'ah styling.
- Storage usage: local extension storage (`storage.local`) for user settings.
- Alarms and notifications are used for pre-prayer and at-time reminders.
- Prayer data source: bundled local JSON file (`data/izw_prayer_times_2026.json`) loaded via `runtime.getURL` and `fetch` (local extension resource only).
- External resources: no CDNs, no remote scripts, no remote fonts.

## Risks identified for AMO submission
- MV2 manifest/persistent background can be rejected or considered outdated.
- No explicit CSP section was present.
- No user-facing privacy policy and permissions justification docs.
- No options page for full settings management and QA/debug flow.
- Incomplete release packaging flow (no repeatable validate/build script + no listing copy docs).

## Changes made
- Migrated to MV3 (`manifest.json`) with a service worker background.
- Hardened extension CSP and retained zero host permissions.
- Added options page with the same settings model and Ramadan/Jumu'ah contextual UI indicators.
- Kept Ramadan auto-enable when Hijri month is Ramadan (9), while keeping debug override toggle default OFF.
- Preserved Jumu'ah highlight behavior and explicit Friday indicator.
- Added i18n locale files for AMO-facing metadata in Arabic and English.
- Added compliance and listing docs: permissions, privacy, AMO listing text.
- Added automated scripts for validation and release ZIP packaging.
- Kept packaged icons to the existing repository icons to avoid introducing new binary assets in this PR workflow.
