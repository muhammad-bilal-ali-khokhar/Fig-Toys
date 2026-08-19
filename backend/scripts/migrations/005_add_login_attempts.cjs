// Adds the login_attempts table used for brute-force protection and
// escalating lockout. Idempotent: only creates the table when it is missing.
module.exports = function migrate(db) {
  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table'")
    .all()
    .map((r) => r.name);

  if (!tables.includes("login_attempts")) {
    db.exec(`
      CREATE TABLE "login_attempts" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "key" TEXT NOT NULL,
        "failures" INTEGER NOT NULL DEFAULT 0,
        "blockedUntil" DATETIME,
        "lastAlertedTier" INTEGER NOT NULL DEFAULT 0,
        "updatedAt" DATETIME NOT NULL
      );
      CREATE UNIQUE INDEX "login_attempts_key_key" ON "login_attempts"("key");
    `);
  }
};