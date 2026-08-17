# Changelog

All notable changes are documented here, based on the actual git commit history.

## v0.1.42

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
