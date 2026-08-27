module.exports = function migrate(db) {
  const hasTable = (t) =>
    db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?").get(t) !== undefined;
  const hasColumn = (t, c) =>
    db.prepare(`PRAGMA table_info('${t}')`).all().some((col) => col.name === c);

  if (!hasTable("cash_drawers")) {
    db.exec(`
      CREATE TABLE "cash_drawers" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "name" TEXT NOT NULL,
        "isDefault" BOOLEAN NOT NULL DEFAULT false,
        "active" BOOLEAN NOT NULL DEFAULT true,
        "balance" DECIMAL NOT NULL DEFAULT 0,
        "sortOrder" INTEGER NOT NULL DEFAULT 0,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
  }

  if (!hasColumn("categories", "defaultCashDrawerId")) {
    db.exec(`ALTER TABLE "categories" ADD COLUMN "defaultCashDrawerId" TEXT REFERENCES "cash_drawers" ("id") ON DELETE SET NULL ON UPDATE CASCADE`);
  }
  if (!hasColumn("Payment", "cashDrawerId")) {
    db.exec(`ALTER TABLE "Payment" ADD COLUMN "cashDrawerId" TEXT REFERENCES "cash_drawers" ("id") ON DELETE SET NULL ON UPDATE CASCADE`);
  }
  if (!hasColumn("money_movements", "cashDrawerId")) {
    db.exec(`ALTER TABLE "money_movements" ADD COLUMN "cashDrawerId" TEXT REFERENCES "cash_drawers" ("id") ON DELETE SET NULL ON UPDATE CASCADE`);
  }
  if (!hasColumn("Expense", "cashDrawerId")) {
    db.exec(`ALTER TABLE "Expense" ADD COLUMN "cashDrawerId" TEXT REFERENCES "cash_drawers" ("id") ON DELETE SET NULL ON UPDATE CASCADE`);
  }
  if (!hasColumn("vouchers", "cashDrawerId")) {
    db.exec(`ALTER TABLE "vouchers" ADD COLUMN "cashDrawerId" TEXT REFERENCES "cash_drawers" ("id") ON DELETE SET NULL ON UPDATE CASCADE`);
  }

  if (!hasColumn("money_movements", "cashDrawerId")) {
    try {
      db.exec(`CREATE INDEX IF NOT EXISTS "money_movements_cashDrawerId_date_idx" ON "money_movements"("cashDrawerId", "date")`);
    } catch {}
  }

  const count = db.prepare("SELECT COUNT(*) as c FROM cash_drawers").get().c;
  if (count === 0) {
    let balance = 0;
    try {
      const row = db.prepare("SELECT balance FROM cash_accounts WHERE id = 'main'").get();
      if (row && row.balance != null) balance = Number(row.balance);
    } catch {}
    const id = "drawer_main";
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO cash_drawers (id, name, isDefault, active, balance, sortOrder, createdAt) VALUES (?, ?, 1, 1, ?, 0, ?)`
    ).run(id, "Main Drawer", balance, now);

    try {
      db.exec(`UPDATE "money_movements" SET "cashDrawerId" = '${id}' WHERE "account" = 'cash' AND ("cashDrawerId" IS NULL OR "cashDrawerId" = '')`);
    } catch {}
    try {
      db.exec(`UPDATE "Payment" SET "cashDrawerId" = '${id}' WHERE "method" = 'CASH' AND ("cashDrawerId" IS NULL OR "cashDrawerId" = '')`);
    } catch {}
    try {
      db.exec(`UPDATE "vouchers" SET "cashDrawerId" = '${id}' WHERE "method" = 'CASH' AND ("cashDrawerId" IS NULL OR "cashDrawerId" = '')`);
    } catch {}
    try {
      db.exec(`UPDATE "Expense" SET "cashDrawerId" = '${id}' WHERE ("cashDrawerId" IS NULL OR "cashDrawerId" = '')`);
    } catch {}
  }
};
