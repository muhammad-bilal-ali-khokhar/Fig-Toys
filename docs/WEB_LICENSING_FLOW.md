# Fig POS Web Licensing Platform

## 1. Purpose

Fig POS has two products that work together:

- **Fig POS desktop app** - the offline-first point of sale used inside the shop.
- **Fig Web** - a separate Next.js web app for client accounts, trials, payments, license keys and admin control.

The web app is the control center. It never replaces the POS. It owns the subscription record that the POS checks.

For this phase the web app uses local mock data. The flow, screens and rules below are the contract that the real backend (Convex or Postgres API) will implement later.

## 2. Roles

| Role | Where | Can do |
|---|---|---|
| Client (shop owner) | Fig Web `/portal` | Register, see trial and expiry, pay, submit transaction ID, see license key, see blocked or expired state |
| Fig Admin | Fig Web dashboard | See every client, set price and duration per client, approve or reject payments, generate or revoke keys, block or unblock, manage default pricing and payment accounts |
| POS | Desktop app | Check license status online and offline, show paywall when expired, accept a new key, submit a payment request |

No role dots. Status is always written as a text badge.

## 3. Client lifecycle

```
Register
  -> Trial (14 days, full access)
  -> Reminder (7 days, 3 days, 1 day left)
  -> Trial expired (POS locked, paywall modal)
  -> Payment submitted (transaction ID, amount, method)
  -> Admin review
     -> Approved: license key generated, expiry extended, popup closes, POS unlocks
     -> Rejected: modal shows reason, client can submit again
  -> Active (paid until date and time)
  -> Renewal before expiry: expiry extends from the current paid-until date
  -> Expired or Blocked: POS locked until renewed or unblocked
```

### Trial rules

- Every new client starts with **14 free days** from registration time.
- The trial end is stored as an exact timestamp, not only a date.
- The web app shows the date, the time and a live day countdown.
- POS receives the same `trialEndsAt` value from `/api/license/status`.
- A new device for an existing client does not reset the trial. The first-seen time is kept by the server.

### Paid rules

- Monthly price is set by the admin, per client, with a default in Pricing.
- Duration is set in days. Default is 30 days.
- Renewal stacks: `newExpiry = max(now, currentExpiry, trialEndsAt if still in the future) + durationDays`.
- Expiry is an exact timestamp. The POS locks at that moment.
- A license key is a signed token in production. In this mock it is a readable key such as `FIG-4K7P-9X2M-QW3D`.

### Blocking

- Blocking is separate from expiry.
- A blocked client keeps its paid date but cannot use the POS.
- Blocking is immediate on the next license check.
- Admin can unblock, and the previous paid-until date is restored.
- Blocked clients see a contact-support message, not a payment button.

## 4. Payment flow

1. POS or client web portal detects that the license is expired or that the trial is about to end.
2. A modal shows:
   - amount in PKR
   - JazzCash number, Easypaisa number and bank details from Pricing
   - payment method selector
   - transaction ID field
   - optional note
3. Client sends the money manually and submits the transaction ID.
4. A `paymentRequests` record is created with status `pending`.
5. The modal switches to "Waiting for approval". It polls every few seconds.
6. Admin opens Payments, verifies the transaction, and approves or rejects.
7. On approval:
   - a license key is generated
   - `paidUntil` is extended
   - client status becomes active
   - the pending request becomes `approved`
   - the client modal closes automatically and POS unlocks
8. On rejection:
   - the request becomes `rejected`
   - client sees the reason and can submit again

## 5. Screens

### Public

| Route | Purpose |
|---|---|
| `/login` | Mock admin sign in |
| `/register` | Client self-registration, starts the 14-day trial |

### Client portal

| Route | Purpose |
|---|---|
| `/portal` | Client subscription home: plan, trial or paid status, exact end date and time, countdown, pay button, license key, blocked state |
| Paywall modal | Opened automatically when expired, or from Pay now when trial is ending |
| `/portal/payments` | Payment history and pending request status |

### Admin

