# Fig Mobile POS — Architecture

## 1. Tech Stack (Separate Backend + Frontend)

| Layer | Choice |
|---|---|
| **Backend** | **Node.js + Express** (REST API) + TypeScript |
| **Frontend** | **Next.js (App Router)** + TypeScript (SPA-style, talks to API) |
| **ORM** | **Prisma** |
| **DB** | **SQLite** (embedded in Local mode; `backend/data/fig.db` in dev) — Postgres via Prisma for Remote mode |
| **Auth** | **Simple JWT login** — preregistered users only (**username + 4-digit PIN**). No OAuth, no signup. |
| **Validation** | Zod |
| **Styling / UI** | Tailwind CSS + shadcn/ui |
| **Charts** | Recharts |
| **Receipts** | Browser print with per-format templates (80mm / A4 / slips) |

### Why separate?
- Backend is a pure API — reusable, testable, can run independently.
- Frontend is only UI — swapable, no DB access, no business logic.
- Clear contract between the two (REST endpoints + JSON) → both can be built in parallel.

> **Deployment shape (decided):** **dual-mode desktop app.** Only the **frontend** ships as the desktop app (Electron shell over a static Next.js export). The backend has two runtime-selectable modes — **Local**: the app bundles the Express API + SQLite and runs them on the same machine (fully offline, single terminal); **Remote**: the app is a thin shell pointing at a hosted backend URL (multi-terminal). The switch is a runtime setting, not a rebuild — same frontend, same API contract, no schema changes.

## 2. Project Structure (monorepo)

```
fig-mobile-pos/
├── backend/                      # Express API (own package.json, own Prisma)
│   ├── endpoints/                # ONE FOLDER PER ENDPOINT (mirrors the URL)
│   │   ├── auth/                 #   /api/auth  → routes.ts, handlers.ts,
│   │   │                         #                 service.ts, schemas.ts
│   │   ├── user/                 #   /api/user (admin: users & roles)
│   │   ├── contact/  product/    #   /api/contact, /api/product
│   │   ├── unit/     transaction/#   /api/unit (IMEI/inventory), /api/transaction
│   │   │                         #   (purchases, sales & returns)
│   │   ├── payment/ bank-account/#   /api/payment, /api/bank-account
│   │   ├── report/  dashboard/   #   /api/report, /api/dashboard
│   │   ├── settings/             #   /api/settings (company profile)
│   │   └── ...                   #   brand, category, color, inventory,
│   │                             #   reservation, voucher, expense, print-setting
│   ├── core/                     # shared infra (not per-endpoint)
│   │   ├── config/               # env, constants
│   │   ├── middleware/           # auth (JWT verify), error handler, zod validate
│   │   └── lib/                  # prisma client, jwt, permissions, audit
│   ├── prisma/
│   │   ├── schema.prisma         # data model (docs/data-model.md)
│   │   ├── migrations/
│   │   └── seed.ts               # preregistered users + demo store/products/units
│   └── server.ts                 # mounts every endpoint router
│
├── frontend/                     # Next.js app (no DB, no business logic)
│   ├── app/
│   │   ├── login/                # simple login page
│   │   ├── (app)/                # authed pages (layout w/ sidebar)
│   │   │   ├── dashboard/  pos/  purchases/  inventory/  products/
│   │   │   ├── contacts/  reports/  users/  bank-accounts/  settings/  logs/
│   │   ├── layout.tsx  page.tsx
│   ├── components/               # ui/, layout/, pos/, payments/, printing/,
│   │                             #   inventory/, contacts/, dashboard/, reports/,
│   │                             #   company/, shared/
│   ├── lib/                      # apiClient (fetch wrapper + token), format, auth-store
│   └── package.json
│
└── docs/                         # this documentation set
```

### Frontend ↔ Backend contract
- Frontend never touches the DB. All data via `backend` REST API.
- `frontend/lib/apiClient.ts` — thin wrapper over `fetch` that attaches the JWT (`Authorization: Bearer`) and handles 401 → redirect to `/login`.
- API responses: `{ data: ... }` on success, `{ error: { message, code } }` on failure.

## 3. Authentication (simple, preregistered users only)

