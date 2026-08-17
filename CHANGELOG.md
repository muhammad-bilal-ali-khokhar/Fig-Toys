# Changelog

All notable changes are documented here. Released sections are curated by hand
for clarity; `scripts/changelog.sh` prepends the newest version's section on
each release without overwriting earlier notes.

## v0.1.33

- Released on: 2026-08-17

- fix: clear renderer cache before relaunch after content update

- Released on: 2026-08-17

- fix: exclude version-bump commit from manifest type detection

- Released on: 2026-08-17

- feat: add 10 new themes (midnight, lavender, coral, sage, copper, nordic, cherry, carbon, slate, amber)

- Released on: 2026-08-17

- fix: fetch full history in build job so manifest type detection works

- Released on: 2026-08-17

- fix: detect manifest type when HEAD is exactly at a tag

- Released on: 2026-08-17

- feat: content updates via typed manifest, applied from Settings
- revert: remove content-update approval flow, keep installer-based updates

- Released on: 2026-08-17

- fix: clear renderer cache after content update to avoid stale chunk errors

- Released on: 2026-08-17

- feat: always enable devtools/reload in the app

- Released on: 2026-08-17

- feat: allow devtools in packaged app when launched with --dev

- Released on: 2026-08-17

- fix: backend crash after content update (better-sqlite3 not found)
- feat: render release notes as formatted markdown in update panel
- ci: stop regenerating changelog in build job; keep curated notes

### Installer download fix
- **Fixed installer download 404.** `productName` ("Fig POS") contains a space;
  in the artifact name electron-builder wrote the space as a period in the actual
  file (`Fig.POS-Setup`) but a hyphen in `latest.yml` (`Fig-POS-Setup`), so the
  updater's download URL 404'd. The artifact name is now explicit and space-free,
  so the file and `latest.yml` always match.
- **Fixed changelog release notes** that showed "No notable changes" on every
  release (the build job regenerated notes after tagging, producing an empty
  range).

## v0.1.22 (2026-08-17)

### Development tooling
- **Re-enabled developer tools in dev mode.** Only shipped (packaged) builds
  harden shortcuts/devtools now. In dev mode the View menu exposes Force Reload
  and Toggle DevTools, and Cmd/Ctrl+Shift+I works, so the frontend can be
  inspected while developing.

## v0.1.21 (2026-08-17)

### Update approval & installer polish
- **Content update approval flow.** Content updates (backend/frontend bundle)
  are no longer applied silently. The app now checks availability at startup
  and, when a newer build exists, shows a reusable **ActionNotification**
  (bottom-right) with "Update now" and "Update later". "Update now" downloads,
  verifies, swaps the bundle and restarts the app; "Update later" defers the
  update to a later launch.
- **Reusable ActionNotification component.** A generic bottom-right alert with
  title, description and action buttons, built on the existing design language
  (`brand-*`/`ink-*` tokens, rounded-2xl card). Can be reused for any
  attention-required prompt, not just updates.
- **Content update split.** `desktop/content-update.js` now separates a
  read-only availability check from an explicit apply step; `main.js` exposes
  `content:check`/`content:apply` IPC and pushes `content:available` to the UI.

## v0.1.20 (2026-08-17)

### Build & dependency fixes
- **Pinned `got` to ^11 and synced the desktop lockfile.** The content-update
  deps (`got`, `extract-zip`) were added to `package.json` but not the lockfile,
  which broke `npm ci` in CI. Pinned `got` to match the already-resolved tree and
  regenerated `desktop/package-lock.json` so releases build again.

## v0.1.19 (2026-08-17)

### Content self-update (no reinstall)
- **Backend/frontend content updates without reinstalling.** Each GitHub Release
  now publishes `production.zip` (backend + frontend bundle) plus `manifest.json`
  (contentVersion + sha256). At startup the desktop app fetches the manifest,
  compares versions, verifies the sha256, and swaps the updated bundle into the
  user-data dir. Dir resolution prefers this copy, so UI/API-only changes apply
  on next launch with no full installer and no Electron shell update.

## v0.1.18 (2026-08-17)

### Desktop settings clarity
- **Windows-only update notice.** The Settings → Updates panel now detects the
  platform via the preload `platform` flag and, on macOS/Linux, explains that OTA
  updates are only available in the Windows build instead of showing a
  misleading "latest version" state.

## v0.1.17 (2026-08-17)

