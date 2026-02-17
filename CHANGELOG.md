# Changelog

## v1.0.1
- Added Firefox AMO `data_collection_permissions` declaration (`required: ["none"]`).
- Raised Firefox minimum versions for manifest compatibility (`gecko` 140.0, `gecko_android` 142.0).
- Kept MV3 service worker and Firefox background scripts compatibility in one manifest.
- Replaced unsafe `innerHTML` usage in options page metadata rendering with safe DOM APIs.
- Fixed notification icon path to use `assets/icons/icon128.png`.

## v1.0.0
- Restructured repository into publish-ready layout with `src/`, `scripts/`, and `dist/` output.
- Updated manifest paths for organized popup/options/background/assets structure.
- Added cross-platform packaging scripts that create store-ready ZIP files with `manifest.json` at ZIP root.
- Added publishing and local-install documentation.
