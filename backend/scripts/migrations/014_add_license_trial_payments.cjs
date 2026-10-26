module.exports = function migrate(db) {
  const hasTable = (t) =>
    db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?").get(t) !== undefined;
  const hasColumn = (t, c) =>
    db.prepare(`PRAGMA table_info('${t}')`).all().some((col) => col.name === c);

  if (hasTable("licenses")) {
    if (!hasColumn("licenses", "pricePkr")) {
      db.exec(`ALTER TABLE "licenses" ADD COLUMN "pricePkr" INTEGER NOT NULL DEFAULT 5000`);
    }
    if (!hasColumn("licenses", "trialStartedAt")) {
      db.exec(`ALTER TABLE "licenses" ADD COLUMN "trialStartedAt" DATETIME`);
    }
    if (!hasColumn("licenses", "trialEndsAt")) {
      db.exec(`ALTER TABLE "licenses" ADD COLUMN "trialEndsAt" DATETIME`);
    }
    if (!hasColumn("licenses", "trialUsedAt")) {
      db.exec(`ALTER TABLE "licenses" ADD COLUMN "trialUsedAt" DATETIME`);
    }
    if (!hasColumn("licenses", "purchasedAt")) {
      db.exec(`ALTER TABLE "licenses" ADD COLUMN "purchasedAt" DATETIME`);
    }
    if (!hasColumn("licenses", "lastPaymentAt")) {
      db.exec(`ALTER TABLE "licenses" ADD COLUMN "lastPaymentAt" DATETIME`);
    }
    if (!hasColumn("licenses", "paymentRef")) {
      db.exec(`ALTER TABLE "licenses" ADD COLUMN "paymentRef" TEXT`);
    }
  }

  if (!hasTable("license_payments")) {
    db.exec(`
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
      );
    `);
  }

  db.exec(
    `CREATE INDEX IF NOT EXISTS "license_payments_licenseId_paidAt_idx" ON "license_payments"("licenseId", "paidAt")`,
  );
};