| Route | Purpose |
|---|---|
| `/` | Overview: KPIs, expiring soon, pending payments, recent activity |
| `/clients` | All clients with search, filters, status, days left, price, last seen |
| `/clients/[id]` | Client profile, subscription, countdown, license key, payments, block, set plan |
| `/payments` | Pending, approved and rejected payment requests |
| `/licenses` | Issued keys, copy, revoke |
| `/pricing` | Default monthly price, trial days, duration, payment account details |
| `/settings` | Admin profile, mock data reset, integration notes |

## 6. Data model

```ts
Client {
  id, shopName, ownerName, email, phone, city
  deviceId, registeredAt, lastSeenAt
  plan: "trial" | "monthly"
  monthlyPricePkr: number
  durationDays: number
  trialEndsAt: string
  paidUntil: string | null
  blocked: boolean
  notes: string
}

PaymentRequest {
  id, clientId, amountPkr, method, txnId, note
  submittedAt, status: "pending" | "approved" | "rejected"
  reviewedAt, reviewedBy
  licenseKeyId?: string
}

LicenseKey {
  id, clientId, key, issuedAt, expiresAt
  durationDays, status: "active" | "revoked"
  paymentRequestId?: string
}

Pricing {
  defaultMonthlyPricePkr
  durationDays
  trialDays
  jazzcash, easypaisa, bankName, accountTitle, accountNumber
  supportPhone, supportEmail
}

ActivityEvent {
  id, at, actor, clientId?, kind, message
}
```

Derived status, never stored twice:

```
blocked        -> "blocked"
paidUntil > now -> "active"
trialEndsAt > now -> "trial"
otherwise      -> "expired"
```

## 7. POS integration contract

The POS already has a local license table and middleware. The web app later supplies these endpoints:

| Endpoint | Used by | Purpose |
|---|---|---|
| `POST /install/status` | POS | Register device, return trial or paid state, price, days left, pending request, block flag |
| `POST /install/request-payment` | POS | Submit transaction ID and method |
| `POST /license/redeem` | POS | Redeem a generated key |
| `POST /admin/login` | Fig Web | Admin session |
| `POST /admin/installations` | Fig Web | List clients |
| `POST /admin/plan` | Fig Web | Set price and duration for one client |
| `POST /admin/approve` | Fig Web | Approve payment, generate key, extend expiry |
| `POST /admin/reject` | Fig Web | Reject payment |
| `POST /admin/block` | Fig Web | Block or unblock a device |

The POS keeps working offline. It caches the last known license for a short window. A blocked or expired license fails closed when the cached window ends.

## 8. Edge cases

- **Two devices, one shop**: one subscription per client, device count limited by the license. A new device does not start a new trial.
- **Clock change on the POS**: expiry is compared with a server timestamp where possible. Offline mode tolerates a small drift.
- **Offline payment**: the modal explains that payment needs internet. The request is queued only after the client submits it.
- **Renewal while active**: days are added to the existing expiry, not reset from today.
- **Renewal during trial**: paid days start after the trial ends.
- **Approved while POS is closed**: the next status check applies the new key.
- **Blocked client pays**: approval automatically unblocks unless the admin keeps the block.
- **License key shared**: production keys are device bound. Mock keys are not.
- **Rejected payment**: the client can submit a new transaction ID.
- **Refund**: admin can revert an approval, which revokes the key and restores the previous expiry.

## 9. Mock implementation

The current web app is a standalone Next.js app in `web/`. It keeps all state in the browser so the full flow can be reviewed without a backend.

### Demo access

- Admin console: `/login`
- Email: `fig@dev.com`
- Password: `menahibtaogayar`
- Client portal: `/portal`
- New shop registration: `/register`

### Routes

| Route | Screen |
|---|---|
| `/` | Admin overview with shop health, revenue and activity |
| `/clients` | Searchable shop list, status filters, block and unblock |
| `/clients/[id]` | Shop detail, plan editor, key issue and revoke, timeline |
| `/payments` | Pending, approved and rejected payment review |
| `/licenses` | License key ledger with copy and revoke |
| `/pricing` | Default monthly price, trial length and payment accounts |
| `/settings` | Admin profile, demo expiry tools and reset |
| `/portal` | Client portal with trial, expiry, payment and key |
| `/portal?client=[id]` | Portal deep link used by the admin console |
| `/register` | Client self registration and 14 day trial start |
| `/login` | Admin sign in |

