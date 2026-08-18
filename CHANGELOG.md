# Changelog

All notable changes are documented here. Released sections are curated by hand
for clarity; `scripts/changelog.sh` prepends the newest version's section on
each release without overwriting earlier notes.

## v0.1.48

- Released on: 2026-08-18

- feat: license key activation with device locking and activation screen
- docs: update architecture/roadmap/feature-audit to match current build; dedupe status labels; add frontend typecheck script

- Released on: 2026-08-18

- feat: installer update prompt, rename repo to Fig POS, splash images
- docs: rewrite README with comprehensive Fig POS overview
- fix: resolve type error in products create flow; add type-aware default category
- feat: show clean ExpenseReceipt confirmation after creating an expense
- feat: print settings overhaul, bank deposit, transaction receipt, contacts report
- feat: category hierarchy, dashboard overhaul, POS discount refactor, sub-category reports

- Released on: 2026-08-17

- feat: add ReservationModifyPicker component and update reservations page

- Released on: 2026-08-17

- fix: remove invalid installDir, use NSIS preInit macro for custom install path
- feat: remove content-update system, clean up update UI, install to C:\Wavlon Studio\Fig POS, clean changelog
- fix: clear renderer cache on startup to prevent stale chunk errors after content update
- feat: rearrange sidebar nav — sales flow first, then purchases, stock, money
- fix: simplify installer.nsh — NSIS already handles in-place updates via registry
- fix: remove invalid installMode option, perMachine:false already means per-user
- fix: use  guard in customInit per NSIS docs
- feat: in-place installer updates — detect existing install, skip reinstall
- fix: clear stale content cache after shell update so new frontend loads
- fix: clear renderer cache before relaunch after content update
- fix: exclude version-bump commit from manifest type detection
- feat: add 10 new themes (midnight, lavender, coral, sage, copper, nordic, cherry, carbon, slate, amber)
- fix: fetch full history in build job so manifest type detection works
- fix: detect manifest type when HEAD is exactly at a tag
- feat: content updates via typed manifest, applied from Settings
- revert: remove content-update approval flow, keep installer-based updates
- fix: clear renderer cache after content update to avoid stale chunk errors
- feat: always enable devtools/reload in the app
- feat: allow devtools in packaged app when launched with --dev
- fix: backend crash after content update (better-sqlite3 not found)
- feat: render release notes as formatted markdown in update panel
- ci: stop regenerating changelog in build job; keep curated notes
- fix: installer download 404 due to space in productName artifact name
- fix: changelog release notes showed 'No notable changes' on every release
- feat: re-enable devtools in dev mode via View menu + shortcuts
- docs: detailed curated changelog for all versions
- docs: detailed curated changelog + prepend-only generator
- feat: content update approval via ActionNotification (update now/later)
- fix: pin got to ^11 and sync desktop lockfile
- feat: content self-update for backend/frontend without reinstall
- feat: show Windows-only update notice in desktop app settings
- fix: restrict OTA updates to Windows platform
- feat: enable OTA update checks in dev/unpacked builds
- feat: polish NSIS installer branding + fix publish repo
- refactor: remove standalone updater, polish About window update UI
- ci: drop obsolete crash-report token injection from release
- feat: help docs page, onboarding polish, crash-report feedback & desktop branding
- refactor: single production build (production/) + first-boot-only catalog seeds
- feat: onboarding setup (store, admin, banks) + always-on catalog seeds
- chore: add login dev marker (DEV-20260817) for cross-machine verification
- fix: use bsdtar to zip unpacked build (PowerShell glob broke on spaces)
- fix: don't auto-publish during electron-builder (no GH_TOKEN in CI)
- fix: API base fell back to /undefined in CI/packaged builds
- feat: standalone updater app + no-install (unpacked) Windows test build
- chore: add scripts/build-win.sh for fast Windows test builds (no release)
- fix: frontend proxies to the packaged backend port
- feat: stamp app version in the startup log line
- fix: standalone frontend + backend bundle in packaged app
- feat: granular startup status
- fix: load better-sqlite3 from a plain native/ folder via NODE_PATH
- fix: ship better-sqlite3 native module in the installer
- fix: first-run database setup in packaged app
- feat: copyable error window
- feat: silent background crash reporting
- feat: inject crash-report token at build time from GitHub secret
- feat: send crash reports to GitHub Issues
- fix: package logging.js + loading.html in the app
- feat: loading screen during desktop startup
- feat: auto changelog + crash logging for desktop app
- remove unused backend build config
- self-contained backend bundle (esbuild) + standalone frontend; slim installer
- add -Dist option to build installer locally
- add Windows build-test helper script
- drop win-unpacked artifact upload to speed up builds
- add Windows app icon
- reverted
- changed e
- fix: grant contents:write to create GitHub release
- fix: use windows-2022 runner for native module build
- Money ledger, Windows desktop app, tests, CI & auto-releases
- docs: refresh feature audit and roadmap; fix test DB reset order
- feat: thermal printing + per-document print defaults
- feat: offline POS queue
- feat: purchase orders
- feat: backup/restore UI
- feat: Z-report + cash session reconciliation
- fix: money rounding, credit-limit-0, expense tz, return void, idempotency, tests
- feat: production hardening + POS/reservations/dashboard overhaul
- feat: add Render deployment config; fix migrations and seed for fresh deploys
- feat: complete POS system overhaul - print studio, reports hub, settings, auth upgrades
- fix: resolve merge conflicts in user endpoints and settings page
- feat: expand backend core libs, endpoints, frontend pages, UI components, and docs
- feat: phase1 backend endpoints, frontend pages, UI components, and schema updates
- Initial commit: DOST Mobile POS project scaffold

