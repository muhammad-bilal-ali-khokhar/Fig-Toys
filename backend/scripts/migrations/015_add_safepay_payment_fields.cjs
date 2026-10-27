module.exports = function migrate(db) {
  const hasColumn = (t, c) =>
    db.prepare(`PRAGMA table_info('${t}')`).all().some((col) => col.name === c);

  if (!hasColumn("license_payments", "status")) {
    db.exec(`ALTER TABLE "license_payments" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'PAID'`);
  }
  if (!hasColumn("license_payments", "provider")) {
    db.exec(`ALTER TABLE "license_payments" ADD COLUMN "provider" TEXT NOT NULL DEFAULT 'MANUAL'`);
  }
  if (!hasColumn("license_payments", "providerRef")) {
    db.exec(`ALTER TABLE "license_payments" ADD COLUMN "providerRef" TEXT`);
  }
  if (!hasColumn("license_payments", "checkoutUrl")) {
    db.exec(`ALTER TABLE "license_payments" ADD COLUMN "checkoutUrl" TEXT`);
  }
  if (!hasColumn("license_payments", "rawState")) {
    db.exec(`ALTER TABLE "license_payments" ADD COLUMN "rawState" TEXT`);
  }
  if (!hasColumn("license_payments", "verifiedAt")) {
    db.exec(`ALTER TABLE "license_payments" ADD COLUMN "verifiedAt" DATETIME`);
  }

  db.exec(
    `CREATE INDEX IF NOT EXISTS "license_payments_providerRef_idx" ON "license_payments"("providerRef")`,
  );
};