### Local state

- Database: `fig.web.db.v1`
- Admin session: `fig.web.admin.v1`
- Current portal shop: `fig.web.currentClient.v1`
- Seed data: 12 Pakistani mobile shops with mixed trial, active, expired and blocked states
- Reset: Settings -> Reset demo data

### Live local data

- Set `POS_ADMIN_API_URL` to the POS backend API, for example `http://localhost:47620/api`.
- In development the web app defaults to this local URL.
- The dashboard reads the real local shop, license status, expiry and payment history from `/license/admin/shop`.
- Local admin endpoints under `/license/admin/*` require an `x-license-admin` header that matches `LICENSE_LOCAL_ADMIN_TOKEN`.
- Live mode is read-only for plan and block edits, except the trial and access tools which call the local POS.
- Settings can give the local POS a 1 minute trial for testing, or restore the default 14 day trial.
- If the POS backend is unavailable, the web app falls back to demo data.

### Admin activation codes

- `/licenses` includes **Generate activation code**.
- The web app calls `/api/activation-code`, which calls the Convex `/mint` endpoint server-side.
- The code is a 10 digit activation code accepted by the POS activation screen.
- Customer name, device limit, monthly price and optional expiry are included in the code.
- The admin token is read from `LICENSE_ADMIN_TOKEN` or the local `convex/.env.local`; it is never sent to the browser.
- If the license server is not configured, the console shows a clear error.

### What the mock covers

- A new POS starts unlicensed and requires an activation code
- Admin can grant a trial with a live countdown and exact end time
- Expired shop sees the paywall and cannot submit without payment details
- Payment request with amount, method, transaction ID and note
- Admin approval stacks days on the current expiry, generates a key and unlocks the portal in another tab
- Rejection shows the reason and lets the client submit again
- Plan editor changes price and duration per shop
- Block and unblock, key revoke, manual key issue, default pricing and payment accounts
- No real money, email, SMS or signed keys

## 10. Implementation phases

1. **Mock web app (this phase)**
   - separate Next.js app
   - full admin and client UI
   - local mock data with 14-day trials
   - payment request, approval, key generation, block and unblock
   - no real backend, no real money

2. **Real backend**
   - move mock store to API plus database
   - admin auth and client auth
   - signed license keys
   - webhook or polling for POS status

3. **POS integration**
   - point the existing POS license service at the new API
   - keep offline cache and signed key verification

4. **Payments**
   - JazzCash and Easypaisa integration if available
   - manual transaction review stays as fallback
   - receipts and renewal reminders by SMS or email

## 11. Non-goals for this phase

- Real money movement
- Real authentication or permissions
- Real license signing
- Email or SMS delivery
- Multi-tenant hosting and deployment

## 12. Implemented architecture

- `web/` runs its own backend through Next.js route handlers. Admin login sets a signed httpOnly session cookie, and the license server token stays server side.
- Admin data lives in Convex: clients, payments, activation codes, pricing, activity and admin settings. The browser calls `/api/admin/*`; those routes call Convex with `LICENSE_ADMIN_TOKEN`.
- The client portal calls `/api/portal/*` for registration, public status and payment requests.
- The POS backend calls Convex `/install/status` and caches the result locally for 15 seconds. Offline, it keeps using the last known license.
- The POS only writes to Convex through `/license/redeem` when a 10 digit activation code is entered.
- Each code has `maxDevices`. Every device that redeems it is stored in `activations`. The owner can remove one device to free a slot or revoke the whole key. Revoking a key does not change the client plan; block or expire the client to lock the shop.
- Payment requests are submitted from the web portal. The POS paywall shows the amount, payment details and a link to the portal, then unlocks automatically when the admin approves.
- `PORTAL_BASE_URL` is set on the Convex deployment and returned as part of the install status so the POS can open the right portal.
- The old `/api/live/*` proxy, the browser demo store and the local POS admin and payment endpoints are removed.
- Crash reports are stored in Convex `crashReports`, linked to the client and device, and shown under Crash reports in the owner console.
