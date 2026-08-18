# Fig POS

**The complete point of sale for new & used mobile phone shops.**

Fig POS is a unified point-of-sale system built for Pakistani mobile phone shops around one simple idea: **everything is a contact, every phone is a tracked unit.** Buy new or used phones from vendors, walk-ins, and customers — then sell them to anyone, tracking each physical phone by IMEI with its condition, source, and full history. Every sale, purchase, and return feeds a customizable analytics dashboard automatically.

> Prices are shown in PKR (Rs). Built for the Pakistani market — PTA status, SIM-locked, and IMEI tracking included.

---

## Highlights

- **Unified Contacts** — one record for customers *and* vendors. A walk-in who sells you a used phone and buys a new one is one contact, with a single ledger and running balance.
- **Unit-level IMEI tracking** — each physical phone is a `Unit` with IMEI, condition (NEW/USED), PTA status, and a full source → status history. Trace any IMEI from the day it came in to the day it sold.
- **NEW vs USED separation** — separate buy flows, inventory views, POS tabs, and report breakdowns — while staying one unified data model.
- **One `Transaction` model** — purchases, sales, and returns all live in one place. No duplicate systems.
- **Fast cashier POS** — scan, tap, done. Search by name/SKU/IMEI, pick the exact unit, split the payment, print a receipt.
- **Credit & installments** — buy-now-pay-later with per-contact credit accounts, limits, due dates, and collections.
- **Bank accounts & split payments** — pre-registered shop accounts as tap choices; split a single total across cash, card, multiple bank accounts, and credit.
- **Customizable analytics dashboard** — add, remove, and rearrange widgets per user, with per-user layouts.
- **Reservations & consignment** — reserve units, hold deposits, and return consigned stock.
- **Purchase orders** — record an order, receive it later, support partial deliveries.
- **Vouchers & expenses** — track voucher payments and shop expenses against cash.
- **Roles & permissions** — Admin / Manager / Cashier with full audit logging; cost/profit hidden from Cashiers.
- **Print Studio** — thermal 58/80mm receipts, A5/A4 invoices, purchase slips, and credit statements with per-use-case layouts.

---

## Feature List

### Dashboard & Analytics
- KPI cards: today's sales, net profit, units sold, units in stock, stock value, returns, credit, expenses, net cash.
- Charts: sales trend, payments by method, top products, new vs used sold, top sellers, phones vs accessories, stock PTA status, low stock.
- Date-range filter (Today / This week / This month / Custom).
- **Customizable layout** — add/remove/rearrange widgets, saved per user.
- Recent activity feed and recent transactions.

### Contacts (Unified Customers & Vendors)
- One record per party with type: **Walk-in / Customer / Vendor / Both** — upgradeable in place, never duplicated.
- Name, phone, email, address, notes, credit limit.
- Full contact ledger: everything bought *from* and sold *to* them.
- Running balance and credit account (limit, balance, installments, due dates).
- Deduplication warning on duplicate phone numbers.
- Contacts report with balances and statements.

### Products & Catalog
- Catalog: brand, model, storage, color, category.
- Variant = model + storage + color; new and used are separate categories.
- Sell price, cost price, and price history.
- Accessories category (covers, chargers, earbuds) — quantity-based, no IMEI.
- Low-stock threshold per product.
- Manageable categories, brands, and colors (add/rename/deactivate).

### Inventory (Unit-Level, IMEI-Based)
- Each phone = a **Unit**: unique IMEI, condition (NEW/USED), status (In Stock / Reserved / Sold / Returned / Damaged / Written off), and source.
- Used phones carry a condition grade (A/B/C/D).
- PTA status (PTA / Non-PTA / SIM locked).
- Cost price and acquisition date; linked transaction + source contact.
- Separate NEW vs USED inventory views with stock counts and valuation.
- Stock valuation and low-stock alerts; IMEI history lookup.

### Purchases (Buying)
- **Buy New** from vendors: pick product, enter quantities + IMEIs + unit costs.
- **Buy Used** quick flow: walk-in trade-in, condition grade, negotiated price.
- Purchase documents with items, totals, and payments.
- Payments to seller via cash, card, bank, or credit against their account.
- **Purchase returns** — send faulty units back and refund.
- **Purchase orders** — order now, receive later, partial delivery.

### Sales (Selling)
- Fast POS cart: search by name/SKU/IMEI, tap to add; pick a specific unit by IMEI.
- Accessories as quantity line items.
- **Walk-in quick-create** — the sale screen creates a contact on the spot and reuses it next time.
- Line-level and order-level discounts; price override gated by permission.
- **Multi-payment split** — one total paid in parts across cash, card, bank accounts, and credit, with change due calculated.
- **On credit** — track balance remaining and optional installment plans.
- Print-ready, thermal-80mm-friendly receipt with IMEI, brand, and condition.
- **Sale returns / refunds** — units return to stock as USED unless unopened.

