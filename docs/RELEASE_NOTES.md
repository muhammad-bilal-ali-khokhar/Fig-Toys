## Unreleased
- **Global barcode/IMEI scanner** — new `GlobalScannerProvider` (`frontend/components/scanner/global-scanner.tsx:60`, `frontend/app/providers.tsx:19`) wraps the whole app. Press **Ctrl+Shift+S** (⌘+Shift+S on Mac) or tap **Scan IMEI** anywhere (POS, Purchases, Purchase Orders, Inventory, Reservations) to open the camera scanner. Scanning fills the focused IMEI/barcode field or auto-adds the product to the cart. Scanner buttons added to POS (`frontend/app/(app)/pos/page.tsx:912`), Purchases (`frontend/app/(app)/purchases/page.tsx:798`), Reservations (`frontend/app/(app)/reservations/page.tsx`) and Inventory. `ScannerButton` / `ScannerIconButton` (`frontend/components/scanner/scanner-button.tsx:10`) reuse the same provider.
- **Phones must be sold by IMEI** — POS and Reservations now reject adding a phone without its serial: "IMEI/Serial required — scan the serial" (`frontend/app/(app)/pos/page.tsx:520`, `frontend/app/(app)/reservations/page.tsx:438`). The product picker on POS/Reservations only lists accessories when picking by dropdown; phones must come from barcode/IMEI scan or search. Backend enforces the same (`backend/endpoints/transaction/service.ts:102`) — `sale.phone_requires_imei` if `category.type === PHONE && !unitId`, and `sale.phone_quantity` if a phone line has `quantity !== 1`.
- **Bank payment redesign + fill-remaining helpers** — `BankPaymentRow` (`frontend/components/payment-bottom.tsx:13`) now shows banks as pills with a total, and `BankDepositSheet` (`frontend/components/bank-deposit-sheet.tsx:18`) is a full per-bank card layout (pick bank, amount, remove) with a live "Total bank" footer and "Add another bank" dashed button. POS, Purchases, Purchase Orders, Sale Returns and Purchase Returns all use the new row/sheet, auto-cap cash when bank total changes, and offer **Fill remaining as cash / card / credit** buttons next to Cash/Credit inputs so the last field is never typed by hand. Sale/Purchase returns and Inventory benefit from the same polish.
- **Voucher print no longer shows plus/minus sign** — `CPV`/`CRV` vouchers (`frontend/components/print/documents.tsx:736`) now show `Rs 50,000` under **Amount paid** / **Amount received** instead of `- Rs 50,000` / `+ Rs 50,000`. The header label already says paid/received, so the dash was redundant and looked like a deduction on migration pay-outs (e.g. ZAEEM BHAI / RASHID MINHAS).
- **Full thermal tuning per document type** — Print Studio's Show/Hide now has a Thermal tuning panel: font size, line height, page padding/margin, header scale, density (light/normal/bold), compact mode, logo toggle, QR size and barcode height. Each setting is saved per document type (`SALE`, `PURCHASE`, returns, `VOUCHER`, `EXPENSE`, inventory, contacts, expense sheet + 8 report types) in `print_settings.config` via `PUT /api/print-setting` (`backend/prisma/schema.prisma:546`, `backend/endpoints/print-setting/`). Receipts, vouchers, inventory/contacts/expense sheets and all report layouts (`frontend/components/print/documents.tsx:367`, `frontend/app/(app)/print/dlayout/shared.tsx:22`) render with the saved `fontSize`/`padding`/`margin`/`density` so 58mm and 80mm rolls no longer clip.
- **58mm now available everywhere** — `INVENTORY_FORMAT_IDS` (`frontend/lib/constants/print.ts:70`) and `Print Studio` format picker (`frontend/app/(app)/print/page.tsx:240`) now offer 58mm for every list and report, and Settings → Print defaults (`frontend/components/settings/print-settings-tab.tsx:20`) include 58mm.
- **Opening stock imported as purchases** — 930 legacy rows with stock migrated as 18 per-supplier PURCHASE transactions (PAID via CASH, Rs 2,238,892 across 4965 pieces — 4835 accessories + 130 IMEI-tracked phones). 126 duplicate-name/color rows were remapped onto the surviving catalog products so per-product totals now exactly match the legacy system (820 products verified, 0 mismatches). Cash ledger left untouched (historical stock). One tiny legacy invoice (Rs 320, deleted supplier) logged as settled exception.
- **Foxcon is a brand** — `5 FOXCON` in Data Cables now sits under the new **Foxcon** brand instead of Apple. Import script auto-brands anything with FOXCON in its name or barcode.
- **`5 FOXCON` is a data cable** — moved from Back Covers to Data Cables, matching its legacy DATA CABELS home.
- **`A06 DTP` fixed** — Samsung A06 pouch renamed to **A06 DPTP** and moved into **Pouch › Double Plastic** with the rest of the DPTP covers. `DTP` now normalizes to `DPTP` on import and routes correctly in the organizer.
- **Yolo is a brand** — added the Yolo brand and moved the `TYPE C CABLE` data cable (barcode `YOLO TYPE C`) from Generic to it. Import script auto-brands anything named/barcoded `YOLO`. Also fixed latent null-barcode type errors in the import script.
- **Open-items tracker for the Muhammadi migration** — added `ISSUE_MUHAMMADI.MD` listing everything still pending after the full legacy-vs-current product comparison (Nokia 117 price typo, phone color merges confirmed fine since color is set at purchase, Yolo cable brand question, two category-placement confirmations, `A06 DTP` spelling) plus the known fresh-re-import quirk.
- **Screen Protectors subcategories** — the glass category now has four children matching the legacy splits: **Camera Protector** (`CAMERA GLASS`, `CAMERA GLASS MIX`), **OG** (original-quality glass: `OG 17 PRO MAX`, `OG SMART 20`, `OG GLASS MIX`), **Polish** (`POLISH MIX`, moved out of Other Accessories) and **UV** (`UV MIX`). `PRIVACY GLASS MIX` stays on the Screen Protectors root. Organizer routes CAMERA/OG/POLISH/UV names automatically.
- **Dany `SI110` and `TY10` are data cables** — moved from Other Accessories to Data Cables, joining `POWERLINE TY15`. Other Accessories now holds only true one-off items.
- **New "Straps" category** — the 5 phone straps (CHAIN, RADO, COTTON, PACKING, MIX) moved out of Other Accessories per the legacy STRAPS category. Organizer routes `STRAP` names automatically.
- **O LONNIE MECHA D6/D8 are neckbands** — moved from Other Accessories to Audio (legacy NECK BAND).
- **Handsfree & Audio split into Earbuds and Handsfree** — wireless earbuds/TWS (AIRPODS 2, LOSE PRO 2, pop-up pairs, BUDS, AIRDOTS, AIR 31, M11 MINI) now live in **Earbuds** (11); wired handsfrees (HF models, ST12, JBC, ROGERS, GIONEE) in **Handsfree** (14). The old category is now just **Audio** (8) holding speakers, neckbands and headphones: ROKO, SOLO X7, S350, L260/273/292, BT 40 HRS, CAR AUDIO LINE. Organizer routes earbud vs handsfree names automatically.
- **AirPods copies branded Apple** — per shop practice (copies are sold under the brand name in Pakistan): `AAIR POD 2` → Apple `AIRPODS 2` (Rs 250) and the two AirPods Pro 2 copies `LOSE PRO 2 WHITE`/`BLACK` → Apple. Import script brands anything named/coded AIRPODS as Apple automatically. Handsfree & Audio › Generic drops to 9 items.
- **Data Cables branded from barcodes** — `VOOC TYPE C` → Oppo (VOOC is Oppo's charging tech) and `TURBO TYPE CDATA CABLE` → Xiaomi `TURBO TYPE C` (barcode `MI TRURBO TYPE C`, glued-word typo fixed). The remaining 9 Data Cables › Generic items have no brand in their legacy barcodes and stay Generic. Import script applies VOOC→Oppo and MI-Turbo→Xiaomi automatically.
- **Copy chargers branded from their barcodes too** — `18W FLASH` → Vivo, `120W SUPER VOOC` + `2AMP COPY` → Oppo, `25W COPY FAST` + `2AMP` (barcode typo `SAMSUN`) → Samsung, `45W COPY` → Infinix, `67W COPY` → Xiaomi. Chargers › Generic now only holds the two true no-brand items (`LOT MIX CHARGER`, `WIRLESS CHARGER`). Import script reads Vivo/Oppo/`SAMSUN` barcodes and `2AMP` models automatically.
- **New "Jelly" category** — jelly cases (`360 JELLY`, `IP 17 PRO MAX 360`, `JELLY PRINT`, `JELLY SADA`) are their own thing, moved out of Back Covers per the legacy JELLY category. Organizer routes `JELLY`/`360` names to Jelly.
- **Dany `POWERLINE TY15` is a data cable** — moved from Other Accessories to Data Cables.
- **Power Banks fixed** — `XPOWER GO` and Login `L707 OBLIVER 65W` were sitting in Chargers but are power banks (the legacy system had both under POWER BANK). Power Banks now holds 4 items: PD POWER BANK, ST 200 PD, XPOWER GO, L707 OBLIVER 65W.
- **`17 PRO DPDT` and `A17 DPTO` are Double Plastic pouches, not screen protectors** — both moved from Screen Protectors to Pouch › Double Plastic (Rs 180 each) and renamed with the standard **DPTP** code. Organizer rule fixed so `DPDT`/`DPDTO`/`DPTO` codes always route and normalize to Double Plastic.
- **Five more legacy categories restored** — the old system's CAR CHARGER, SELFI STICK, STAND/MOBILE STAND, RING LIGHT and MIC categories are back: **Car Chargers** (4), **Selfie Sticks** (3), **Stands & Holders** (3), **Ring Lights** (2) and **Mics** (3). Items moved out of Other Accessories / Chargers / Audio.
- **Login audio gear reclassified** — four Login models were misfiled as data cables/chargers; per the legacy system they are actually: `L260` neck band, `L273` BT speaker, `L292` head phone (now in Handsfree & Audio) and `L600`/`L601 45W`/`L602` car chargers (now in Car Chargers).
- **New "Connectors" category** — restored from the legacy system's CONVERTER category. The adapters and splitters moved out of Data Cables / Chargers / Handsfree & Audio: Apple `3.5 TO LIGHTNING`, `3.5 TO LIGHTNING COPY`, `3.5 TO TYPE C`, `CONVERTERS`, plus Generic `LIGHTNING SPLITER` and `TYPE C SPLITER`. Import/organize scripts route them automatically.
- **"ORG" chargers given their real brands** — the original chargers whose brand only appeared in the barcode field are now properly branded and renamed: Samsung `25W SUPER FAST` + `45W PD`, Infinix `10W`/`18W`/`33W`/`70W`, Xiaomi `67W`, OnePlus `65W`/`80W`, Asus `45W`, and Apple's `3.5 TO LIGHTNING` adapter (barcode A1749). Added **Asus** as a new brand. The import script now reads charger brands from barcodes automatically.
- **Spelling fixes** — `LIGHTINIG` → `LIGHTNING` across 3 items (incl. `LIGHTNING SPLITER`).

- **"Memory & Storage" split into Card, USB and Card Reader** — the old Memory & Storage category is gone, replaced by three direct Accessory categories: **Card** (5 SD/memory cards), **USB** (4 USB drives) and **Card Reader** (1). Spelling fixed on the packing cards (`PAKING` → **PACKING**) and `4GB LOSE` renamed to **CARD 4GB LOSE**. Organizer routes card/USB/reader names to the right category automatically.

- **Login model codes standardized** — all Login cables/chargers now use the tight `L934` style with no dash or space: `L 207` → `L207`, `L-412 PD` → `L412 PD`, `L 1947 TYPE C` → `L1947 TYPE C`, `LT 124 USB TO LIGHTING` → `LT124 USB TO LIGHTING`. Audionic's `S 350` handsfree became `S350` the same way, and Dany's `TY 10`/`SI 110`/`POWERLINE TY 15` became `TY10`/`SI110`/`POWERLINE TY15`. Import script applies all of these automatically.

- **New "Accessory › Pouch › Magnetic" category** — all magnetic covers unified under one name and moved together: `MAGNET`/`MAGANETIC` spellings are now **MAGNETIC** (7 items, e.g. `17 MAGNET` → `17 MAGNETIC`, `12/12 PRO MAGANETIC` → `12/12 PRO MAGNETIC`). The metal magnetic **cable** stays in Data Cables. Import script normalizes the spelling; organizer routes covers with MAGNET names to the new category.

- **New "Accessory › Pouch › Official" category** — all **27 OFFICIAL covers** moved from Back Covers into the new Official child under Pouch, and the misspellings `OFFCIAL`/`OFFICAL`/`OFICAL` were corrected to **OFFICIAL**. Import script fixes the spelling automatically; organizer routes Official names to the new category.

- **New "Accessory › Pouch › Double Plastic" category** — DPTP covers (DP = double plastic, not plain transparent) got their own pouch type: all **36 DPTP items** moved out of Transparent into **Pouch › Double Plastic**, leaving Transparent with the 190 single-layer TP pouches. One glued name fixed (`SMART 10+DPTP` → `SMART 10+ DPTP`). Organizer routes DPTP names to the new category automatically.

- **New "Accessory › Pouch › Transparent" category** — all **226 TP pouches** (everything with TP in the name, kept as-is) moved from Screen Protectors into the new Transparent child under Pouch. Screen Protectors now holds only actual glass items (GLASS/UV). Pouch types are now Leather (297), Transparent (226) and Spigen (29). Organizer routes TP names to the new category automatically.

- **New "Accessory › Pouch › Spigen" category** — a **Spigen** child now sits next to Leather under Pouch, and all 29 Spigen covers (including the one misspelled "SPINGEN", now fixed) were moved into it. Import script corrects the spelling automatically; the organizer routes Spigen items to the new category.

- **Last two cover spelling typos fixed** — `INFINIX NOT 11i` → **NOTE 11i** and `INFINIX SMAT 9/HOT 50i TP` → **SMART 9/HOT 50i TP**. Import script corrects both misspellings automatically.

- **Brand name removed from accessory model names** — since every accessory now carries its brand as a proper field, the redundant brand prefix was stripped from all 684 branded accessory names: `SAMSUNG A05s LEATHER` → **A05s LEATHER**, `INFINIX HOT 60 PRO TP` → `HOT 60 PRO TP`, `ONE PLUS 10 PRO OFFICIAL` → `10 PRO OFFICIAL`, `AUDIONIC ROGERS RO 11` → `ROGERS RO 11`. Same model under different brands (e.g. `NOTE 10 LEATHER` for both Samsung and Redmi) stays separate because the brand differs. Import script strips the prefix automatically.

- **Accessories now have real brands** — 684 accessory products (covers, glass, cables, chargers, audio) were moved out of **Generic** into the brand their name carries: Samsung (131), Apple (87), Infinix (80), Vivo (79), Oppo (76), Tecno (51), Redmi (42), Login, OnePlus, Pixel (was misspelled "PIXIL" — names fixed too), Realme, Itel, Audionic, Nokia, Dany, Huawei (was "HUWEI/HUWAEI"), Sparx, Gionee, Hyper and Qmobile. New brands created: Huawei, Gionee, Pixel, Audionic, Dany, Login, Hyper. Generic keeps the 109 genuinely unbranded items (wattage chargers, card readers, generic cables, misc gear). Import script detects these name prefixes automatically.
- **Accessory names are now consistently uppercase** — 135 names had mixed casing from the legacy data (e.g. `Samsung a05 leather`, `samsung a04s tp pk`, `Samsung S23ULTRA LEATHER`). All accessory names are now uniform ALL-CAPS with glued words split (`S23ULTRA` → `S23 ULTRA`, `J7PRIME` → `J7 PRIME`, `NOTE10` → `NOTE 10`, `150BAR` → `150 BAR`). Official lowercase suffixes are preserved (`HOT 50i`, `A5i`, Samsung `A05s`/`A04s`). Import script applies the same casing rules.

- **New "Accessory › Pouch › Leather" category** — a **Pouch** subcategory with a nested **Leather** child now exists under Accessory, and all 297 leather back covers (everything whose name says LEATHER, formerly the "LDR" shorthand) were moved into it. Reports and filters pick it up automatically via the full category path `Accessory › Pouch › Leather`.

- **"LDR" covers renamed to "Leather"** — all 255 back-cover models that used the shorthand "LDR" (which sounds like "leather") now say **LEATHER** explicitly, e.g. `INFINIX HOT 60PRO LDR` → `INFINIX HOT 60PRO LEATHER`. Import script applies the same rename automatically.

- **Model name casing & typo fixes** — Samsung `A05S` is now **A05s**, Nokia `105 CLASIC` → **105 CLASSIC**, the stray "NOKIA 150 MUSIC" duplicate was folded into **150 MUSIC**, and Vivo's mistyped "YO5" (letter O) was merged into **Y05**. A feature-phone spec glitch on Nokia 117 (64GB/4GB) was cleared. Import script applies these fixes automatically.
- **Phone model names cleaned up** — missing spaces fixed across the phone catalog: `SPARK 20PRO+` → **SPARK 20 PRO+**, `SPARK 40PRO` → SPARK 40 PRO, `SPARK GO2/GO3` → SPARK GO 2 / GO 3, Infinix `HOT 60PRO`/`HOT60 PRO` unified as HOT 60 PRO, `SMART 9HD` → SMART 9 HD and Sego `VALUE 3000PRO` → VALUE 3000 PRO. The import script now normalizes these names automatically. (Accessory names like "F11PRO" still use the old style — say the word if you want those cleaned too.)

- **Same phone, one product** — duplicate color variants of the same model were merged into a single product entry (18 duplicates removed, e.g. Samsung A06 Black + Blue are now one A06; Tecno SPARK GO2 had three separate entries). One price is kept on the product — differences in what each piece actually cost at purchase belong on the individual unit/purchase, not on extra product rows. Catalog is now 875 products. The import script was updated so fresh imports merge variants the same way.

- **Club, Etachi, Gfive, Qmobile, Sego, X-Cell, Zeetell & Itel phones refiled as Feature Phone** — all Club products (GRACE, MUSIC 110PRP, VALUE 3000PRO), all Etachi products (B165, MUSIC 500, POWER 251), the Gfive G3310, every Qmobile model (QSUPER, Q5606, QNOVA, E4 25, QGURU PRO), the Sego VALUE 200S, the X-Cell XL POWER, the Zeetell RAJA and every Itel model (IT 2165, IT 2166, IT 2181, SIGNAL 10) now sit under **Feature Phone** (New and Used) instead of Smart Phone, matching Nokia and Calme. The Sego NOTE 80X (64GB/4GB) stays a Smart Phone. The migration script also learned these rules so future imports classify these brands correctly.
- **"I Tell" brand merged into Itel** — the legacy data spelled the same brand two ways ("Itel" and "I Tell"), which split one used IT 2165 into its own fake brand. The stray brand is gone; the product now lives under Itel (as the Used variant of the existing IT 2165), and the migration script maps the alias automatically.
- **Products by Brand sheet shows New vs Used together** — `PRODUCTS_BY_BRAND.md` now merges the New and Used variants of the same model onto one line (e.g. `GRACE — Feature Phone — New Rs 3,850 · Used Rs 3,000`) so price differences between conditions are obvious at a glance.

- **Default page size is now 50** — all paginated lists (Inventory, Products, Contacts, Vouchers, Expenses, report tables) now show 50 rows per page by default instead of 10, so you see far more data before needing to hit Next. You can still switch between 10/25/50/100/500/1000/All from the rows-per-page selector.
- **Products page filters reworked** — the **Condition** filter (New / Used / Accessory) is gone from the Products filter sheet. **Category** now lists your real top-level categories from the database, and a new searchable **Subcategory** filter appears once you pick a category, showing every subcategory under it with full paths (e.g. `Accessory › Cases & Covers › Pouch › TPU`) no matter how deep they nest. Picking a category or subcategory also includes everything nested beneath it, and categories/subcategories you add later show up automatically.
- **Catalog-only import** — migrated stock is no longer loaded as in-stock inventory. All imported IMEI units and stock movements were cleared, keeping only the product catalog (893 products across 20 brands), so the shop can start fresh stock through normal purchases.
- **Nokia catalog corrections** — all Nokia phones are now filed under **New Phone › Feature Phone** instead of Smart Phone, and the charcoal variant of the Nokia 105 Classic is labeled Charcoal.

- **Accessories are now organized into real subcategories** — the 793 migrated accessory items no longer sit in one flat "Other Accessories" pile. Each product was reviewed individually and sorted by what it actually is: **Back Covers** (389 — leather/LDR, Official, Spigen, magnetic, jelly, 360), **Screen Protectors** (235 — TP/DPTP tempered glass, camera & privacy glass), **Chargers** (26 — wall/wireless/car chargers & converters), **Data Cables** (47 — Type-C/Lightning/micro cables, OTG, splitters), **Handsfree & Audio** (36 — earbuds, handsfree, mics), **Batteries** (23 — phone & feature-phone batteries incl. BL-5C/bar types), **Memory & Storage** (10 — SD cards, USB drives, card reader) and **Power Banks** (2). Only genuinely unclassifiable items (selfie sticks, ring lights, straps, holders) remain under Other Accessories.
- **Migrated stock is now deduplicated** — the legacy database stored one row per physical piece, so identical models (e.g. 20 pieces of "Sego VALUE 200S") were imported as 20 separate product entries. They are now merged into a single product per brand + model + specs + color, with every IMEI kept as its own unit under it. Dual-SIM handsets that listed two IMEIs for the same phone no longer create a phantom second unit — stock counts went from 307 units to the true 205 pieces. Product count dropped from 1,031 duplicated rows to 893 real products with no data loss.
- **Screen sizes are now manageable** — a new **Screen sizes** tab in the Manage window (Products page) lets you add, rename, deactivate and delete the screen-size options offered on the product form. The list ships pre-filled with common phone and feature-phone sizes from 0.44" up to 12.9" (including small sizes like 1.77", 1.8", 2.0", 2.4" for feature phones), sorted smallest to largest, and custom sizes you add are saved to the database so they appear on every device.
- **Subcategories can now reuse the same name under different parents** — creating "Feature Phone" under **Used Phone** no longer blocks creating "Feature Phone" under **New Phone**. Category names are now unique per parent (not globally), so any subcategory name can exist under each top-level category independently. Duplicates under the same parent are still blocked, and renaming/moving a subcategory to a name that already exists under the target parent is rejected.
- **Nested sub-subcategories (e.g., Pouch › TPU/Leather)** — categories now nest to any depth. In **Manage categories**, the parent picker shows the full path `Accessory › Cases & Covers › Pouch` and you can create `TPU` and `Leather` under `Pouch`. The product form category picker is now a single searchable hierarchical dropdown showing paths, and the category tree correctly counts products recursively.
- **Reports are now category-dynamic** — **Sales**, **Stock valuation**, and the **Dashboard Sold** widget now group by full category path (`Accessory › Cases & Covers › Pouch › TPU`) and roll up to roots. Every new category or sibling you add (e.g., `Leather` next to `TPU`) appears automatically - no hardcoded `bySubcategory (accessories)` list. Check "how much TPU sold / in stock" directly in those reports.
- **Larger page sizes in list pagination** — the rows-per-page selector on all lists (Inventory, Products, Contacts, Vouchers, Expenses, report tables) now also offers **500**, **1000**, and **All** so you can view the full list without paging through 10/25/50/100-row pages.

## v0.1.58

- **Purchase order receiving now opens the Purchase page** — pressing **Receive** on a purchase order no longer bumps stock by quantity only. It takes you to the normal **Purchase** page with the order's vendor, items, prices and advance pre-filled, so you enter IMEIs (or barcodes for accessories) exactly like a real purchase. The purchase creates proper stock units, and the order is marked Partial/Received automatically. The receive popup is also larger and scrollable.
- **Desktop window is larger** — the packaged app now opens at 1680×1020 (was 1440×900) with a larger minimum size, so purchase/purchase-order screens no longer feel cramped.
- **Sale & purchase receipts group identical models** — Sales Receipts, Purchase
  Invoices, and their returns now print one line per model instead of one line
  per phone: selling or buying 3 pieces of the same model shows
  "Apple iPhone 13 ×3 — 3 Unit(s) × Rs 245,000" with all three IMEIs listed
  underneath. Works in thermal 58mm, 80mm, and A4 layouts, including the
  direct-print button on transaction screens. Pieces of the same model sold at
  different prices stay on separate lines so amounts remain correct.
- **Inventory print groups identical models** — Print Studio's Inventory List no
  longer prints one separate row per phone. Units of the same model collapse
  into a single row (e.g. "Apple iPhone 13 128GB ×3") with all their IMEIs
  listed underneath, in both thermal and A4 layouts. Details that differ
  between pieces of the same model (color, condition, status, carrier, grade,
  battery health, vendor, purchase date) show "Mixed" on the A4 sheet, and
  price columns show the combined value of the group so rows still add up to
  the stock-value totals at the bottom.
- **Fixed Purchase Orders crashing when receiving** — pressing **Receive** on an
  order in the Purchase Orders list crashed the page with a blank screen. The
  list view doesn't load product details, but the receive sheet expected them.
  The app now loads the full order when you press Receive, and if a product was
  deleted it shows "Unknown product" instead of breaking.
- **Removed the Local/Hosted choice from Desktop settings** — Settings → Desktop
  app no longer shows the "Where the app runs from" selector (local server vs
  hosted website URL) or its Save & restart button. The desktop app now always
  runs everything on this computer, and the tab focuses on crash reporting,
  logs, and the data folder.
- **"Open data folder" button in Settings** — Settings → Desktop app now has an
  **Open data folder** button that opens the folder holding your database,
  backups, and logs straight in File Explorer, so you can back it up or share
  log files without hunting through AppData. Uninstalling the app never deletes
  this folder.
- **Log folder is now created automatically** — the app no longer depends on a
  one-time attempt at startup to create its `logs` folder. If the folder is
  missing (or couldn't be created yet), every log write retries creating it, so
  `%APPDATA%\Fig POS for Mobile Phones\logs\fig.log` always exists once the app
  has run. Logging also initializes again as soon as Electron is ready, instead
  of silently staying off if the early startup attempt failed.
- **Fixed `run-app.cmd` flags** — `--build`, `--dev`, `--pack` etc. passed from
  `scripts\run-app.cmd` were silently dropped by PowerShell argument parsing,
  so the app always launched without rebuilding. The wrapper now maps them to
  the correct `-Mode` parameter.
- **Bank name picker with all Pakistani banks** — when adding or editing a bank
  account (Settings → Bank accounts, and during onboarding), the "Bank name"
  field is now a searchable dropdown pre-filled with 46 Pakistani banks and
  wallets — Meezan Bank, HBL, UBL, MCB, Allied Bank, Bank Alfalah, Easypaisa,
  JazzCash, NayaPay, SadaPay and more. The list also covers microfinance banks
  (HBL Microfinance, FINCA, NRSP, U Microfinance Bank), UPaisa and Zindigi
  wallets, agri/development banks like Zarai Taraqiati Bank, and China-facing
  banks (ICBC, Bank of China) handy for import payments. Start typing to
  search; if your bank isn't listed, choose **Use "…"** to keep what you typed
  and it's saved to the bank list automatically for next time. A **Manage**
  button in the form opens the bank list where you can add, rename, or remove
  banks.

## v0.1.56

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
