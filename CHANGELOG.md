# Changelog

All notable changes are documented here. This file is auto-generated on every
release by `scripts/changelog.sh` (run from the CI release workflow) — do not
edit by hand.

## v0.1.18

- Released on: 2026-08-17

- feat: show Windows-only update notice in desktop app settings

## v0.1.17

- fix: restrict OTA updates to Windows platform
- feat: enable OTA update checks in dev/unpacked builds

## v0.1.16

- feat: polish NSIS installer branding + fix publish repo
- refactor: remove standalone updater, polish About window update UI

## v0.1.15

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

## v0.1.14

- fix: frontend proxies to the packaged backend port

## v0.1.13

- feat: stamp app version in the startup log line

## v0.1.12

- fix: standalone frontend + backend bundle in packaged app

## v0.1.11

- feat: granular startup status

## v0.1.10

- fix: load better-sqlite3 from a plain native/ folder via NODE_PATH

## v0.1.9

- fix: ship better-sqlite3 native module in the installer

## v0.1.8

- fix: first-run database setup in packaged app

## v0.1.7

- feat: copyable error window

## v0.1.6

- feat: silent background crash reporting

## v0.1.5

- feat: inject crash-report token at build time from GitHub secret

## v0.1.4

- feat: send crash reports to GitHub Issues

## v0.1.3

- fix: package logging.js + loading.html in the app
- feat: loading screen during desktop startup

## v0.1.2

- feat: auto changelog + crash logging for desktop app

## v0.1.1

- No notable changes.

## v0.1.0

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

