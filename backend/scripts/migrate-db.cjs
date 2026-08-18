// Applies incremental database migrations idempotently so existing installs
// upgrade in place without losing data (a fresh DB is still created from
// schema.sql, then migrations are a no-op because schema.sql is current).
// Usage: node migrate-db.cjs <dbPath> <migrationsDir>
const fs = require("node:fs");
const path = require("node:path");
const Database = require("better-sqlite3");

const dbPath = process.argv[2];
const migrationsDir = process.argv[3];
if (!dbPath || !migrationsDir) {
  console.error("Usage: node migrate-db.cjs <dbPath> <migrationsDir>");
  process.exit(1);
}

const db = new Database(dbPath);
db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
  name TEXT PRIMARY KEY,
  appliedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);`);

const applied = new Set(
  db.prepare("SELECT name FROM schema_migrations").all().map((r) => r.name),
);

let files = [];
try {
  files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".cjs"))
    .sort();
} catch (err) {
  if (err.code !== "ENOENT") throw err;
}

const apply = db.transaction((file) => {
  require(path.join(migrationsDir, file))(db);
  db.prepare("INSERT INTO schema_migrations (name) VALUES (?)").run(file);
});

for (const file of files) {
  if (applied.has(file)) continue;
  try {
    apply(file);
    console.log(`Applied migration: ${file}`);
  } catch (err) {
    console.error(`Migration failed: ${file}`);
    console.error(err);
    process.exit(1);
  }
}

db.close();
console.log("Database migrations up to date");