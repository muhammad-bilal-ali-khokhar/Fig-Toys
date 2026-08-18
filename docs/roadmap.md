# Fig Mobile POS — Roadmap

## Phase 0 — Foundation
- [x] Docs: PRD, data model, architecture, roadmap
- [x] **Backend**: scaffold Express + TypeScript + Prisma (SQLite), migrations
- [x] **Backend**: `schema.prisma` from `docs/data-model.md`, seed with **preregistered users** (`arslan`/`saima`/`ali`)
- [x] **Backend**: JWT auth (username + PIN), permission guard middleware, error handler
- [x] **Frontend**: scaffold Next.js + Tailwind + shadcn/ui, `apiClient` (fetch + token), login page wired to `/api/auth/login`
- [ ] **Frontend**: AppShell layout (sidebar/topbar), protected routes → redirect to `/login`

## Phase 1 — Core POS (v1 must-have)
- [x] **Backend**: products, units, contacts, transactions, payments endpoints
- [x] **Frontend**: Products CRUD + price history
- [x] **Frontend**: Units + IMEI validation, condition/status badges, unit picker
- [x] **Frontend**: **Sale flow**: search → cart → NEW/USED unit picker → contact → payment → receipt
- [x] **Frontend**: **Purchase flow**: Buy New (vendor, multi-IMEI) + Buy Used (walk-in, grade)
- [x] **Frontend**: Unified Contacts with dedupe warning
- [ ] Returns (sale + purchase), stock movements log

## Phase 2 — Money & Credit
- [x] Bank accounts: register shop accounts, tap-choice in payment sheet
- [x] Multi-payment split (cash/card/bank-account/credit) + change calculation
- [x] Partial credit: credit portion only goes to balance; remaining-due tracking
- [ ] Credit accounts, installments, due dates, collect payments, overdue list *(collections + aging done; installments/due dates pending)*
- [x] Expenses
- [x] Contact ledger with running balance (reports → Ledger)
- [x] **Cash vouchers**: CRV/CPV creation, modify, reverse (void with audit trail) — `Voucher` model + `/api/voucher`
- [x] **Cash reconciliation / Z-report**: `CashSession` open/close + `/api/report/z`

## Phase 3 — Analytics & Reports
- [x] Report hub (`/reports`): sales, purchases, profit (by brand/model/condition), expenses, stock valuation, payments/cash flow, receivables, payables, contact ledgers — `/api/report`
- [x] **Customizable dashboard**: widget gallery, drag/drop layout, saved per user
- [x] Export (PDF) via Print Studio; CSV import/export on catalog/contacts/units

## Phase 4 — Hardening & Polish
- [x] Audit log viewer + admin screens
- [x] Company profile: logo upload, footer, currency, tax
- [x] **Print layouts**: per-document print settings (`print-setting`) — 58mm/80mm/A4 receipt, invoice, purchase slip, credit statement formats; Print Studio + direct print use the matching setting (`/api/print-setting`)
- [x] **Print formats**: per-document thermal/A4 defaults + optional WebUSB ESC/POS direct thermal print
- [x] **Backup / restore** in Settings (admin-only)
- [x] **Automatic backups**: `npm run backup` script + optional on-start/scheduled backups with retention (`AUTO_BACKUP_ON_START`, `BACKUP_INTERVAL_HOURS`, `BACKUP_RETENTION`)
- [x] **Seed PIN security**: seed reads PINs from `SEED_PIN_*` env or generates random ones (never 1111/2222/3333) and never overwrites an existing user's PIN; startup weak-PIN check warns if any user still uses a trivial PIN
- [x] **CI**: GitHub Actions runs backend tests + typecheck and frontend tests + typecheck + `next build`
- [x] **Frontend tests**: vitest + unit tests for money/date/roles/permission logic
- [x] **Offline POS queue** (local write queue flushed on reconnect)
- [x] **Purchase orders** (order → partial/complete receive into stock)
- [ ] Search perf (indexes, debounce, pagination)
- [ ] Bulk import/export catalog (partial: CSV import/export exists)
- [x] **Windows desktop app + auto-releases** — Electron shell (`desktop/`): bundles the production backend + frontend, runs fully offline in Local mode (or opens a hosted URL). One-click **Release** workflow (`.github/workflows/release.yml`) bumps the version, builds the NSIS installer on a Windows runner, and publishes the `.exe` (+ `latest.yml` + `.blockmap` for OTA self-updates) to a GitHub Release; native `better-sqlite3` rebuilt for Windows+Electron. Installer detects an existing install and asks before updating.

## Phase 5 — Later
- [ ] Offline queue for POS
- [ ] Layaway / holds / quotes
- [ ] SMS/WhatsApp reminders
- [ ] Tax report, Z-report, cash register reconciliation
- [ ] Accessory expiry tracking

---

## Milestone target
**Phase 1 + 2 + 3** = usable v1 for a real phone shop (sell, buy, track, analyze).