- **No registration UI, no OAuth, no social login.**
- Users are created by the Admin (or seeded) in the backend. They log in with **username + 4-digit PIN**.
- `POST /api/auth/login` → validates against `User` table → returns **JWT** (contains `userId`, `username`, `role`).
- PINs hashed (bcrypt) via `BCRYPT_ROUNDS`; JWT expiry via `JWT_EXPIRES_IN`.
- Frontend stores the token + user (localStorage) and sends the token with every request.
- Middleware guards every route except `/auth/login`.
- Demo/seed users: `arslan`/1111 (ADMIN), `saima`/2222 (MANAGER), `ali`/3333 (CASHIER).

## 4. API Routes (backend)

| Method & Path | Endpoint folder | Purpose |
|---|---|---|
| `POST /api/auth/login` | `endpoints/auth/` | Login (username+PIN) → JWT |
| `POST /api/auth/login` | `endpoints/auth/` | Login (username+PIN) → JWT |
| `GET/POST /api/contact` · `/api/contact/:id` · `/ledger` · `/credit` | `endpoints/contact/` | Unified contacts, ledger, credit, collect |
| `GET/POST /api/product` · `/api/product/import` · `/search` | `endpoints/product/` | Catalog CRUD + CSV bulk import (dup-safe) + debounced POS search (name/SKU/IMEI) |
| `GET/POST /api/category` · `PUT/DELETE /api/category/:id` | `endpoints/category/` | Product categories (add/rename/deactivate, hierarchy) |
| `GET/POST /api/brand` · `PUT/DELETE /api/brand/:id` | `endpoints/brand/` | Product brands (add/rename/deactivate) |
| `GET/POST /api/color` · `PUT/DELETE /api/color/:id` | `endpoints/color/` | Product colors (add/rename/deactivate) |
| `GET/POST /api/city` | `endpoints/city/` | Cities (seeded lookup) |
| `GET/POST /api/unit` · `GET /api/unit/imei/:imei` · `POST /api/unit/adjust` · `POST /api/unit/import` | `endpoints/unit/` | Units, IMEI trace, stock adjustment, CSV import |
| `GET /api/transaction` · `POST /sale` · `POST /purchase` · `/sale/returns` · `/purchase/returns` · `/returns/:id/void` | `endpoints/transaction/` | Sales, purchases and returns in one model |
| `GET/POST /api/payment/collect` | `endpoints/payment/` | Credit collections |
| `GET/POST /api/bank-account` | `endpoints/bank-account/` | Shop bank accounts |
| `GET/POST /api/print-setting` | `endpoints/print-setting/` | Per-document print format settings |
| `GET /api/report/*` | `endpoints/report/` | Sales, profit, stock valuation, statements, payments-by-account, Z-report |
| `GET /api/dashboard` + widgets | `endpoints/dashboard/` | Analytics data + saved layouts |
| `GET/POST /api/inventory` | `endpoints/inventory/` | Inventory lists + filters (NEW/USED, status) |
| `GET/POST /api/reservation` · `/api/reservation/:id/...` | `endpoints/reservation/` | Reservations (hold, convert, cancel) |
| `GET/POST /api/user` · `PUT /api/user/:id` | `endpoints/user/` | Users & roles (admin) |
| `POST /api/setup` | `endpoints/setup/` | Onboarding — store profile + first admin |
| `GET/PUT /api/settings/company` · `/sound` · `/preferences` | `endpoints/settings/` | Company profile, sound, preferences |
| `GET/POST /api/voucher` · `/voucher/:id/reverse` | `endpoints/voucher/` | Cash vouchers (CRV/CPV) + reversal |
| `GET/POST /api/expense` | `endpoints/expense/` | Expenses with categories + contact linking |
| `GET /api/audit` · `/meta` | `endpoints/audit/` | Audit log (filter + paginate) |
| `GET/POST /api/cash-session` | `endpoints/cash-session/` | Cash open/close, Z-report reconciliation |
| `GET /api/backup` · `POST /api/backup/restore` | `endpoints/backup/` | SQLite backup/restore |
| `GET/POST /api/purchase-order` · `/receive` | `endpoints/purchase-order/` | Purchase orders + partial/complete receive |
| `GET /api/money` | `endpoints/money/` | Money & bank summaries |
| `POST /api/feedback` | `endpoints/feedback/` | In-app feedback / crash reports |
| `GET /api/health` | — | Readiness check (desktop Local mode) |

## 5. Page / Screen Map (frontend)

