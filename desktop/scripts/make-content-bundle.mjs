import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

// Builds the content self-update bundle: zips ../production/ (backend +
// frontend) into desktop/release/production.zip and writes a typed manifest.json
// (type: content | full, contentVersion, sha256). The desktop app reads this
// manifest from the GitHub Release to decide whether an update is a content
// (in-app bundle swap, no reinstall) or full (installer) update.
//
// Type is "full" when shell files changed since the last release tag — those
// require the installer. Type is "content" when only backend/frontend changed.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const productionDir = path.join(root, "..", "production");
const outDir = path.join(root, "release");
const zipPath = path.join(outDir, "production.zip");
const manifestPath = path.join(outDir, "manifest.json");

if (!existsSync(productionDir)) {
  console.error("production/ not found; run frontend + backend build:production first.");
  process.exit(1);
}

mkdirSync(outDir, { recursive: true });

// Shell files whose change means an installer (full) update is required.
const SHELL_FILES = [
  "desktop/main.js",
  "desktop/preload.js",
  "desktop/logging.js",
  "desktop/report.js",
  "desktop/package.json",
  "desktop/electron-builder.yml",
  "desktop/package-lock.json",
  "desktop/electron.vite.config.js",
  "backend/package.json",
  "backend/package-lock.json",
  "backend/scripts/build-production.mjs",
  "frontend/package.json",
  "frontend/package-lock.json",
  "frontend/scripts/prepare-production.mjs",
];

function run(cmd, args, opts) {
  const r = spawnSync(cmd, args, { stdio: "inherit", ...opts });
  if (r.status !== 0) {
    console.error(`Command failed: ${cmd} ${args.join(" ")}`);
    process.exit(1);
  }
}

// Windows runner: PowerShell Compress-Archive for a standard zip (guaranteed
// available on windows-2022). Fall back to the `zip` binary elsewhere.
if (process.platform === "win32") {
  run("powershell", [
    "-NoProfile",
    "-Command",
    `Compress-Archive -Path '${productionDir}\\*' -DestinationPath '${zipPath}' -CompressionLevel Optimal -Force`,
  ]);
} else {
  run("zip", ["-r", "-q", zipPath, "."], { cwd: productionDir });
}

const hash = createHash("sha256");
await new Promise((resolve, reject) => {
  const s = createReadStream(zipPath);
  s.on("data", (d) => hash.update(d));
  s.on("end", resolve);
  s.on("error", reject);
});
const sha256 = hash.digest("hex");

// Determine the release type from changed files since the previous tag.
// In CI the build job checks out exactly at the new tag, so HEAD is tagged —
// `git describe --abbrev=0` returns the current tag and the diff is empty.
// Fix: when HEAD is exactly a tagged commit, use HEAD~1 to find the previous tag.
let type = "content";
const headExact = spawnSync("git", ["describe", "--tags", "--exact-match", "HEAD"], {
  encoding: "utf8",
  stdio: ["pipe", "pipe", "pipe"],
});
const describeRef = headExact.status === 0 ? "HEAD^" : "HEAD";
const lastTag = spawnSync("git", ["describe", "--tags", "--abbrev=0", describeRef], {
  encoding: "utf8",
}).stdout.trim();
if (lastTag) {
  const changed = spawnSync("git", ["diff", "--name-only", `${lastTag}..HEAD`], { encoding: "utf8" })
    .stdout.split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  const shellChanged = changed.some((f) =>
    SHELL_FILES.some((s) => f === s || f.startsWith(s + "/")),
  );
  if (shellChanged) type = "full";
}

const manifest = {
  type,
  contentVersion: sha256.slice(0, 16),
  sha256,
  createdAt: new Date().toISOString(),
};
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
console.log(`content bundle ready: ${zipPath} (type: ${type})`);
console.log(`manifest: ${JSON.stringify(manifest)}`);