### Credit & Installments
- Per-contact credit limit and running balance.
- Partial-credit handling (e.g. Rs 1,000 bill → Rs 500 now + Rs 500 on credit).
- Installment plans: down payment + N installments with due dates.
- Overdue list with days-past-due; collections with receipts.

### Reservations & Consignment
- Reserve units for customers with optional deposits.
- Hold consignment stock and return it when needed.

### Vouchers & Expenses
- Issue, update, and reverse vouchers.
- Track shop expenses and see them against cash on the dashboard.

### Money & Bank
- Pre-registered shop bank accounts (name, bank, account number, IBAN, holder) used as tap-choices in the payment sheet.
- Split a payment across two bank accounts.
- Payments summary grouped by method and bank account.

### Users, Roles & Permissions
- Simple login — username + 4-digit PIN only, JWT session.
- **Preregistered users only** — no signup, no OAuth.
- Roles: **Admin** (everything), **Manager** (sales, purchases, inventory, reports), **Cashier** (POS only — no cost/price visibility, no reports).
- Fine-grained permissions: view costs, override price, void/refund, delete, manage users, view reports, manage inventory, view money.
- **Audit log** — every sale, purchase, void, refund, adjustment, and user change.

### Reports
- Sales report (by day/week/month, cashier, condition).
- Profit report (revenue − cost, margin %, by brand/model/condition).
- Purchases report, top sellers / slow movers.
- Stock valuation (NEW vs USED) and stock report.
- Contact statements, credit & overdue report.
- Payments summary (cash/card/bank split, grouped by bank account).
- Money & Bank report, Expenses report.

### Print Studio & Company Profile
- **Company profile**: store name, address, phone, email, logo upload, receipt footer, currency, tax rate.
- Multiple print formats, each with its own layout:
  - **Thermal 58/80mm receipt** — compact, for quick POS sales.
  - **A5/A4 invoice** — full letterhead + logo + itemized table.
  - **Purchase slip** — what you paid and the IMEI.
  - **Credit statement** — per-contact outstanding balance + payment history.
- Direct printing to thermal printers and PDF export.

### Settings
- Company profile, tax rate, currency, receipt footer.
- Bank account management, default margins.
- Print settings and default print format per use case.
- Backup & restore.

---

## Stack

**Separate backend + frontend:**

- **Backend**: Node.js + Express (REST API) + TypeScript + Prisma + PostgreSQL (SQLite in dev)
- **Frontend**: Next.js (App Router) + TypeScript + Tailwind CSS + shadcn/ui
- **Desktop**: Electron wrapper with direct thermal printing
- **Auth**: username + 4-digit PIN → JWT (preregistered users only). A fresh install shows an **onboarding** screen to set up the store profile and first admin.
- **Validation**: Zod · **Charts**: Recharts

---

## Getting Started

### Prerequisites
- Node.js 18+
- A package manager (npm)

### Install & run

```bash
# Backend (REST API + Prisma + SQLite in dev)
cd backend
npm install
npx prisma migrate dev
npm run dev

# Frontend (Next.js — live updates)
cd frontend
npm install
npm run dev
```

The frontend proxies `/api` to the backend, so no env config is needed for local development.

### Verify changes

```bash
cd frontend && npx tsc --noEmit
```

> ⚠️ Never run `npm run build` while the dev server is running — use `npx tsc --noEmit` instead.

---

## Project Structure

```
backend/     Express + TypeScript + Prisma REST API
  endpoints/   one folder per endpoint (routes, handlers, service, schemas)
  core/        shared infrastructure
  prisma/      schema + migrations
frontend/    Next.js (App Router) + TypeScript + Tailwind + shadcn/ui
  app/         pages (App Router)
  components/  UI components
  lib/         API client, constants, money utils
desktop/     Electron wrapper for direct thermal printing
docs/        PRD, data model, architecture, roadmap
```

---

## Documentation

| Doc | Contents |
|---|---|
| [`docs/PRD.md`](docs/PRD.md) | Product requirements — full feature lists, user stories, priorities |
| [`docs/data-model.md`](docs/data-model.md) | Database design — Prisma schema plan |
| [`docs/architecture.md`](docs/architecture.md) | Stack, project structure, page map, component library, permissions |
| [`docs/roadmap.md`](docs/roadmap.md) | Build milestones |

---

## About

**Fig POS** is designed by **Wavlon Studio** and made by **MYKO Pvt Ltd**.

---

## License

© Wavlon Studio / MYKO Pvt Ltd. All rights reserved.
