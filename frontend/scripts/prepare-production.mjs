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

console.log("Production frontend built at " + out);