| Route | Screen | Who |
|---|---|---|
| `/login` | Simple login page | all |
| `/dashboard` | Analytics dashboard with KPIs + charts | Manager, Admin |
| `/pos` | **Point of Sale** — search, cart, payment, receipt | Cashier, Manager, Admin |
| `/purchases` | List purchases + **Buy New / Buy Used / Buy Accessory** flows (tabs) | Manager, Admin |
| `/purchase-returns` | Purchase returns (IMEI-based, partial) | Manager, Admin |
| `/sale-returns` | Sale returns (IMEI-based, refund/cash-back) | Manager, Admin |
| `/purchase-orders` | Purchase orders (order → partial/complete receive) | Manager, Admin |
| `/inventory` | All units + filters (condition/status/carrier), scan & IMEI search | Manager, Admin |
| `/products` | Catalog list + variant editing + manage categories/brands/colors | Manager, Admin |
| `/contacts` | Unified contacts list (customers + vendors + walk-ins) | All (view limited) |
| `/reservations` | Reservations (hold with advance, convert to sale, cancel) | Cashier+ |
| `/vouchers` | Cash vouchers (CRV / CPV), modify & reverse | Manager, Admin |
| `/expenses` | Expenses with categories + contact linking | Manager, Admin |
| `/reports` | Report hub (overview, sales/purchase/profit/stock/cash summaries, list screens, ledger, receivables/payables, contacts, stock, Z-report) | Manager, Admin |
| `/settings` | Company profile, preferences, financial, bank accounts, sounds, users & roles, activity log, backup, print & thermal | Admin |
| `/print` | Print studio (58/80mm/A4 templates, per-document layouts, QR targets) | Cashier+ |
| `/help` | Help & about | all |

## 6. NEW vs USED — Convenient Separation

The whole app treats new and used phones as **first-class, visibly separate** — never mixed in one cluttered list.

- **Nav + sidebar**: dedicated `Inventory › New` and `Inventory › Used` entries; `Purchases › Buy New` and `Purchases › Buy Used` entries.
- **POS unit picker**: shows NEW and USED as two clearly separated tabs/sections with their own prices; condition badge on every unit.
- **Buy flows**: two distinct screens (`Buy New` for vendor stock, `Buy Used` for walk-in/trade-ins with condition grading A/B/C/D and negotiated price).
- **Inventory views**: separate tables per condition, each with its own stock count and valuation in the header.
- **Reports & dashboard**: every report breaks down NEW vs USED (sales split, profit split, stock valuation split); dashboard has per-condition KPIs/widgets.
- **Data layer**: one `Unit.condition` enum (`NEW | USED`) keeps the schema unified — separation is a UI/UX convention, not duplicated tables.

## 7. Component Library

Built on **shadcn/ui** primitives:

- **POS**: `ProductSearch` (debounced, IMEI/SKU), `CartLine`, `PaymentSheet` (multi-method split + bank-account tap choices + change calc), `ContactQuickPick`, `ReceiptView` (80mm).
- **New/Used**: `ConditionTabs`, `ConditionBadge`, `NewUsedSection` (POS picker split), `UsedGradePicker` (A/B/C/D).
- **Payments**: `MethodTabs` (Cash / Card / Bank / Credit), `BankAccountPicker`, `AmountInput` (received + change), `PaymentSummary` (remaining due).
- **Printing**: `PrintDialog` + per-format templates — `ReceiptThermal` (80mm), `InvoiceA4` (letterhead + logo), `PurchaseSlip`, `CreditStatement`; own print CSS each; browser print + PDF.
- **Inventory**: `ImeiInput` (scanner-friendly, batch), `UnitTable`, `StatusBadge`, `UnitTimeline` (source → sale history of one IMEI).
- **Contacts**: `ContactForm` (dedupe warning on matching phone), `ContactLedger`, `BalanceCard`.
- **Dashboard**: `WidgetFrame` (drag/drop + resize), `WidgetGallery`, `DateRangePicker`, KPI/chart widgets.
- **Company**: `CompanyProfileForm` (name, address, **logo upload**, footer text, currency, tax).
- **Shared**: `Money`, `ConfirmDialog`, `EmptyState`, `SearchInput`, `Pagination`, `PrintButton`.

## 8. Permissions

The granular matrix lives in one place — `backend/core/lib/permissions.ts` (mirrored for the frontend in `frontend/lib/constants/permissions.ts`). Every resource has a per-action set (`<resource>.view/create/update/delete`) plus action keys (`product.import`, `unit.adjust`, `voucher.reverse`, `bank.setDefault`, `print.setDefault`, …). **Reads are permission-gated too** — every GET route carries a `<resource>.view` permission, and every write route carries its specific create/update/delete key.

