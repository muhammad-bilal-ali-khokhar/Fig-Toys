// Adds the event_logs table for storing runtime / diagnostic events reported
// silently by the frontend, backend and desktop app.
// Idempotent: only creates the table when it is missing.
module.exports = function migrate(db) {
  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table'")
    .all()
    .map((r) => r.name);

  if (!tables.includes("event_logs")) {
    db.exec(`
      CREATE TABLE "event_logs" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "source" TEXT NOT NULL,
        "level" TEXT NOT NULL,
        "type" TEXT NOT NULL,
        "message" TEXT NOT NULL,
        "detail" TEXT,
        "meta" TEXT,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
  }
};