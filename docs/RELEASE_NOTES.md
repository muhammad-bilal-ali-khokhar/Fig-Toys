## Unreleased

- **Meet your new Help centre. Modern, fast and easy to search. It matches the new dashboard style with a dark hero, quick links and a clean bento layout. Try it in Settings, Appearance, Beta. Classic stays your default.**
- **Smoother and more reliable. Downloads and settings now load without blocked connections or repeated sign in prompts. Your layout choice stays saved and updates check faster.**
- **Copy errors with one tap. When an update fails you will see a Copy error button. Tap to copy the full details and share with support on WhatsApp for faster help.**

## v0.2.1

- **Lightning fast updates are here. Your app now updates in seconds with smart downloads. You will see live download speed and a clear Installing window so you always know your PC is updating. Plus the app download is now much smaller and installs faster.**
- **Cleaner dashboard. The layout switch is now only in Settings, Appearance, Beta for a tidy header. Classic stays your default while you explore the new design. Try the modern bento dashboard built for speed.**

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