**Permissions are stored per user in the database** (`User.permissions` JSON column, backfilled per role on migration). `requireAuth` loads the user's stored permissions fresh on every request (via `effectivePermissions`), so changes apply immediately without re-login. `requirePermission(...)` enforces against that stored list; cost/profit stripping (`report.profit`) is permission-derived too. An empty stored list falls back to the role's default set.

The login response includes the granted permission strings; the frontend mirrors them to hide UI. Admin-only user management lives at `endpoints/user/` (`GET/POST /api/user`, `PUT /api/user/:id`) gated by `user.manage` — it can edit a user's role, active flag, and full permission list.

Explicit per-role sets:

| Permission group | Cashier | Manager | Admin |
|---|:---:|:---:|:---:|
| `sale.create` · `payment.collect` · `credit.view` | ✅ | ✅ | ✅ |
| `transaction.view` · all catalog `*.view` · `contact.view` · `inventory.view` | ✅ | ✅ | ✅ |
| `voucher.view` · `expense.view` · `bank.view` | ✅ | ✅ | ✅ |
| `report.view` · `dashboard.view` | ✅ | ✅ | ✅ |
| `reservation.view` · `reservation.create` | ✅ | ✅ | ✅ |
| `settings.view` · `print.view` | ✅ | ✅ | ✅ |
| All other `*.create` · `*.update` · `*.delete` · `*.import` · `*.adjust` · `*.reverse` · `*.setDefault` | ❌ | ✅ | ✅ |
| `report.profit` (cost/profit visibility) | ❌ | ✅ | ✅ |
| `report.stock` | ❌ | ✅ | ✅ |
| `user.manage` · `audit.view` (admin-only) | ❌ | ❌ | ✅ |

`user.manage` powers the Users admin page; `audit.view` powers the Activity Log screen (`/audit` → `endpoints/audit/`, `GET /api/audit` with `action`/`entity`/`userId`/`search`/`from`/`to`/`page`/`pageSize` filters). Enforced **server-side** in route middleware; the frontend hides UI based on the same permissions returned at login.

## 9. Timezone

`CompanyProfile.timezone` (default `Asia/Karachi`) controls how reports and the dashboard bucket daily totals (`backend/core/lib/time.ts`). A sale at 00:30 PKR counts toward the PKR day (e.g. `2026-08-12`), not the UTC day. The settings page exposes the field; existing stores keep the default unless changed.

## 10. Key Flows