### OTA reliability on Windows
- **Restricted OTA updates to Windows only.** The app publishes only Windows NSIS
  artifacts, so update checks on macOS/Linux were 404ing on `latest-mac.yml`.
  Checks are now gated to `win32`, so other platforms skip updates cleanly.
- **Enabled OTA checks in dev/unpacked builds.** Set `forceDevUpdateConfig` and
  shipped a `dev-app-update.yml` so the app checks for updates even when run
  unpacked. Manual and startup checks share one path across dev and packaged mode.
- **Changelog link fix.** Pointed the in-app changelog link at the new
  `arsalanwahab/Mobile-Shop-POS` repository.

## v0.1.16 (2026-08-17)

### Installer branding & updater consolidation
- **Polished the NSIS installer.** Added a branded sidebar image (derived from the
  splash), a header icon, a license/agreement page, custom welcome text, desktop +
  start-menu shortcuts, and run-after-finish. Added a copyright line and removed a
  stale file reference.
- **Fixed the publish repository.** `electron-builder` publish `owner` now points
  at `arsalanwahab` (was the old `mykopk` repo), so in-app OTA self-updates keep
  working after the repository move.
- **Removed the standalone updater.** The separate `desktop/updater/` mini-app was
  deleted and all its references stripped from the release workflow. The main
  Electron app's `electron-updater`/`autoUpdater` flow is now the sole update path.
- **Polished the About window update UI.** The About window now shows a download
  progress bar, release notes, and a restart button, matching the Settings update
  panel.

## v0.1.15 (2026-08-17)

### Help, onboarding & crash feedback
- **Help & documentation page.** Added a full Help page (15 sections) mirroring the
  Settings layout, with a searchable sidebar, plus developer/company contacts.
  Reached from the Account nav and the desktop menu.
- **Onboarding polish.** After store setup, the app now auto-logs-in as the admin
  and goes straight to the dashboard.
- **Crash-report feedback & desktop branding.** Continued branding work across the
  desktop shell and refined the crash-reporting flow.
- **Single production build.** Consolidated frontend/backend into one self-contained
  `production/` bundle used by the installer.
- **Catalog seeds on first boot.** Product/catalog seed data is applied only on the
  first run rather than every launch.
- **Removed obsolete crash-report token injection** from the release workflow.

## v0.1.14 (2026-08-17)

- Fixed the frontend proxy so it targets the packaged backend port in the
  installed app.

## v0.1.13 (2026-08-17)

- Stamped the app version into the startup log line for easier issue triage.

## v0.1.12 (2026-08-17)

- Fixed the standalone frontend + backend bundle so both run correctly in the
  packaged app.

## v0.1.11 (2026-08-17)

- Added granular startup status messages so the loading screen reports exactly
  what the app is doing (DB setup, servers booting, etc.).

## v0.1.10 (2026-08-17)

- Fixed `better-sqlite3` loading from a plain `native/` folder via `NODE_PATH`.

## v0.1.9 (2026-08-17)

- Fixed shipping the `better-sqlite3` native module inside the installer so the
  packaged app can open its database.

## v0.1.8 (2026-08-17)

- Fixed first-run database setup in the packaged app (schema creation).

## v0.1.7 (2026-08-17)

- Added a copyable error window so crash details can be copied and shared.

## v0.1.6 (2026-08-17)

- Added silent background crash reporting.

## v0.1.5 (2026-08-17)

- Injected the crash-report token at build time from a GitHub secret.

## v0.1.4 (2026-08-17)

- Sent crash reports to GitHub Issues.

## v0.1.3 (2026-08-17)

- Packaged `logging.js` + `loading.html` in the app.
- Added the loading screen shown during desktop startup.

## v0.1.2 (2026-08-17)

- Added automatic changelog generation + crash logging for the desktop app.

## v0.1.1

- No notable changes.

## v0.1.0

- Self-contained backend bundle (esbuild) + standalone frontend; slimmer installer.
- Thermal printing with per-document print defaults.
- Offline POS queue.
- Purchase orders.
- Backup/restore UI.
- Z-report + cash session reconciliation.
- Money ledger, Windows desktop app, tests, CI & auto-releases.
- POS/reservations/dashboard overhaul and production hardening.
- Complete POS system overhaul — print studio, reports hub, settings, auth upgrades.
- Phase 1 backend endpoints, frontend pages, UI components, and schema updates.
- Initial project scaffold.
