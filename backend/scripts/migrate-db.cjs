// Applies incremental database migrations so existing installs upgrade in place
// without losing data. Migrations are the single source of truth: a fresh
// database runs 000_initial (the baseline) followed by every later migration,
// and existing databases apply only the ones not yet recorded in
// schema_migrations.
//
// A database created before this system already has the baseline schema but no
// 000_initial row, so the baseline is "adopted" (recorded as applied without
// re-running it) rather than re-created. Before any pending migration runs the
// database is backed up, and after they all succeed an integrity check runs, so
// a failed migration can never silently destroy a shop's data.
//
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

const BASELINE = "000_initial.cjs";

function tableExists(db, name) {
  return (
    db
      .prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name = ? LIMIT 1")
      .get(name) !== undefined
  );
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

// Pre-existing databases already contain the baseline schema (plus anything
// later migrations added) but have no 000_initial row. Adopt the baseline by
// recording it without re-running it, so future migrations run cleanly.
if (files.includes(BASELINE) && !applied.has(BASELINE) && tableExists(db, "users")) {
  db.prepare("INSERT INTO schema_migrations (name) VALUES (?)").run(BASELINE);
  applied.add(BASELINE);
  console.log(`Adopted baseline (${BASELINE}) for an existing database.`);
}

const pending = files.filter((f) => !applied.has(f));
if (pending.length === 0) {
  db.close();
  console.log("Database migrations up to date");
  process.exit(0);
}

// Close and back up before touching anything. Copying while the DB is open can
// fail on Windows (file lock), and we never want a bad migration to be the only
// copy of a shop's data.
db.close();
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const backupPath = `${dbPath}.pre-migrate-${stamp}.bak`;
fs.copyFileSync(dbPath, backupPath);
console.log(`Backed up database before migrating: ${backupPath}`);

const db2 = new Database(dbPath);
const apply = db2.transaction((file) => {
  require(path.join(migrationsDir, file))(db2);
  db2.prepare("INSERT INTO schema_migrations (name) VALUES (?)").run(file);
});

for (const file of pending) {
  try {
    apply(file);
    console.log(`Applied migration: ${file}`);
  } catch (err) {
    console.error(`Migration failed: ${file}`);
    console.error(err);
    console.error(`A backup was taken before migrating: ${backupPath}`);
    process.exit(1);
  }
}

// Verify structural integrity after migrating so corruption is caught early.
const integrity = db2.pragma("integrity_check", { simple: true });
db2.close();
if (integrity !== "ok") {
  console.error(`Database integrity check failed after migration: ${integrity}`);
  console.error(`Restore from backup: ${backupPath}`);
  process.exit(1);
}

console.log("Database migrations up to date");