- Released on: 2026-08-17

- feat: remove content-update system, clean up update UI, install to C:\Wavlon Studio\Fig POS, clean changelog

- Released on: 2026-08-17

- No notable changes.

- Released on: 2026-08-17

- No notable changes.

- Released on: 2026-08-17

- fix: clear renderer cache on startup to prevent stale chunk errors after content update

- fix: clear renderer cache on startup to prevent stale chunk errors after content update

## v0.1.38

- feat: rearrange sidebar nav — sales flow first, then purchases, stock, money

## v0.1.37

- fix: simplify installer.nsh — NSIS already handles in-place updates via registry

## v0.1.36

- fix: remove invalid installMode option, perMachine:false already means per-user

## v0.1.35

- fix: use guard in customInit per NSIS docs

## v0.1.34

- feat: in-place installer updates — detect existing install, skip reinstall

## v0.1.33

- fix: clear stale content cache after shell update so new frontend loads

## v0.1.32

- fix: clear renderer cache before relaunch after content update

## v0.1.31

- fix: exclude version-bump commit from manifest type detection

## v0.1.30

- feat: add 10 new themes (midnight, lavender, coral, sage, copper, nordic, cherry, carbon, slate, amber)

## v0.1.29

- fix: fetch full history in build job so manifest type detection works

## v0.1.28

- fix: detect manifest type when HEAD is exactly at a tag

## v0.1.27

- feat: content updates via typed manifest, applied from Settings
- revert: remove content-update approval flow, keep installer-based updates

## v0.1.26

- fix: clear renderer cache after content update to avoid stale chunk errors

## v0.1.25

- feat: always enable devtools/reload in the app

## v0.1.24

- feat: allow devtools in packaged app when launched with --dev

## v0.1.23

- fix: backend crash after content update (better-sqlite3 not found)
- feat: render release notes as formatted markdown in update panel
- ci: stop regenerating changelog in build job; keep curated notes

## v0.1.22

- fix: installer download 404 due to space in productName artifact name
- fix: changelog release notes showed 'No notable changes' on every release

## v0.1.21

- feat: re-enable devtools in dev mode via View menu + shortcuts

## v0.1.20

- feat: content update approval via ActionNotification (update now/later)

## v0.1.19

- fix: pin got to ^11 and sync desktop lockfile

## v0.1.18

- feat: content self-update for backend/frontend without reinstall

## v0.1.17

- feat: show Windows-only update notice in desktop app settings

## v0.1.16

- fix: restrict OTA updates to Windows platform
- feat: enable OTA update checks in dev/unpacked builds

## v0.1.15

- feat: polish NSIS installer branding + fix publish repo
- refactor: remove standalone updater, polish About window update UI

## v0.1.14

- ci: drop obsolete crash-report token injection from release
- feat: help docs page, onboarding polish, crash-report feedback & desktop branding
- refactor: single production build (production/) + first-boot-only catalog seeds
- feat: onboarding setup (store, admin, banks) + always-on catalog seeds
- fix: use bsdtar to zip unpacked build (PowerShell glob broke on spaces)
- fix: don't auto-publish during electron-builder (no GH_TOKEN in CI)
- fix: API base fell back to /undefined in CI/packaged builds
- feat: standalone updater app + no-install (unpacked) Windows test build
- chore: add scripts/build-win.sh for fast Windows test builds (no release)

## v0.1.13

- fix: frontend proxies to the packaged backend port

## v0.1.12

- feat: stamp app version in the startup log line

## v0.1.11

- fix: standalone frontend + backend bundle in packaged app

## v0.1.10

- feat: granular startup status

## v0.1.9

- fix: load better-sqlite3 from a plain native/ folder via NODE_PATH

## v0.1.8

- fix: ship better-sqlite3 native module in the installer

## v0.1.7

- fix: first-run database setup in packaged app

## v0.1.6

- feat: copyable error window

## v0.1.5

- feat: silent background crash reporting

## v0.1.4

- feat: inject crash-report token at build time from GitHub secret

## v0.1.3

- feat: send crash reports to GitHub Issues

## v0.1.2

- feat: loading screen during desktop startup

## v0.1.1

- feat: auto changelog + crash logging for desktop app

## v0.1.0

- self-contained backend bundle (esbuild) + standalone frontend; slimmer installer
- thermal printing with per-document print defaults
- offline POS queue
- purchase orders
- backup/restore UI
- Z-report + cash session reconciliation
- money ledger, Windows desktop app, tests, CI & auto-releases
- POS/reservations/dashboard overhaul and production hardening
- complete POS system overhaul — print studio, reports hub, settings, auth upgrades
- phase 1 backend endpoints, frontend pages, UI components, and schema updates
- initial project scaffold
