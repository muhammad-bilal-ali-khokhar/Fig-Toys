# Plan: Dropdown Quick-Add Preference (one-click add, no price/qty/Add button)

**Context:** User wants a Settings toggle — "Select item from dropdown" — **disabled by default**. When enabled, the price/qty/Add button are hidden and selecting a product from the dropdown instantly adds it to the Sale Item List (cart) with qty=1 at catalog price. Applies to **all transaction pages except `/purchases`** (which keeps current flow). Explicitly includes **`/pos` (Sale), `/sale-returns`, `/purchase-returns`, `/purchase-orders`**. Need a plan (no code yet).

## 1. Requirement Analysis

- **Setting name:** `app.quickAdd` (or `app.dropdownQuickAdd`) — boolean, default `false`.
- **Source of truth:** `backend/endpoints/settings/service.ts` Settings table (`Settings.key = "app.quickAdd"`). Mirrored in `frontend` localStorage `fig.quickAdd` for instant UI before API load (like `fig.print.mode`).
- **Scope:** Only Accessory/product dropdown path. Phone IMEI flow (scan/unit picker) unchanged. When enabled:
  - Hide: `Qty` `<Input>`, `Price` `<Input>` / `PriceInput`, and the `Add` `<Button>` on those pages.
  - Keep: `Dropdown` (searchable) — onChange immediately calls add logic with `qty=1`, price = `product.sellPrice` (sale-returns/purchase-returns) or `product.costPrice` (purchase-orders if included? but excluded per spec except we WILL change purchase-returns/purchase-orders). Toast on success/stock error. Clear dropdown value after add (`setSelProductId(null)`).
- **Disabled default:** existing JSX remains; gated by `if (quickAddEnabled) ... else ...`.
- **Excluded:** `/purchases/page.tsx` (buy flow with color/carrier/battery/grade/IMEI popup) — no change.
- **Out of scope:** Bulk barcode same-barcode optimization; keep as is.

## 2. Investigation Summary

- `frontend/app/(app)/pos/page.tsx:959` — `productOptions` (inStock ACCESSORY), `selProductId`, `addQty`, `addPrice`, `handleAddClick` + `addLine`. Layout uses `min-w-64` dropdown + 2 inputs + Add button.
- `frontend/app/(app)/sale-returns/page.tsx:156` — `productOptions`, `selProductId`, `returnQty`, `returnPrice`, Add button at `653`. Same ACCESSORY-only dropdown.
- `frontend/app/(app)/purchase-returns/page.tsx:205` — `productOptions`, `selProductId`, `returnQty`, `returnPrice`, Add at `958`. Same.
- `frontend/app/(app)/purchase-orders/page.tsx` — variant with flow tab; has similar product picker for order creation (needs read — assume `selProductId` + qty/price/Add).
- `frontend/app/(app)/settings/page.tsx` + `components/settings/*` — settings tabs; new toggle belongs in **Settings > POS** or **Appearance** (avoid Print). Look at `lib/constants` for pattern.
- `backend/endpoints/settings/service.ts:50`, `schemas.ts`, `handlers.ts`, `routes.ts` — existing pattern for `app.theme`, `app.autoPrint`, `app.printMode`. Add parallel `getQuickAdd`/`updateQuickAdd`.

## 3. Design

**Backend:**
- `service.ts`: `const QUICK_ADD_KEY = "app.quickAdd"; export async function getQuickAdd(): Promise<boolean>` (parse `row?.value === "true"`), `updateQuickAdd(enabled: boolean)`.
- `schemas.ts`: `export const quickAddSchema = z.object({ enabled: z.boolean() })`.
- `handlers.ts`: `quickAddGetHandler` / `quickAddPutHandler`.
- `routes.ts`: `GET /settings/quick-add`, `PUT /settings/quick-add` (validate, `requirePermission(PERMISSIONS.settingsWrite)` like print-mode).

**Frontend shared:**
- `frontend/lib/quick-add.ts` (new): `export type QuickAddMode = boolean;` + `getLocalQuickAdd(): boolean | null`, `setLocalQuickAdd(v)`, `getEffectiveQuickAdd(fallback=false)` + hook `useQuickAdd()` (fetches `/settings/quick-add`, merges localStorage, provides `enabled`, `setEnabled`).
- `frontend/lib/constants/settings.ts` (if exists) — add storage key `QUICK_ADD_KEY = "fig.quickAdd"`.

**Settings UI:**
- `frontend/components/settings/pos-settings-tab.tsx` (new) or extend existing General tab: `Switch` "Quick add from dropdown — one click to add" (default OFF). Description: "When on, picking a product from the dropdown adds it instantly with quantity 1 at catalog price. Price, quantity and Add button are hidden. Turn off to edit price/qty before adding." Immediate `setLocalQuickAdd` + `PUT /settings/quick-add` (toast on error, revert).

