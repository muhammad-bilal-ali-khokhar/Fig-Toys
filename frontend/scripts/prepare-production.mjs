// Prepares a self-contained, production-ready frontend bundle into
// <repo>/production/frontend from the Next.js standalone output:
//   server.js         — the standalone Next server
//   deps/             — node_modules renamed so electron-builder keeps it
//   .next/static/     — static assets (JS/CSS chunks)
//   public/           — public files
//
// Run `npm run build` (in frontend/) first, with BACKEND_URL pointing at the
// backend the app spawns (http://localhost:47620).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
const frontend = path.resolve(dir, "..");
const root = path.resolve(frontend, "..");
const src = path.join(frontend, ".next", "standalone");
const out = path.join(root, "production", "frontend");

if (!fs.existsSync(src)) {
  throw new Error(`Standalone output missing at ${src} — run 'npm run build' first`);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function renameWithRetry(from, to, attempts = 10) {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      fs.renameSync(from, to);
      return;
    } catch (err) {
      if (attempt === attempts) {
        console.warn(
          `rename failed after ${attempts} attempts (${err.code ?? err.message}) — falling back to copy`
        );
        break;
      }
      await sleep(250 * attempt);
    }
  }
  fs.cpSync(from, to, { recursive: true });
  fs.rmSync(from, { recursive: true, force: true, maxRetries: 10, retryDelay: 250 });
}

fs.rmSync(out, { recursive: true, force: true, maxRetries: 10, retryDelay: 250 });
fs.cpSync(src, out, { recursive: true });

// Bring static + public into the bundle so it is fully self-contained.
const staticSrc = path.join(frontend, ".next", "static");
if (fs.existsSync(staticSrc)) {
  fs.cpSync(staticSrc, path.join(out, ".next", "static"), { recursive: true });
}
const publicSrc = path.join(frontend, "public");
if (fs.existsSync(publicSrc)) {
  fs.cpSync(publicSrc, path.join(out, "public"), { recursive: true });
}

const nm = path.join(out, "node_modules");
const deps = path.join(out, "deps");
if (fs.existsSync(nm)) {
  await renameWithRetry(nm, deps);
}

if (fs.existsSync(deps)) {
  const prunePaths = [
    path.join(deps, "typescript"),
    path.join(deps, "caniuse-lite"),
    path.join(deps, "@img", "sharp-darwin-arm64"),
    path.join(deps, "@img", "sharp-libvips-darwin-arm64"),
    path.join(deps, "@img", "sharp-libvips-darwin-x64"),
    path.join(deps, "@img", "sharp-wasm32"),
    path.join(deps, "@img", "sharp-libvips-linux-arm64"),
    path.join(deps, "@img", "sharp-libvips-linux-arm"),
    path.join(deps, "@img", "sharp-libvips-linuxmusl-arm64"),
    path.join(deps, "@img", "sharp-linux-arm64"),
    path.join(deps, "@img", "sharp-linuxmusl-arm64"),
  ];
  let prunedBytes = 0;
  for (const p of prunePaths) {
    if (fs.existsSync(p)) {
      try {
        const stat = fs.statSync(p);
        if (stat.isDirectory()) {
          const du = (dir) => {
            let s = 0;
            for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
              const full = path.join(dir, e.name);
              if (e.isDirectory()) s += du(full);
              else try { s += fs.statSync(full).size; } catch {}
            }
            return s;
          };
          prunedBytes += du(p);
        } else prunedBytes += stat.size;
      } catch {}
      fs.rmSync(p, { recursive: true, force: true, maxRetries: 5, retryDelay: 250 });
    }
  }
  if (prunedBytes > 0) {
    console.log(`Pruned ${(prunedBytes / (1024 * 1024)).toFixed(1)} MB of unused deps (typescript, darwin/wasm sharp).`);
  }
  const left = fs.readdirSync(path.join(deps, "@img")).filter((n) => n.startsWith("sharp")).join(", ");
  console.log(`Remaining @img/sharp variants: ${left || "(none)"}`);
}

console.log("Production frontend built at " + out);