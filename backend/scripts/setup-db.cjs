// Prepares a brand-new SQLite database for a fresh install: creates the file
// and the migration-tracking table. The schema itself is applied by
// migrate-db.cjs (000_initial + later migrations), which is the single source
// of truth. Usage: node setup.cjs <dbPath>
const Database = require("better-sqlite3");

const dbPath = process.argv[2];
if (!dbPath) {
  console.error("Usage: node setup.cjs <dbPath>");
  process.exit(1);
}

const db = new Database(dbPath);
db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
  name TEXT PRIMARY KEY,
  appliedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);`);
db.close();
console.log("Database initialized");