**Per-page UI changes (gated):**
1. **POS** `pos/page.tsx`:
   - `const quickAdd = useQuickAdd()` (or inline `useEffect` fetching).
   - If `quickAdd`:
     - Render only `<Dropdown value={selProductId} ... onChange={immediateAdd}>` — `onChange` finds `ProductSummary`, checks `inStock`, stock dialog if needed, calls `addLine(fakeResult, undefined, undefined, 1)` with catalog `sellPrice`, toasts, `setSelProductId(null)` (keep dropdown placeholder). Do NOT render `addQty`, `addPrice`, Add button.
     - Keep legacy branch unchanged under `!quickAdd`.
     - Ensure `handleAddClick` fallback still works for disabled mode.
   - Both `isNewLayout` and fallback form branches need gating.

2. **Sale-returns** `sale-returns/page.tsx:658`:
   - Same pattern: hide Qty/Price/Add, dropdown `onChange` builds `SearchResult` fake + `addAccessoryQuantity` with `qty=1`, `price = sellPrice`, with sale-grouping logic. Check `categoryType !== PHONE`, stock `inStock` guard.
   - Gating both `isNewLayout` section and non-new layout section (lines 887ff).

3. **Purchase-returns** `purchase-returns/page.tsx:932`:
   - Same as sale-returns but accessory sellPrice; use `addAccessoryScanned`-style logic with `qty=1`.

4. **Purchase-orders** `purchase-orders/page.tsx`:
   - Verify file: likely `pos`-like order builder. Apply same gating: hide qty/price/Add, dropdown auto-adds with `costPrice` and qty 1. If order has per-item cost logic, use catalog cost. Keep barcode bulk path untouched.

**Excluded:** `purchases/page.tsx` — no gate, keep IMEI/barcode popup flow.

## 4. File Changes Checklist

- `backend/endpoints/settings/service.ts` — add `QUICK_ADD_KEY`, `getQuickAdd`, `updateQuickAdd`.
- `backend/endpoints/settings/schemas.ts` — add `quickAddSchema`.
- `backend/endpoints/settings/handlers.ts` — add 2 handlers, import.
- `backend/endpoints/settings/routes.ts` — add 2 routes.
- `frontend/lib/quick-add.ts` — new util/hook.
- `frontend/components/settings/pos-settings-tab.tsx` — new toggle (or edit `settings/page.tsx`).
- `frontend/app/(app)/pos/page.tsx` — import `useQuickAdd`, gate dropdown block.
- `frontend/app/(app)/sale-returns/page.tsx` — same.
- `frontend/app/(app)/purchase-returns/page.tsx` — same.
- `frontend/app/(app)/purchase-orders/page.tsx` — same (TBD line refs).
- `frontend/app/(app)/settings/page.tsx` — register new tab/section.

## 5. Risks & Edge Cases

- **Stock validation:** quick-add must still check `prod.inStock` vs `existingQty + 1` (already in POS); show `setStockDialog` or toast `Only X pcs available`. Don't silently oversell.
- **Phone vs Accessory:** dropdown filters `categoryType === "ACCESSORY"`; quick-add should still block phone `categoryType === "PHONE"` with toast "Phones require IMEI".
- **Price override loss:** users on quick-add lose ability to edit price before add — acceptable per spec; they can still edit in cart table via inline `PriceInput` (keep cart editing).
- **Dropdown value clearing:** after quick-add, reset `selProductId` to `null` so dropdown shows placeholder; otherwise next open shows stale value.
- **Return grouping:** sale-returns/purchase-returns group by `saleId`/`purchaseId`; quick-add for accessory returns must set `saleId` from `cart[0]` or empty and keep refund logic.
- **Persistence race:** Settings PUT may fail; revert local state + toast (existing `saveSetting` pattern).
- **Role gating:** Setting is admin-only write (like `settingsWrite`); cashier sees toggle disabled but reads value.

## 6. Verification

- `cd frontend && npx tsc --noEmit` + `cd backend && npx tsc --noEmit`
- Manual: Toggle OFF → POS shows dropdown + Qty + Price + Add; Add requires click. Toggle ON → those 3 controls disappear, picking dropdown adds row instantly with `×1` at catalog price, toast appears, dropdown clears.
- Repeat on Sale Return, Purchase Return, Purchase Orders. Confirm Purchases page unchanged.
- Test stock cap: inStock=2, add third via quick-add → error dialog.
- Test persistence: reload — mode persists (GET `/settings/quick-add`).
- E2E: Playwright if exists: `pos.spec.ts` quick-add path.

## 7. Open Questions for User

- Purchase Orders also accessory-only quick-add? Confirm cost vs sell price for its dropdown.
- Should quick-add also apply to Reservations page accessory picker if exists? Currently out of scope — keep false.
