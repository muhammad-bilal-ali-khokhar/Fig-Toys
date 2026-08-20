# Release Notes

Human-written, user-facing descriptions of what actually changed in each
release. The top section is the one being worked on; when a release is cut the
workflow uses it (the section above the next `## v` heading) as the GitHub
Release body.

## Unreleased

- **Online activation now ships with the app** — the license redemption URL is baked into the desktop app, so entering a 10-digit activation code activates online on every install instead of showing "Online activation is not configured".
- **Structured backend logging** — the API now logs every request (method, URL, status, duration, user) and every unhandled error with its stack, as structured JSON lines, so issues are far easier to debug and report. Logs go to the desktop app's existing log file (captured silently in the packaged app) and to a local `logs/fig-backend.log`. The detail level can be tuned with `LOG_LEVEL` (debug | info | warn | error).
- **Silent runtime event log across the whole app** — the desktop app, the frontend and the API now feed a single background log of runtime events: frontend uncaught errors and failed API calls, plus backend and desktop lifecycle messages, are recorded quietly so problems can be diagnosed and reported without asking the shop for details. In the desktop app these also flow into the existing log viewer, and a copy is kept in the database for deeper analysis. All log files now live in a `logs/` folder.

## v0.1.55

- **Faster frontend/backend updates** — instead of re-downloading the whole app for every change, the desktop app now also checks for smaller, separate **frontend** and **backend** updates and downloads only what changed, then applies it on the next launch. Settings → Update shows three rows — App, Frontend, Backend — each with its version, a check, and a download/apply control, plus an "Update all now" button. Frontend/backend fixes arrive as a fraction of the installer size.
- **Update panel in Settings** — the desktop app now has a dedicated **Update** tab (Settings → Update) that shows your current version, checks for a newer release, downloads it with a live progress bar, and lets you install & restart or read what's new. It appears only in the desktop app.
- **Desktop app now updates itself automatically** — installed builds silently check for a newer version on startup and download it in the background, then prompt you to restart and apply it. You can also trigger the same from Settings → Update.

## v0.1.54

- **Theme now saved in the database** — your app theme is stored on the
  company profile (in the database) instead of only on this device, so the
  chosen colour style follows every terminal and every user automatically.
  When you pick a theme, it's saved to the shop and the whole app updates.
- **24 new app themes** — the theme picker grew from 30 to 54 color schemes:
  **Plum**, **Seafoam**, **Tangerine**, **Wine**, **Petrol**, **Olive**, **Mocha**,
  **Sky**, **Grape**, **Cobalt**, **Brick**, **Denim**, **Peach**, **Indigo**,
  **Avocado**, **Sapphire**, **Tulip**, **Honey**, **Moss**, **Storm**, **Fuchsia**,
  **Rust**, **Jade**, and **Orchid**. Each restyles buttons, highlights, and panels.
  Pick one from Settings → Appearance.
- **License activation no longer rejected as forged** — the desktop app was
  bundling a stale public key, so every signed license key was rejected with
  "This license key has been altered or forged." The desktop bundle now ships
  the matching public key, so entering a 10-digit activation code works again.
  Restart the desktop app to pick this up.
- **Online license activation fixed on desktop** — the desktop app now passes
  the license redemption URL to its built-in backend, so entering a 10-digit
  activation code activates online instead of showing "Online activation is not
  configured". Restart the desktop app to pick this up.
- **Print buttons for every report** — the Sales list and Sale returns reports
  now also have a **Print** button, so all reports print: Sales report, Purchases
  report, Profit report, Expenses report, Payables, Receivables, Purchase list,
  Purchase returns, Sales list, and Sale returns.
- **Reports now print in any size** — in Print Studio, every report layout now
  supports all three formats: **58mm thermal**, **80mm thermal**, and **A4**.
  Pick the format from the selector and the report re-renders to fit — wide
  tables on A4, compact stacked rows on thermal rolls. The report-page quick
  Print buttons still print A4.
- **Print buttons for all main reports** — every report screen now has a
  **Print** button: Sales report, Purchases report, Profit report, Expenses
  report, Payables, Receivables, Purchase list, and Purchase returns. Each opens
  the browser print dialog with a clean, branded A4 layout (your store name,
  report title, and date range at the top, with totals and a footer). List
  reports print every matching entry in the selected period.
