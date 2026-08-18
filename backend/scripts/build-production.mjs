// Builds a self-contained, production-ready backend bundle into
// <repo>/production/backend:
//   server.cjs       — the whole API (Prisma runtime, Express, etc. inlined)
//   schema.sql       — CREATE TABLE statements for a fresh database
//   setup.cjs        — applies schema.sql on first launch (auto-creates the DB)
//   native/          — better-sqlite3 compiled for the current Electron ABI
//
// The database itself is NOT bundled: it is created on first server start in
// the OS user-data directory. Run `npm run rebuild` first (electron-rebuild)
// so the native module matches Electron's ABI.
import { build } from "esbuild";
import { execSync } from "node:child_process";
import { createRequire } from "node:module";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);

const dir = path.dirname(fileURLToPath(import.meta.url));
const backend = path.resolve(dir, "..");
const root = path.resolve(backend, "..");
const out = path.join(root, "production", "backend");

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

// esbuild bundles some deps (Prisma) that read import.meta.url. Replace it
// with a file URL that is valid on the CURRENT build platform so that
// fileURLToPath() never throws ERR_INVALID_FILE_URL_PATH at runtime.
const importMetaUrl =
  process.platform === "win32"
    ? "file:///C:/fig/app.cjs"
    : "file:///Users/fig/app.cjs";
const define = { "import.meta.url": `"${importMetaUrl}"` };

await build({
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node20",
  external: ["better-sqlite3"],
  define,
  logLevel: "info",
  entryPoints: [path.join(backend, "server.ts")],
  outfile: path.join(out, "server.cjs"),
});

const sql = execSync(
  "npx prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script",
  { cwd: backend, encoding: "utf8" },
);
fs.writeFileSync(path.join(out, "schema.sql"), sql);
fs.copyFileSync(path.join(dir, "setup-db.cjs"), path.join(out, "setup.cjs"));

// Incremental migrations upgrade existing databases in place (setup.cjs only
// initializes fresh DBs). Bundle the runner + migration files.
fs.copyFileSync(path.join(dir, "migrate-db.cjs"), path.join(out, "migrate-db.cjs"));
fs.cpSync(path.join(dir, "migrations"), path.join(out, "migrations"), { recursive: true });

validateSchema(sql, path.join(out, "migrations"));

// Native better-sqlite3 runtime deps (electron-builder prunes node_modules, so
// we use a plain folder resolved via NODE_PATH).
const nativeOut = path.join(out, "native");
fs.mkdirSync(nativeOut, { recursive: true });
const nm = path.join(backend, "node_modules");
const packages = ["better-sqlite3", "node-addon-api", "bindings", "file-uri-to-path", "node-gyp-build"];
for (const pkg of packages) {
  const from = path.join(nm, pkg);
  if (fs.existsSync(from)) {
    fs.cpSync(from, path.join(nativeOut, pkg), { recursive: true });
  }
}
const sqliteDir = path.join(nativeOut, "better-sqlite3");
const hasBinary =
  fs.existsSync(path.join(sqliteDir, "build", "Release")) ||
  fs.existsSync(path.join(sqliteDir, "prebuilds"));
if (!hasBinary) {
  throw new Error("better-sqlite3 has no compiled native binary — run `npm run rebuild` (electron-rebuild) first");
}

console.log("Production backend built at " + out);

// The migrations are the single source of truth for the packaged database, so
// they must produce exactly the schema that prisma/schema.prisma describes.
// This catches the classic bug where a feature is added to schema.prisma but
// its migration is forgotten (or vice versa): a fresh DB built from the
// migrations would then diverge from schema.sql and the build fails.
function validateSchema(schemaSql, migrationsDir) {
  const Database = require("better-sqlite3");
  const tmp = path.join(os.tmpdir(), `fig-schema-check-${process.pid}-${Date.now()}.db`);
  const db = new Database(tmp);
  try {
    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith(".cjs"))
      .sort();
    if (!files.includes("000_initial.cjs")) {
      throw new Error("Missing baseline migration 000_initial.cjs in the migrations folder.");
    }
    for (const file of files) {
      require(path.join(migrationsDir, file))(db);
    }

    const normalize = (s) => s.replace(/\s+/g, " ").trim();

    const migrated = db
      .prepare(
        "SELECT sql FROM sqlite_master WHERE type IN ('table','index') AND name NOT LIKE 'sqlite_%' AND name != 'schema_migrations'",
      )
      .all()
      .map((r) => normalize(r.sql || ""))
      .filter(Boolean)
      .sort()
      .join("\n");

    const expected = schemaSql
      .split(/;\s*\n/)
      .map((s) => s.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n"))
      .map(normalize)
      .filter(Boolean)
      .sort()
      .join("\n");

    if (migrated !== expected) {
      throw new Error(
        "SCHEMA MISMATCH: running all migrations does not produce the same schema as prisma/schema.prisma. " +
          "If you changed the Prisma schema, add a new numbered migration (e.g. migrations/00X_your_feature.cjs) " +
          "that applies the same change, then rebuild.",
      );
    }
  } finally {
    try {
      db.close();
    } catch {
      /* ignore */
    }
    fs.rmSync(tmp, { force: true });
  }
  console.log("Migrations match schema.prisma — OK");
}