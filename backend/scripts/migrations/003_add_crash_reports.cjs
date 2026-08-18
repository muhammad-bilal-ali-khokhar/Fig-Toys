// Adds the crash_reports table for storing desktop crash reports locally.
// Idempotent: only creates the table when it is missing.
module.exports = function migrate(db) {
  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table'")
    .all()
    .map((r) => r.name);

  if (!tables.includes("crash_reports")) {
    db.exec(`
      CREATE TABLE "crash_reports" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "app" TEXT NOT NULL,
        "version" TEXT,
        "platform" TEXT,
        "message" TEXT NOT NULL,
        "stack" TEXT,
        "context" TEXT,
        "githubIssueUrl" TEXT,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
  }
};