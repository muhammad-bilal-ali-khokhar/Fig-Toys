import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

// Builds the content self-update bundle: zips ../production/ (backend +
// frontend) into desktop/release/production.zip and writes a manifest.json with
// its contentVersion + sha256. The desktop app fetches these from the GitHub
// Release to update backend/frontend without reinstalling the Electron shell.

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

// Windows runner: use PowerShell Compress-Archive for a standard zip (guaranteed
// available on windows-2022). Fall back to the `zip` binary elsewhere.
const onWin = process.platform === "win32";
let result;
if (onWin) {
  result = spawnSync("powershell", [
    "-NoProfile",
    "-Command",
    `Compress-Archive -Path '${productionDir}\\*' -DestinationPath '${zipPath}' -CompressionLevel Optimal -Force`,
  ], { stdio: "inherit" });
} else {
  result = spawnSync("zip", ["-r", "-q", zipPath, "."], {
    cwd: productionDir,
    stdio: "inherit",
  });
}
if (result.status !== 0) {
  console.error("Failed to create production.zip");
  process.exit(1);
}

const hash = createHash("sha256");
await new Promise((resolve, reject) => {
  const s = createReadStream(zipPath);
  s.on("data", (d) => hash.update(d));
  s.on("end", resolve);
  s.on("error", reject);
});
const sha256 = hash.digest("hex");

// contentVersion is derived from the hash so it only changes when the bundle
// actually changes (no spurious re-downloads on same-content releases).
const manifest = {
  contentVersion: sha256.slice(0, 16),
  sha256,
  createdAt: new Date().toISOString(),
};
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
console.log(`content bundle ready: ${zipPath}`);
console.log(`manifest: ${JSON.stringify(manifest)}`);