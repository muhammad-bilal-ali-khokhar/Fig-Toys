// Adds the banks table: the master list of bank names offered in the bank
// account form. Idempotent: only creates the table when it is missing.
module.exports = function migrate(db) {
  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table'")
    .all()
    .map((r) => r.name);

  if (!tables.includes("banks")) {
    db.exec(`
      CREATE TABLE "banks" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "name" TEXT NOT NULL,
        "sortOrder" INTEGER NOT NULL DEFAULT 0,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      CREATE UNIQUE INDEX "banks_name_key" ON "banks"("name");
    `);
  }
};
