# Open Issues — Muhammadi Migration

Leftovers from the legacy (`muhammadimobiles.sql`) → Fig POS catalog migration. Full product comparison done: nothing missing (110/110 phone spec-combos, 793/793 accessory names verified individually).

## Pending decisions / fixes

### 1. Nokia 117 — wrong price
- Sale price imported as **Rs 123,455** (obvious legacy data-entry typo).
- Need correct price from the shop, then fix in all 3 DBs.

### 2. Phone colors collapsed on merge (~15 models) — NOT AN ISSUE
Duplicate legacy rows (same model, different color) were merged into single catalog products, dropping the color label. This is fine by design: **color is chosen when purchasing**, and the purchased unit's color is what shows in inventory. No action needed.
(Etachi B165 / MUSIC 500 / POWER 251, Nokia 105 CLASSIC / 106 / 108 / 130 MUSIC, Itel IT 2166, QMobile E4 25 / Q5606 / QSUPER, Sego VALUE 200S, Infinix SMART 20 new / NOTE 50 PRO Racing, Tecno SPARK GO 2 / GO 3 128GB, Vivo Y05 new.)

### 3. `TYPE C CABLE` — Yolo brand — RESOLVED
Yolo is a real brand. Added **Yolo** brand; `TYPE C CABLE` (MIG-865) assigned to it. Import script now brands any accessory named/barcoded `YOLO`.

### 4. `APPLE 5 FOXCON` placement — RESOLVED
It's a cable, and **Foxcon is a brand** (like Yolo). Product is now `5 FOXCON` under the **Foxcon** brand in **Data Cables**. Import script brands any FOXCON name/barcode automatically.

### 5. `APPLE 16 PMX` placement
Legacy category was CHARGER; currently sits in **Back Covers**. Confirm intended category.

### 6. `A06 DTP` spelling — RESOLVED
Samsung A06 pouch renamed `A06 DTP` → **A06 DPTP** and moved to **Pouch › Double Plastic**. Import normalizes `DTP` → `DPTP`; organizer routes it to Double Plastic.

## Known quirk (harmless now)

### 7. Opening purchases imported — RESOLVED
930 legacy rows with stock imported as 18 PURCHASE transactions (per-supplier, PAID via CASH, note "Opening stock imported…"). 4965 pieces total (4835 accessories + 130 phone units with IMEIs), value Rs 2,238,892. 126 duplicate-name/color rows remapped onto surviving catalog products — stock now matches legacy per-product totals (0 mismatches). Cash ledger not affected (historical stock, balance stays Rs 51,000). Supplier grouping: 2 existing vendors (Advance Telecom, Jam Manzore) + 16 new Vendor contacts.

**Exception:** legacy `supplier_invoice_items` invoice 3 (deleted supplier 8) showed Rs 320 unpaid (Charger 200 + Cable 120, generic names, unmappable to specific products). Marked as settled exception — no purchase created for it. Logged here for audit.

### 8. Fresh re-import would recreate ~10 phone duplicates
The legacy dump has shifted spec columns (color holds RAM, ram holds storage, rom holds PTA status), so a fresh run of `backend/scripts/migrate-products.ts` re-creates near-duplicate phone rows that were merged by hand this time. Only relevant if the catalog is ever re-imported from scratch — current fig.db is already correct and verified.