### Sell a phone (with NEW/USED split)
1. Cashier opens `/pos`, types model or scans IMEI.
2. Unit picker shows **NEW / USED tabs** — cashier picks a specific in-stock unit by IMEI.
3. Cart shows product + condition + chosen IMEI.
4. Contact: quick-pick or "Walk-in".
5. Payment sheet: total Rs 1,000 → Rs 300 cash, Rs 200 into **Bank Account A** (tap), Rs 500 credit (links contact's credit account); received + change shown live.
6. Backend `transactionService.createSale()`: sets units `SOLD`, writes stock movements, one `Payment` row per method (credit portion bumps `CreditAccount.balance` by its amount only), writes audit log.
7. Receipt prints (80mm default; A4 selectable): items, IMEIs, payment split per method + bank account, remaining credit due.

### Buy a used phone
1. Manager opens `/purchases/used` (clearly separate from buy-new).
2. Enters IMEI, picks product, **used grade (A/B/C/D)**, agreed price.
3. Contact: existing or **new** → `Contact` type `WALK_IN` (dedupe first).
4. Backend creates `Unit` (`USED`, source `BOUGHT_WALKIN`), `Transaction` (PURCHASE), payment to seller.

### Buy new stock
1. Manager opens `/purchases/new`.
2. Picks product variant + vendor, enters quantities + IMEIs + unit costs (bulk entry).
3. Backend creates `Unit`s (`NEW`, source `VENDOR_PURCHASE`) + PURCHASE transaction.

### Trace an IMEI
1. `/inventory/imei/:imei` → unit card (condition, cost, status, grade) + timeline of movements & transactions.

## 11. Env / Config

Backend `.env`: `DATABASE_URL` (`file:./data/fig.db`), `HOST` (`localhost`), `JWT_SECRET`, `PORT` (**4100** — 4000 is used by other dev servers), `BCRYPT_ROUNDS`.
Frontend `.env.local`: `NEXT_PUBLIC_API_URL` (e.g. `http://localhost:4100/api`) — **dev fallback only**. In the desktop app the API base is resolved at **runtime** from the app's connection settings (Local or Remote), falling back to this env var. In Local mode the frontend and API share the same host (`localhost`, not `127.0.0.1`) so the `SameSite=Lax` session cookie is sent on fetch requests.

## 12. Deploy — Desktop App (Dual Mode)

Only the **frontend** ships as the desktop app. The backend is either **bundled locally** or **hosted remotely**, selected at runtime in Settings → Connection. Both modes share one build.

### Hosted backend (Render)

For Remote mode the backend deploys as a standalone web service on **Render** (`render.yaml` at the repo root, `rootDir: backend`). It keeps the SQLite DB on a persistent disk (`/data`, `DATABASE_URL=file:/data/fig.db`), runs `prisma migrate deploy` + the idempotent seed in `preDeployCommand`, and starts with `npm start` (`tsx server.ts`). `HOST` must be `0.0.0.0`; `CORS_ORIGIN` (the frontend origin) and `JWT_SECRET` are set as Render env vars. Health check: `GET /api/health`.

> The migration history is a single fresh baseline (`prisma/migrations/20260813120000_init`) generated from the current schema. Earlier hand-written migrations were never-applied on any database and were rebased out; dev DBs are rebuilt from the baseline + `prisma:seed` (idempotent — safe to run on every deploy).

### Modes

| | **Local (offline, single terminal)** | **Remote (hosted, multi-terminal)** |
|---|---|---|
| Backend | Bundled Express API + SQLite, spawned by the app | Hosted server the app connects to |
| DB | `fig.db` in the app's user-data directory | Server's DB (SQLite or Postgres) |
| Internet | Not required | Required |
| App UI origin | Served by the embedded backend (`http://localhost:<port>`) → **same origin as API** | Static export served from the shell → **cross-origin** |
| Auth | Existing cookie (`SameSite=Lax`) unchanged | `Authorization: Bearer` token (backend reads it first) |
| Backups | Copy `fig.db` from the user-data dir (or on-demand export in Settings) | Server-side backups |

### Packaging (`desktop/`)

- `desktop/main.js` — creates the window, reads the connection setting, and in Local mode spawns the bundled backend, waiting on its health check before loading the UI. Also handles OTA self-updates (electron-updater) and auto-backups.
- `desktop/preload.js` — exposes `window.figAPI` (get/set connection settings, resolve API base, update events).
- **Frontend** is built with Next.js `output: 'standalone'` (`npm run build` then `npm run build:production`), so the app is SPA-style (fetch + `window.print()`), no SSR needed.
- **Backend** is bundled with esbuild into `production/backend` (Express API + bundled Prisma schema + native `better-sqlite3` rebuilt for Windows+Electron).
- `desktop/electron-builder.yml` copies `production/backend` + `production/frontend` into the app's `extraResources`; electron-builder `npmRebuild` handles the native module. Installer is NSIS, publishes to GitHub Releases with `latest.yml` + `.blockmap` for OTA self-updates, and prompts before updating an existing install.

### Local mode flow

1. App launches → main process resolves the writable user-data directory.
2. Spawns the bundled backend with `DATABASE_URL=file:<userData>/fig.db`, `HOST=localhost`, `PORT` from config.
3. Polls `GET /api/health` until ready, then loads `http://localhost:<port>` (frontend served by the backend itself — same origin, so cookie auth works unchanged).
4. On quit, main process shuts the backend down gracefully (Prisma disconnect → no SQLite corruption).

### Remote mode flow

1. Admin enters the hosted backend URL in Settings → Connection → Remote.
2. App skips spawning the local backend and loads the static frontend.
3. `apiClient` uses the remote base URL and attaches the JWT via `Authorization: Bearer` (backend's `getAuthToken` reads the header first, `core/lib/cookie.ts`).
4. Backend CORS must allow the app's origin (`CORS_ORIGIN`).

### Backend additions (needed for desktop)

- `GET /api/health` — readiness check the app waits on in Local mode.
- Graceful shutdown handlers (SIGTERM/SIGINT → `prisma.$disconnect`).
- `DATABASE_URL` is already env-driven — ensure the data directory is created on boot.

### Frontend additions

- `apiClient` resolves the base URL at runtime (app settings → `NEXT_PUBLIC_API_URL`) and sends the Bearer token when present.
- Settings → Connection: Local/Remote toggle, URL field, "Test connection".
- `output: 'export'` in `next.config.mjs`.
