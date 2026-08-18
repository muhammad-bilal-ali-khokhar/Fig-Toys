// Adds the licenses table for license activation. Idempotent: only creates the
// table when it is missing.
module.exports = function migrate(db) {
  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table'")
    .all()
    .map((r) => r.name);

  if (!tables.includes("licenses")) {
    db.exec(`
      CREATE TABLE "licenses" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "key" TEXT NOT NULL,
        "customerName" TEXT NOT NULL,
        "edition" TEXT NOT NULL DEFAULT 'PRO',
        "issuedAt" INTEGER,
        "expiresAt" DATETIME,
        "maxDevices" INTEGER NOT NULL DEFAULT 1,
        "deviceId" TEXT,
        "activatedAt" DATETIME,
        "status" TEXT NOT NULL DEFAULT 'UNLICENSED',
        "lastVerifiedAt" DATETIME
      );
    `);
  }
};