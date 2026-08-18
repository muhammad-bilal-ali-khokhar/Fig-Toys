# Feature Audit — Frontend + POS

Audit of the Next.js frontend and backend against `docs/PRD.md` and `docs/roadmap.md`. Last updated 2026-08-16.

## Implemented since the initial audit (2026-08-13)

### POS & payments
- **Change / tender calculation** — cash mode records amount received, computes change; quick-tender buttons; `Payment.tendered`/`Payment.change` stored server-side and shown on the receipt.
- **Money cap** — `MAX_MONEY_AMOUNT` (99M) + `clampMoneyInput` on every money input; all POS/reservation math rounded to paisa via `roundMoney`.
- **Idempotency** — sales, purchases, sale/purchase returns, vouchers and expenses accept a `clientRef`; a duplicate `clientRef` returns the existing record (safe offline replay / double-submit).
- **Reservation ownership enforced server-side** — a RESERVED unit cannot be sold to a different customer.
- **Offline POS queue** — write requests are queued to localStorage when the network drops and flushed on reconnect (AppShell banner + sync-now).

### Cash reconciliation
- **Z-report / cash sessions** — `CashSession` open/close with opening float, counted cash and variance; `GET /api/report/z` computes daily cash in/out (sales, purchases, returns, vouchers, expenses) and expected closing. Frontend page `/reports/z`.

### Operations
- **Backup / restore** — `GET /api/backup` (SQLite snapshot download) + `POST /api/backup/restore`; Settings > Backup & restore (admin only).
- **Purchase orders** — `PurchaseOrder` + items; create, list, receive (partial/complete → creates a PURCHASE transaction + stock IN), cancel. Frontend `/purchase-orders`.
- **Per-document print settings** — `GET/PUT /api/print-setting` storing one setting per document type (format 58/80/a4, options, qrType); Print Studio and direct print load the matching setting. Optional WebUSB ESC/POS direct thermal print (Settings > Print & thermal).

### Correctness fixes
- Clearing a contact's credit limit to 0 now applies.
- Expense date filter is timezone-normalized (matches transactions/units).
- Purchase & sale return void is exposed in the invoice viewer (report lists).
- Removed dead code (`unit-form.tsx`, `DASHBOARD_PLACEHOLDERS`).
- Frontend money math rounded everywhere (float-drift elimination).

### Tests
- Backend integration tests (Vitest + Supertest): sale (split/credit/change/double-sell race/idempotency), purchase idempotency, returns + void, reservations (convert/cancel/conflict/ownership), vouchers, expenses, purchase orders, and financial-integrity (payments == totals). 46 tests.
- Frontend unit tests (Vitest) for money math.

## Still missing (unchanged)
- Credit installments / due dates (`CreditPayment.dueDate` exists in the schema but is not written or filtered; only one-off collections).
- Credit reminders (SMS/WhatsApp), credit-limit enforcement toggle.
- Accessory expiry tracking, supplier invoice attachment.
- Tax (FBR) report, Z-report PDF export.
- Multi-terminal remote mode + Electron desktop packaging (documented, not shipped).
- Chart-of-accounts / double-entry.
