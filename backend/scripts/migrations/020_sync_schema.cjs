module.exports = function migrate(db) {
  try { db.exec(`-- AlterTable
ALTER TABLE "Contact" ADD COLUMN "city" TEXT;`); } catch (error) { if (!/already exists|duplicate column name/i.test(String(error.message))) throw error; }
  try { db.exec(`ALTER TABLE "Contact" ADD COLUMN "cnic" TEXT;`); } catch (error) { if (!/already exists|duplicate column name/i.test(String(error.message))) throw error; }
  try { db.exec(`ALTER TABLE "Contact" ADD COLUMN "cnicBackUrl" TEXT;`); } catch (error) { if (!/already exists|duplicate column name/i.test(String(error.message))) throw error; }
  try { db.exec(`ALTER TABLE "Contact" ADD COLUMN "cnicFrontUrl" TEXT;`); } catch (error) { if (!/already exists|duplicate column name/i.test(String(error.message))) throw error; }
  try { db.exec(`ALTER TABLE "Contact" ADD COLUMN "photoUrl" TEXT;`); } catch (error) { if (!/already exists|duplicate column name/i.test(String(error.message))) throw error; }
  try { db.exec(`-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN "clientRef" TEXT;`); } catch (error) { if (!/already exists|duplicate column name/i.test(String(error.message))) throw error; }
  try { db.exec(`-- AlterTable
ALTER TABLE "Unit" ADD COLUMN "sellPrice" DECIMAL;`); } catch (error) { if (!/already exists|duplicate column name/i.test(String(error.message))) throw error; }
  try { db.exec(`-- CreateTable
CREATE TABLE "cities" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);`); } catch (error) { if (!/already exists|duplicate column name/i.test(String(error.message))) throw error; }
  try { db.exec(`-- CreateTable
CREATE TABLE "Bundle" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "sku" TEXT,
    "price" DECIMAL NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);`); } catch (error) { if (!/already exists|duplicate column name/i.test(String(error.message))) throw error; }
  try { db.exec(`-- CreateTable
CREATE TABLE "BundleItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bundleId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "BundleItem_bundleId_fkey" FOREIGN KEY ("bundleId") REFERENCES "Bundle" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BundleItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);`); } catch (error) { if (!/already exists|duplicate column name/i.test(String(error.message))) throw error; }
  try { db.exec(`-- CreateTable
CREATE TABLE "licenses" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'store',
    "key" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "edition" TEXT NOT NULL DEFAULT 'PRO',
    "issuedAt" INTEGER,
    "expiresAt" DATETIME,
    "maxDevices" INTEGER NOT NULL DEFAULT 1,
    "deviceId" TEXT,
    "activatedAt" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'UNLICENSED',
    "lastVerifiedAt" DATETIME,
    "pricePkr" INTEGER NOT NULL DEFAULT 5000,
    "trialStartedAt" DATETIME,
    "trialEndsAt" DATETIME,
    "trialUsedAt" DATETIME,
    "purchasedAt" DATETIME,
    "lastPaymentAt" DATETIME,
    "paymentRef" TEXT,
    "portalUrl" TEXT,
    "clientId" TEXT
);`); } catch (error) { if (!/already exists|duplicate column name/i.test(String(error.message))) throw error; }
  try { db.exec(`-- CreateTable
CREATE TABLE "license_payments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "licenseId" TEXT NOT NULL DEFAULT 'store',
    "amountPkr" INTEGER NOT NULL,
    "method" TEXT NOT NULL DEFAULT 'JAZZCASH',
    "txnId" TEXT NOT NULL,
    "note" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PAID',
    "provider" TEXT NOT NULL DEFAULT 'MANUAL',
    "providerRef" TEXT,
    "checkoutUrl" TEXT,
    "rawState" TEXT,
    "verifiedAt" DATETIME,
    "paidAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "license_payments_licenseId_fkey" FOREIGN KEY ("licenseId") REFERENCES "licenses" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);`); } catch (error) { if (!/already exists|duplicate column name/i.test(String(error.message))) throw error; }
  try { db.exec(`-- CreateTable
CREATE TABLE "crash_reports" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "app" TEXT NOT NULL,
    "version" TEXT,
    "platform" TEXT,
    "message" TEXT NOT NULL,
    "stack" TEXT,
    "context" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "githubIssueUrl" TEXT
);`); } catch (error) { if (!/already exists|duplicate column name/i.test(String(error.message))) throw error; }
  try { db.exec(`-- CreateTable
CREATE TABLE "event_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "source" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "detail" TEXT,
    "meta" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);`); } catch (error) { if (!/already exists|duplicate column name/i.test(String(error.message))) throw error; }
  try { db.exec(`-- CreateTable
CREATE TABLE "cash_sessions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "number" TEXT NOT NULL,
    "openedById" TEXT NOT NULL,
    "openedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "openingFloat" DECIMAL NOT NULL DEFAULT 0,
    "closedById" TEXT,
    "closedAt" DATETIME,
    "closingFloat" DECIMAL,
    "countedFloat" DECIMAL,
    "variance" DECIMAL,
    "note" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    CONSTRAINT "cash_sessions_openedById_fkey" FOREIGN KEY ("openedById") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "cash_sessions_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);`); } catch (error) { if (!/already exists|duplicate column name/i.test(String(error.message))) throw error; }
  try { db.exec(`-- CreateTable
CREATE TABLE "purchase_orders" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "number" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "total" DECIMAL NOT NULL DEFAULT 0,
    "advance" DECIMAL NOT NULL DEFAULT 0,
    "advanceMethod" TEXT,
    "advanceBankAccountId" TEXT,
    "note" TEXT,
    "createdById" TEXT NOT NULL,
    "receivedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "purchase_orders_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "purchase_orders_advanceBankAccountId_fkey" FOREIGN KEY ("advanceBankAccountId") REFERENCES "bank_accounts" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "purchase_orders_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);`); } catch (error) { if (!/already exists|duplicate column name/i.test(String(error.message))) throw error; }
  try { db.exec(`-- CreateTable
CREATE TABLE "purchase_order_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "receivedQuantity" INTEGER NOT NULL DEFAULT 0,
    "costPrice" DECIMAL NOT NULL,
    CONSTRAINT "purchase_order_items_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "purchase_orders" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "purchase_order_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);`); } catch (error) { if (!/already exists|duplicate column name/i.test(String(error.message))) throw error; }
  try { db.exec(`-- CreateTable
CREATE TABLE "cash_accounts" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'main',
    "name" TEXT NOT NULL DEFAULT 'Cash in hand',
    "balance" DECIMAL NOT NULL DEFAULT 0
);`); } catch (error) { if (!/already exists|duplicate column name/i.test(String(error.message))) throw error; }
  try { db.exec(`-- CreateTable
CREATE TABLE "cash_drawers" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "balance" DECIMAL NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);`); } catch (error) { if (!/already exists|duplicate column name/i.test(String(error.message))) throw error; }
  try { db.exec(`-- CreateTable
CREATE TABLE "money_movements" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "kind" TEXT NOT NULL,
    "amount" DECIMAL NOT NULL,
    "account" TEXT NOT NULL,
    "bankAccountId" TEXT,
    "cashDrawerId" TEXT,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT,
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "money_movements_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "bank_accounts" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "money_movements_cashDrawerId_fkey" FOREIGN KEY ("cashDrawerId") REFERENCES "cash_drawers" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "money_movements_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);`); } catch (error) { if (!/already exists|duplicate column name/i.test(String(error.message))) throw error; }
  try { db.exec(`-- RedefineTables
PRAGMA defer_foreign_keys=ON;`); } catch (error) { if (!/already exists|duplicate column name/i.test(String(error.message))) throw error; }
  try { db.exec(`PRAGMA foreign_keys=OFF;`); } catch (error) { if (!/already exists|duplicate column name/i.test(String(error.message))) throw error; }
  try { db.exec(`CREATE TABLE "new_Expense" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "number" TEXT NOT NULL DEFAULT '',
    "category" TEXT NOT NULL,
    "amount" DECIMAL NOT NULL,
    "note" TEXT,
    "contactId" TEXT,
    "cashDrawerId" TEXT,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "clientRef" TEXT,
    CONSTRAINT "Expense_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Expense_cashDrawerId_fkey" FOREIGN KEY ("cashDrawerId") REFERENCES "cash_drawers" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);`); } catch (error) { if (!/already exists|duplicate column name/i.test(String(error.message))) throw error; }
  try { db.exec(`INSERT INTO "new_Expense" ("amount", "category", "contactId", "date", "id", "note", "number") SELECT "amount", "category", "contactId", "date", "id", "note", "number" FROM "Expense";`); } catch (error) { if (!/already exists|duplicate column name/i.test(String(error.message))) throw error; }
  try { db.exec(`DROP TABLE "Expense";`); } catch (error) { if (!/already exists|duplicate column name/i.test(String(error.message))) throw error; }
  try { db.exec(`ALTER TABLE "new_Expense" RENAME TO "Expense";`); } catch (error) { if (!/already exists|duplicate column name/i.test(String(error.message))) throw error; }
  try { db.exec(`CREATE UNIQUE INDEX "Expense_clientRef_key" ON "Expense"("clientRef");`); } catch (error) { if (!/already exists|duplicate column name/i.test(String(error.message))) throw error; }
  try { db.exec(`CREATE TABLE "new_Payment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "transactionId" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "amount" DECIMAL NOT NULL,
    "tendered" DECIMAL,
    "change" DECIMAL,
    "reference" TEXT,
    "bankAccountId" TEXT,
    "cashDrawerId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Payment_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Payment_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "bank_accounts" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Payment_cashDrawerId_fkey" FOREIGN KEY ("cashDrawerId") REFERENCES "cash_drawers" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);`); } catch (error) { if (!/already exists|duplicate column name/i.test(String(error.message))) throw error; }
  try { db.exec(`INSERT INTO "new_Payment" ("amount", "bankAccountId", "createdAt", "id", "method", "reference", "transactionId") SELECT "amount", "bankAccountId", "createdAt", "id", "method", "reference", "transactionId" FROM "Payment";`); } catch (error) { if (!/already exists|duplicate column name/i.test(String(error.message))) throw error; }
  try { db.exec(`DROP TABLE "Payment";`); } catch (error) { if (!/already exists|duplicate column name/i.test(String(error.message))) throw error; }
  try { db.exec(`ALTER TABLE "new_Payment" RENAME TO "Payment";`); } catch (error) { if (!/already exists|duplicate column name/i.test(String(error.message))) throw error; }
  try { db.exec(`CREATE TABLE "new_Product" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "brandId" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "storage" TEXT,
    "ram" TEXT,
    "screenSize" TEXT,
    "colorId" TEXT,
    "categoryId" TEXT NOT NULL,
    "carrier" TEXT,
    "sku" TEXT NOT NULL,
    "barcode" TEXT,
    "image" TEXT,
    "specs" TEXT,
    "ageRange" TEXT,
    "size" TEXT,
    "pieceCount" INTEGER,
    "material" TEXT,
    "batteryRequired" TEXT,
    "sellPrice" DECIMAL NOT NULL,
    "costPrice" DECIMAL NOT NULL,
    "retailPrice" DECIMAL,
    "lowStockThreshold" INTEGER NOT NULL DEFAULT 2,
    "stockAdjustment" INTEGER NOT NULL DEFAULT 0,
    "damagedStock" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Product_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Product_colorId_fkey" FOREIGN KEY ("colorId") REFERENCES "colors" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);`); } catch (error) { if (!/already exists|duplicate column name/i.test(String(error.message))) throw error; }
  try { db.exec(`INSERT INTO "new_Product" ("barcode", "brandId", "categoryId", "colorId", "costPrice", "createdAt", "id", "image", "lowStockThreshold", "model", "ram", "retailPrice", "screenSize", "sellPrice", "sku", "specs", "storage") SELECT "barcode", "brandId", "categoryId", "colorId", "costPrice", "createdAt", "id", "image", "lowStockThreshold", "model", "ram", "retailPrice", "screenSize", "sellPrice", "sku", "specs", "storage" FROM "Product";`); } catch (error) { if (!/already exists|duplicate column name/i.test(String(error.message))) throw error; }
  try { db.exec(`DROP TABLE "Product";`); } catch (error) { if (!/already exists|duplicate column name/i.test(String(error.message))) throw error; }
  try { db.exec(`ALTER TABLE "new_Product" RENAME TO "Product";`); } catch (error) { if (!/already exists|duplicate column name/i.test(String(error.message))) throw error; }
  try { db.exec(`CREATE UNIQUE INDEX "Product_sku_key" ON "Product"("sku");`); } catch (error) { if (!/already exists|duplicate column name/i.test(String(error.message))) throw error; }
  try { db.exec(`CREATE INDEX "Product_brandId_idx" ON "Product"("brandId");`); } catch (error) { if (!/already exists|duplicate column name/i.test(String(error.message))) throw error; }
  try { db.exec(`CREATE INDEX "Product_model_idx" ON "Product"("model");`); } catch (error) { if (!/already exists|duplicate column name/i.test(String(error.message))) throw error; }
  try { db.exec(`CREATE INDEX "Product_categoryId_idx" ON "Product"("categoryId");`); } catch (error) { if (!/already exists|duplicate column name/i.test(String(error.message))) throw error; }
  try { db.exec(`CREATE INDEX "Product_colorId_idx" ON "Product"("colorId");`); } catch (error) { if (!/already exists|duplicate column name/i.test(String(error.message))) throw error; }
  try { db.exec(`CREATE TABLE "new_bank_accounts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT,
    "name" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "accountNo" TEXT NOT NULL,
    "holderName" TEXT,
    "iban" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "balance" DECIMAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "bank_accounts_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "company_profiles" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);`); } catch (error) { if (!/already exists|duplicate column name/i.test(String(error.message))) throw error; }
  try { db.exec(`INSERT INTO "new_bank_accounts" ("accountNo", "active", "bankName", "companyId", "createdAt", "holderName", "iban", "id", "isDefault", "name") SELECT "accountNo", "active", "bankName", "companyId", "createdAt", "holderName", "iban", "id", "isDefault", "name" FROM "bank_accounts";`); } catch (error) { if (!/already exists|duplicate column name/i.test(String(error.message))) throw error; }
  try { db.exec(`DROP TABLE "bank_accounts";`); } catch (error) { if (!/already exists|duplicate column name/i.test(String(error.message))) throw error; }
  try { db.exec(`ALTER TABLE "new_bank_accounts" RENAME TO "bank_accounts";`); } catch (error) { if (!/already exists|duplicate column name/i.test(String(error.message))) throw error; }
  try { db.exec(`CREATE INDEX "bank_accounts_companyId_idx" ON "bank_accounts"("companyId");`); } catch (error) { if (!/already exists|duplicate column name/i.test(String(error.message))) throw error; }
  try { db.exec(`CREATE TABLE "new_categories" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'PHONE',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "parentId" TEXT,
    "defaultCashDrawerId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "categories_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "categories" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "categories_defaultCashDrawerId_fkey" FOREIGN KEY ("defaultCashDrawerId") REFERENCES "cash_drawers" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);`); } catch (error) { if (!/already exists|duplicate column name/i.test(String(error.message))) throw error; }
  try { db.exec(`INSERT INTO "new_categories" ("active", "createdAt", "id", "name", "sortOrder", "type") SELECT "active", "createdAt", "id", "name", "sortOrder", "type" FROM "categories";`); } catch (error) { if (!/already exists|duplicate column name/i.test(String(error.message))) throw error; }
  try { db.exec(`DROP TABLE "categories";`); } catch (error) { if (!/already exists|duplicate column name/i.test(String(error.message))) throw error; }
  try { db.exec(`ALTER TABLE "new_categories" RENAME TO "categories";`); } catch (error) { if (!/already exists|duplicate column name/i.test(String(error.message))) throw error; }
  try { db.exec(`CREATE UNIQUE INDEX "categories_parentId_name_key" ON "categories"("parentId", "name");`); } catch (error) { if (!/already exists|duplicate column name/i.test(String(error.message))) throw error; }
  try { db.exec(`CREATE TABLE "new_print_settings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "docType" TEXT NOT NULL,
    "format" TEXT NOT NULL DEFAULT '80',
    "options" JSONB,
    "qrType" TEXT NOT NULL DEFAULT 'whatsapp',
    "config" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);`); } catch (error) { if (!/already exists|duplicate column name/i.test(String(error.message))) throw error; }
  try { db.exec(`INSERT INTO "new_print_settings" ("config", "createdAt", "docType", "format", "id", "options", "qrType", "updatedAt") SELECT "config", "createdAt", "docType", "format", "id", "options", "qrType", "updatedAt" FROM "print_settings";`); } catch (error) { if (!/already exists|duplicate column name/i.test(String(error.message))) throw error; }
  try { db.exec(`DROP TABLE "print_settings";`); } catch (error) { if (!/already exists|duplicate column name/i.test(String(error.message))) throw error; }
  try { db.exec(`ALTER TABLE "new_print_settings" RENAME TO "print_settings";`); } catch (error) { if (!/already exists|duplicate column name/i.test(String(error.message))) throw error; }
  try { db.exec(`CREATE UNIQUE INDEX "print_settings_docType_key" ON "print_settings"("docType");`); } catch (error) { if (!/already exists|duplicate column name/i.test(String(error.message))) throw error; }
  try { db.exec(`CREATE TABLE "new_vouchers" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "amount" DECIMAL NOT NULL,
    "method" TEXT NOT NULL DEFAULT 'CASH',
    "bankAccountId" TEXT,
    "cashDrawerId" TEXT,
    "contactId" TEXT,
    "narration" TEXT,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "reversedById" TEXT,
    "reversedAt" DATETIME,
    "reversalNote" TEXT,
    "userId" TEXT NOT NULL,
    "clientRef" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "vouchers_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "bank_accounts" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "vouchers_cashDrawerId_fkey" FOREIGN KEY ("cashDrawerId") REFERENCES "cash_drawers" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "vouchers_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "vouchers_reversedById_fkey" FOREIGN KEY ("reversedById") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "vouchers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);`); } catch (error) { if (!/already exists|duplicate column name/i.test(String(error.message))) throw error; }
  try { db.exec(`INSERT INTO "new_vouchers" ("amount", "bankAccountId", "contactId", "createdAt", "date", "id", "method", "narration", "number", "reversalNote", "reversedAt", "reversedById", "status", "type", "updatedAt", "userId") SELECT "amount", "bankAccountId", "contactId", "createdAt", "date", "id", "method", "narration", "number", "reversalNote", "reversedAt", "reversedById", "status", "type", "updatedAt", "userId" FROM "vouchers";`); } catch (error) { if (!/already exists|duplicate column name/i.test(String(error.message))) throw error; }
  try { db.exec(`DROP TABLE "vouchers";`); } catch (error) { if (!/already exists|duplicate column name/i.test(String(error.message))) throw error; }
  try { db.exec(`ALTER TABLE "new_vouchers" RENAME TO "vouchers";`); } catch (error) { if (!/already exists|duplicate column name/i.test(String(error.message))) throw error; }
  try { db.exec(`CREATE UNIQUE INDEX "vouchers_number_key" ON "vouchers"("number");`); } catch (error) { if (!/already exists|duplicate column name/i.test(String(error.message))) throw error; }
  try { db.exec(`CREATE UNIQUE INDEX "vouchers_clientRef_key" ON "vouchers"("clientRef");`); } catch (error) { if (!/already exists|duplicate column name/i.test(String(error.message))) throw error; }
  try { db.exec(`CREATE INDEX "vouchers_type_date_idx" ON "vouchers"("type", "date");`); } catch (error) { if (!/already exists|duplicate column name/i.test(String(error.message))) throw error; }
  try { db.exec(`PRAGMA foreign_keys=ON;`); } catch (error) { if (!/already exists|duplicate column name/i.test(String(error.message))) throw error; }
  try { db.exec(`PRAGMA defer_foreign_keys=OFF;`); } catch (error) { if (!/already exists|duplicate column name/i.test(String(error.message))) throw error; }
  try { db.exec(`-- CreateIndex
CREATE UNIQUE INDEX "cities_name_key" ON "cities"("name");`); } catch (error) { if (!/already exists|duplicate column name/i.test(String(error.message))) throw error; }
  try { db.exec(`-- CreateIndex
CREATE UNIQUE INDEX "Bundle_sku_key" ON "Bundle"("sku");`); } catch (error) { if (!/already exists|duplicate column name/i.test(String(error.message))) throw error; }
  try { db.exec(`-- CreateIndex
CREATE INDEX "BundleItem_productId_idx" ON "BundleItem"("productId");`); } catch (error) { if (!/already exists|duplicate column name/i.test(String(error.message))) throw error; }
  try { db.exec(`-- CreateIndex
CREATE UNIQUE INDEX "BundleItem_bundleId_productId_key" ON "BundleItem"("bundleId", "productId");`); } catch (error) { if (!/already exists|duplicate column name/i.test(String(error.message))) throw error; }
  try { db.exec(`-- CreateIndex
CREATE INDEX "license_payments_licenseId_paidAt_idx" ON "license_payments"("licenseId", "paidAt");`); } catch (error) { if (!/already exists|duplicate column name/i.test(String(error.message))) throw error; }
  try { db.exec(`-- CreateIndex
CREATE INDEX "license_payments_providerRef_idx" ON "license_payments"("providerRef");`); } catch (error) { if (!/already exists|duplicate column name/i.test(String(error.message))) throw error; }
  try { db.exec(`-- CreateIndex
CREATE UNIQUE INDEX "cash_sessions_number_key" ON "cash_sessions"("number");`); } catch (error) { if (!/already exists|duplicate column name/i.test(String(error.message))) throw error; }
  try { db.exec(`-- CreateIndex
CREATE INDEX "cash_sessions_status_idx" ON "cash_sessions"("status");`); } catch (error) { if (!/already exists|duplicate column name/i.test(String(error.message))) throw error; }
  try { db.exec(`-- CreateIndex
CREATE UNIQUE INDEX "purchase_orders_number_key" ON "purchase_orders"("number");`); } catch (error) { if (!/already exists|duplicate column name/i.test(String(error.message))) throw error; }
  try { db.exec(`-- CreateIndex
CREATE INDEX "purchase_orders_status_idx" ON "purchase_orders"("status");`); } catch (error) { if (!/already exists|duplicate column name/i.test(String(error.message))) throw error; }
  try { db.exec(`-- CreateIndex
CREATE INDEX "money_movements_account_date_idx" ON "money_movements"("account", "date");`); } catch (error) { if (!/already exists|duplicate column name/i.test(String(error.message))) throw error; }
  try { db.exec(`-- CreateIndex
CREATE INDEX "money_movements_cashDrawerId_date_idx" ON "money_movements"("cashDrawerId", "date");`); } catch (error) { if (!/already exists|duplicate column name/i.test(String(error.message))) throw error; }
  try { db.exec(`-- CreateIndex
CREATE INDEX "money_movements_sourceType_sourceId_idx" ON "money_movements"("sourceType", "sourceId");`); } catch (error) { if (!/already exists|duplicate column name/i.test(String(error.message))) throw error; }
  try { db.exec(`-- CreateIndex
CREATE INDEX "Contact_cnic_idx" ON "Contact"("cnic");`); } catch (error) { if (!/already exists|duplicate column name/i.test(String(error.message))) throw error; }
  try { db.exec(`-- CreateIndex
CREATE UNIQUE INDEX "Transaction_clientRef_key" ON "Transaction"("clientRef");`); } catch (error) { if (!/already exists|duplicate column name/i.test(String(error.message))) throw error; }
};