- **Card settlement can't overshoot the pending amount** — in Money, "settle card"
  now refuses to record more than the card money that is actually pending (sales
  by card minus card refunds minus what's already been settled). Previously you
  could settle any amount, even with nothing pending, which inflated the bank
  balance. Now the app shows the exact pending amount and stops you from settling
  more than it.
- **Stronger protection against guessing your PIN** — login now blocks repeated
  failed attempts with escalating timeouts that get longer the more guesses are
  made (15s, then longer each time, capping at an hour). Blocks are remembered
  in the database, so they survive a server restart and apply across all
  devices. When it looks like someone is trying many PINs against an account, a
  "brute-force suspected" security alert is recorded in the audit log so an
  admin can review it. A successful login clears the counter.
- **Bank accounts capped at 5 during setup** — during onboarding you can now add
  up to 5 bank accounts; the "Add" button disables once you hit the limit. You
  can still add as many as you like later from Settings.
- **Bank accounts now added in a popup window** — on the setup Bank accounts
  step, tapping "Add bank account" opens a small window where you fill in the
  bank name, account name, title, account number, and IBAN, then save. Each new
  "Add" opens a fresh window, and saved accounts appear as a tidy list you can
  edit or remove. This replaces the old inline forms.
- **Onboarding redesigned** — the setup wizard now uses a cleaner two-panel
  layout: a brand sidebar on the left (with your logo, app name, headline, and a
  clear list of the six steps so you always know where you are) and the form on
  the right. On phones the sidebar collapses to a slim top bar with progress
  dots. Step numbering, buttons, and the whole setup flow work exactly as before.
- **Server now sets up the database automatically on startup** — when you run
  the API (dev or production), it creates the database file if it's missing and
  applies all pending schema migrations itself. No more manual migration step:
  just start the server and it's ready to use.
- **Contacts (customers) code cleanup (no behavior change)** — moved the contacts
  screen's API calls into a dedicated `lib/services/contacts.ts` layer, extracted
  its state and CRUD logic into a `use-contacts` hook, and split the big table
  into its own `contacts-table` component. Listing, searching, filtering, adding,
  editing, deleting, and CSV import/export all work exactly as before, but the
  page is now much easier to maintain.
- **Dashboard code cleanup (no behavior change)** — split the single-file
  dashboard into a structured `components/dashboard/` folder: shared chart and
  card primitives, activity-formatting helpers, the KPI widgets, and one
  component per dashboard widget under `widgets/`. The dashboard layout and every
  widget render exactly as before, but the page is now much easier to maintain.
- **Shared payment & stock helpers (no behavior change)** — payment processing
  (recording payments, moving credit/cash/bank balances) is now a single shared
  helper used by sales, purchases, and every return flow, instead of being
  copied across four nearly identical return functions. Stock movements and unit
  status changes were consolidated the same way, and the "how much is in stock"
  calculation now lives in one place. Existing behaviour is unchanged.
- **Onboarding code cleanup (no behavior change)** — split the single-file setup
  wizard into a structured `components/onboarding/` folder (one component per
  step: license, store, settings, banks, admin, done) plus a dedicated
  `lib/services/onboarding.ts` API layer. The setup flow looks and works exactly
  as before, but is now easier to maintain.
- **Login code cleanup (no behavior change)** — split the single-file sign-in
  screen into a structured `components/login/` folder (shell, form, and a
  `use-login` state hook) and moved the auth API calls into a dedicated
  `lib/services/auth.ts` layer. Signing in, the remembered-users list, and the
  PIN entry all work exactly as before, but the code is now easier to maintain.

## v0.1.53

- **Human-written release descriptions** — every release now ships with a
  clear, user-facing description instead of a raw dump of commit messages. The
  download page at fig.myko.pk shows these notes under the latest version and
  in the version history, and older releases (v0.1.47 and up) were backfilled
  with their descriptions too.

## v0.1.51

- **Versioned download folders** — each release is now stored in its own
  `v0.1.XX/` folder in the R2 bucket, and the site keeps the last 5 versions
  with a working download link for each.
- **Fixed download button** — it was stuck on the placeholder link and missing
  the version metadata; the site now loads release data reliably so "Download
  for Windows" grabs the correct installer.
- **Reliable release data on the site** — the download page reads version info
  from the bucket without being blocked (CORS + script loading fixes), so the
  version number, file size, release date, and version history all show
  correctly.

## v0.1.50

- **Public download site** — a new landing page at fig.myko.pk that fetches
  the latest installer from the CDN, with the new Fig icon, dark mode, and a
  flat modern design.
- **Hosted installers on Cloudflare R2** — releases now auto-upload the
  Windows installer and auto-update files to the public R2 bucket, so the app
  and installer are downloadable from the web.

## v0.1.49

- **Online license activation** — customers get a 10-digit activation code
  that is redeemed online for a signed license key; activation, minting, and
  verification are handled by a cloud backend with admin-only endpoints.
- **Global search** — find phones, customers, and records from anywhere in the
  app.
- **Print overhaul + reservations/settings updates** — cleaner receipts and
  updated reservations and settings flows.

## v0.1.48

- **License activation with device locking** — the app now locks to the
  machine it is activated on and shows a dedicated activation screen on first
  run.

## v0.1.47

- **Installer update prompt + rebrand to Fig POS** — smoother in-app update
  notices, and the product is now called Fig POS with new splash images.
- **Category hierarchy + POS discount refactor** — nested categories and a
  cleaner discount flow at checkout.