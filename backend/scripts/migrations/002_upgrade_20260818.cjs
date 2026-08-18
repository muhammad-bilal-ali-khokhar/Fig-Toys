// Brings older installs up to the current schema. Idempotent: each step only
// runs when the table/column is missing.
module.exports = function migrate(db) {
  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table'")
    .all()
    .map((r) => r.name);

  const hasTable = (t) => tables.includes(t);
  const hasColumn = (t, c) =>
    db.prepare(`PRAGMA table_info('${t}')`).all().some((col) => col.name === c);

  if (!hasTable("print_settings")) {
    db.exec(`
      CREATE TABLE "print_settings" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "docType" TEXT NOT NULL,
        "format" TEXT NOT NULL DEFAULT '80',
        "options" TEXT,
        "qrType" TEXT NOT NULL DEFAULT 'whatsapp',
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL
      );
      CREATE UNIQUE INDEX "print_settings_docType_key" ON "print_settings"("docType");
    `);
  }

  if (hasTable("purchase_orders")) {
    if (!hasColumn("purchase_orders", "advance")) {
      db.exec(`ALTER TABLE "purchase_orders" ADD COLUMN "advance" DECIMAL NOT NULL DEFAULT 0`);
    }
    if (!hasColumn("purchase_orders", "advanceMethod")) {
      db.exec(`ALTER TABLE "purchase_orders" ADD COLUMN "advanceMethod" TEXT`);
    }
    if (!hasColumn("purchase_orders", "advanceBankAccountId")) {
      db.exec(`ALTER TABLE "purchase_orders" ADD COLUMN "advanceBankAccountId" TEXT`);
    }
  }
};
