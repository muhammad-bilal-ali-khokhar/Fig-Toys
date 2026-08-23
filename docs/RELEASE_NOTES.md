## Unreleased

## v0.2.1

- **Fast differential updates + honest installing feedback — app no longer re-downloads 122 MB every time** — Searched how Chrome (courgette/bsdiff 78 KB vs 10 MB full) and VS Code/Slack do delta updates and why our in-app "Installing…" was killed. Fixed: (1) `desktop/main.js:157` now uses `electron-updater` (`desktop/package.json:9` `electron-updater@6.8.9`) with NSIS `.blockmap` differential — only changed blocks download (few MB, not full installer) via `latest.yml` at `https://download.myko.pk/latest.yml`; `scripts/publish-to-r2.mjs:168` now publishes `latest.yml` at bucket root with absolute `url:` so blockmap can be resolved, (2) `desktop/main.js:374` download progress now emits `bytesPerSecond`/`transferred`/`total` with live `% + speed` in `frontend/components/settings/update-tab.tsx:84` — no more silent 15-min wait, (3) Installing no longer shows inside the main window (which the NSIS installer kills) — `desktop/main.js:486` `installUpdate()` sets `installing:true` and hands off to the **separate** `desktop/updater.html` window via `--updater` (`desktop/main.js:1102` `runUpdater()`) so you actually see `Installing vX…` with spinner while the PC updates; `frontend/lib/electron.d.ts:4` + `frontend/lib/constants/app.ts:12` add `installing` state, (4) `frontend/scripts/prepare-production.mjs:64` prunes `typescript` (8.7 MB) + `sharp-darwin-arm64`/`sharp-libvips-darwin-arm64` (15 MB) + `sharp-wasm32` (8.6 MB) and other non-win sharp variants from the bundle — ~30 MB less bloat in every installer.
- **Remove redundant dashboard pill — single source in Settings** — `frontend/app/(app)/dashboard/page.tsx:30` pill `Classic / New · Beta` removed; layout now only via `Settings → Appearance (Beta)` `frontend/components/settings/settings-sidebar.tsx:48` / `frontend/app/(app)/settings/page.tsx:972`. Cleaner header.

## v0.2.0

- **Dashboard layout switch (Classic ↔ New Beta) — testing on dashboard only** — `frontend/lib/dashboard-layout-context.tsx:14` + `frontend/lib/constants/layouts.ts:1` add `DashboardLayoutProvider` (persisted to `localStorage fig.dashboardLayout` + `GET/PUT /api/settings/dashboard-layout` `backend/endpoints/settings/service.ts:30` `app.dashboardLayout`). `frontend/components/dashboard/layouts/classic-dashboard.tsx:40` keeps the original dashboard untouched; `frontend/components/dashboard/layouts/new-dashboard.tsx:79` is an entirely new design — dark hero header with `GlobalSearch` + `PeriodPicker`, 4 `HeroStat` cards, 12-column bento grid (`Cash flow` / `Reservations & Value` / `StockPtaWidget` left · full `SalesTrendWidget` centre · `PaymentsWidget`+`NewUsedWidget` right) plus 3-col product/category/seller rows. Toggle via pill `Classic / New · Beta` at the top of `frontend/app/(app)/dashboard/page.tsx:13` or `Settings → Appearance (Beta)` `frontend/components/settings/settings-sidebar.tsx:48` / `frontend/app/(app)/settings/page.tsx:972` — Classic stays default, New is opt-in. Full rollout to all pages coming later.

## v0.1.101

- **Separate updater window with silent auto-install** — `desktop/main.js:1080` `/318` `installUpdate()` now spawns a detached updater (`--updater` + `desktop/updater.html` / `desktop/updater-preload.js`) instead of a card inside the main process. Updater shows `Installing vX…` with spinner, runs `installer /S --force-run` hidden and relaunches the app — visible progress, zero clicks. `desktop/electron-builder.yml:9` now bundles updater files.

## v0.1.100

- **Update notes now render as formatted text with markdown** — `frontend/components/settings/update-tab.tsx:114` showed `releaseNotes` raw in a `max-h-48 overflow-auto whitespace-pre-wrap` scroll box so `**bold**`/`code` appeared literally. Now `ReleaseNotes` parses markdown (`**bold**` → bold, `` `code` `` → code badge, `-` → bullet list) in a normal flow `rounded-2xl py-3` block. `desktop/about.html:433` `setNotes()` updated similarly — no `pre-wrap`/`max-height` scroll, proper `<ul>`/`<code>` rendering.

## v0.1.99

- **Contact & Support expanded + Security & Encryption** — `frontend/lib/constants/help.ts:1` adds new `security` Help section (`frontend/app/(app)/help/page.tsx:710`) covering **Local security** (PIN + brute-force lockouts, role isolation, offline DB under `%APPDATA%`, audit log), **Online security** (TLS/HTTPS, JWT, server-side RBAC, rate-limiting) and **Encrypted Database (USB key)** (`Settings → Backup & restore → Encryption`): AES-256 at rest with key file `fig-encryption.key` on a USB you keep — required for every future migration/restore, cannot be recovered without it. Adds History timeline and updates `Contact & Support` with support hours (Mon–Sat 10am–8pm PKT), response SLAs, what's covered and quick-checks before contacting.
- **Update now shows installer window instead of silent close** — `desktop/main.js:318` `installUpdate()` previously ran `installer /S --force-run` silently with `detached` spawn, so the app quit and nothing appeared. Now spawns the installer **visible** (`spawn(installer, [], detached)`) so you see the NSIS progress wizard after the `Installing vX…` card instead of a silent background close.

## v0.1.98

- **Maintenance release** — internal housekeeping and stability improvements. No breaking changes.

## v0.1.97

- **OTA update no longer leaves app closed after restart** — `desktop/main.js:318` `installUpdate()` used `exec` without `detached` and quit after 600ms, so the silent NSIS installer was killed before it could overwrite locked files and `runAfterFinish` never fired in `/S` mode (app stayed closed on “Updating…” card). Now spawns a detached helper `.bat` that waits for Electron to exit, runs `installer /S /wait`, then `start` relaunches `app.getPath("exe")` and self-deletes. Shows error dialog if installer missing.
- **Windows controls no longer have white box behind them** — `desktop/main.js:1006` `titleBarOverlay: true` defaulted to white overlay behind min/max/close, contrasting with `#f6f5f2` window. Now `titleBarOverlay:{color:"#f6f5f2", symbolColor:"#1c1916", height:32}` blends with app background.

## v0.1.96

- **Maintenance release** — internal housekeeping and stability improvements. No breaking changes.
