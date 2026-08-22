"use strict";

const { app, BrowserWindow, clipboard, dialog, ipcMain, Menu, session, shell } = require("electron");
const { spawn } = require("node:child_process");
const { randomBytes } = require("node:crypto");
const fs = require("node:fs");
const http = require("node:http");
const net = require("node:net");
const path = require("node:path");
const logging = require("./logging");
const report = require("./report");

app.setName("Fig POS for Mobile Phones");

const ROOT = path.resolve(__dirname, "..");
const APP_ICON =
  process.platform === "darwin"
    ? path.join(__dirname, "build", "icon.iconset", "icon_512x512.png")
    : path.join(__dirname, "build", "icon.ico");
const PROD_DIR = path.join(ROOT, "production");
const PROD_BACKEND = path.join(PROD_DIR, "backend");
const PROD_FRONTEND = path.join(PROD_DIR, "frontend");
const SRC_BACKEND = path.join(ROOT, "backend");
const SRC_FRONTEND = path.join(ROOT, "frontend");

function backendDir() {
  return fs.existsSync(path.join(PROD_BACKEND, "server.cjs")) ? PROD_BACKEND : SRC_BACKEND;
}
function frontendDir() {
  return fs.existsSync(path.join(PROD_FRONTEND, "server.js")) ? PROD_FRONTEND : SRC_FRONTEND;
}
function bundleBackendDir() {
  return PROD_BACKEND;
}
function nativeDir() {
  return path.join(PROD_BACKEND, "native");
}

const DEV_ATTACH = process.argv.includes("--dev");

// Local-mode servers bind to a single high, obscure 5-digit port each. The
// ranges were chosen because almost nothing else binds there, and the port is
// stable so localStorage (scoped to host:port) survives restarts — the desktop
// gate cookie rejects direct browser access instead. If the port is already in
// use we fail loudly rather than silently shifting (which would confuse the
// app's other consumers of the resolved port).
const BACKEND_PORT = Number(process.env.FIG_BACKEND_PORT || 47620);
const FRONTEND_PORT = Number(process.env.FIG_FRONTEND_PORT || 58340);

// External service URLs. These are public endpoints, not secrets, so they are
// safe to ship with the app — this keeps them working in packaged builds where
// no .env file or env var is present.
const URLS = {
  downloadBase: "https://download.myko.pk",
  changelog: "https://github.com/arsalanwahab/Fig-POS/releases/latest",
  licenseRedeem: "https://fiery-panda-147.convex.site/redeem",
};

// Returns true if nothing is listening on <port>. The backend/frontend bind to
// "localhost", which resolves to ::1 (IPv6) before 127.0.0.1 (IPv4) on most
// systems, so we must probe both families or a ::1-only listener slips through
// the check and the child then crashes with EADDRINUSE.
function isPortFree(port) {
  return new Promise((resolve) => {
    let free = 0;
    const expected = 2;
    const done = () => {
      if (++free >= expected) resolve(true);
    };
    const fail = () => resolve(false);
    for (const host of ["127.0.0.1", "::1"]) {
      const server = net.createServer();
      server.once("error", fail);
      server.once("listening", () => server.close(done));
      try {
        server.listen(port, host);
      } catch {
        fail();
      }
    }
  });
}

// The backend/frontend we spawn are separate node processes. If the app is
// killed hard (SIGINT, crash, force-quit) they can outlive it and keep the
// ports bound, so the next launch hits EADDRINUSE. The single-instance lock
// guarantees at most one app instance, so any process still holding one of our
// local ports is an orphan from a previous run — kill it before the port check.
async function reapPortOrphans() {
  const { execFile } = require("node:child_process");
  const markers = ["server.cjs", "tsx", "next-server", path.sep + "frontend" + path.sep, "standalone"];
  const isOurs = (cmdline) => cmdline && markers.some((m) => cmdline.includes(m));

  for (const port of [BACKEND_PORT, FRONTEND_PORT]) {
    let pids = [];
    try {
      if (process.platform === "win32") {
        const out = await new Promise((resolve, reject) =>
          execFile("netstat", ["-ano", "-p", "tcp"], (err, stdout) => (err ? reject(err) : resolve(stdout))));
        for (const line of out.split("\n")) {
          if (line.includes(`:${port}`) && /\sLISTENING\s/.test(line)) {
            const pid = line.trim().split(/\s+/).pop();
            if (/^\d+$/.test(pid)) pids.push(pid);
          }
        }
      } else {
        const out = await new Promise((resolve, reject) =>
          execFile("lsof", ["-ti", `tcp:${port}`], (err, stdout, stderr) =>
            err ? (err.code === 1 ? resolve("") : reject(err)) : resolve(stdout)));
        pids = out.split("\n").filter(Boolean);
      }
    } catch {
      continue;
    }

    for (const pid of pids) {
      let cmdline = "";
      try {
        if (process.platform === "win32") {
          cmdline = await new Promise((resolve) =>
            execFile("wmic", ["process", "where", `processid=${pid}`, "get", "commandline", "/value"], (err, stdout) => resolve(stdout || "")));
        } else {
          cmdline = await new Promise((resolve) =>
            execFile("ps", ["-p", pid, "-o", "command="], (err, stdout) => resolve(stdout || "")));
        }
      } catch {
        continue;
      }
      if (isOurs(cmdline)) {
        try {
          process.kill(Number(pid), "SIGKILL");
          logging.write(`Reaped orphaned process on port ${port} (pid ${pid})`);
        } catch {
          /* already gone */
        }
      }
    }
  }
}

const DEFAULT_RUNTIME = { mode: "local", hostedUrl: "", theme: "fig", report: { enabled: true, backendUrl: "", secret: "" } };

const children = new Set();
let mainWindow = null;
let aboutWindow = null;

// Per-launch secret used to gate the local frontend: the main process sets it
// as a cookie on the server origin before the window loads, and the server
// (Next middleware) rejects any request that doesn't carry it. This lets the
// Electron window in while blocking a plain browser on the same machine.
let desktopSecret = null;
function getDesktopSecret() {
  if (!desktopSecret) desktopSecret = randomBytes(16).toString("hex");
  return desktopSecret;
}

// ---------------------------------------------------------------------------
// OTA self-update via Cloudflare R2. Fetches latest.json from the same R2
// bucket used for content updates, compares versions, downloads the installer,
// and installs on quit. State is tracked here so the Settings → Update panel
// can show current version, check for updates, and trigger download/install.
// ---------------------------------------------------------------------------
const updateState = {
  available: false,
  checking: false,
  downloading: false,
  downloaded: false,
  version: "",
  releaseNotes: "",
  progress: 0,
  error: "",
  installerPath: "",
};

function updateSnapshot() {
  return {
    currentVersion: app.getVersion(),
    available: updateState.available,
    checking: updateState.checking,
    downloading: updateState.downloading,
    downloaded: updateState.downloaded,
    version: updateState.version,
    releaseNotes: updateState.releaseNotes,
    progress: updateState.progress,
    error: updateState.error,
  };
}

function pushUpdateState() {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send("update:status", updateSnapshot());
  }
}

function isNewerVersion(remote, local) {
  const rp = remote.split(".").map(Number);
  const lp = local.split(".").map(Number);
  for (let i = 0; i < Math.max(rp.length, lp.length); i++) {
    const r = rp[i] || 0;
    const l = lp[i] || 0;
    if (r > l) return true;
    if (r < l) return false;
  }
  return false;
}

async function fetchLatestManifest() {
  const res = await fetch(`${URLS.downloadBase}/latest.json`, {
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.json();
}

function checkForUpdates() {
  if (process.platform !== "win32") return;
  updateState.checking = true;
  updateState.error = "";
  pushUpdateState();

  fetchLatestManifest().then((manifest) => {
    if (!manifest || !manifest.version) return;
    if (!isNewerVersion(manifest.version, app.getVersion())) {
      updateState.available = false;
      updateState.version = "";
      logging.write("OTA: no update available.");
      return;
    }
    updateState.available = true;
    updateState.version = manifest.version;
    updateState.releaseNotes = manifest.description || "";
    logging.write(`OTA: update available (${manifest.version}). Manual download required via Settings → Update.`);
  }).catch((err) => {
    updateState.error = err && err.message ? err.message : String(err);
    logging.error(`OTA: check failed: ${updateState.error}`);
  }).finally(() => {
    updateState.checking = false;
    pushUpdateState();
  });
}

async function downloadUpdate(manifest) {
  if (updateState.downloading || updateState.downloaded) return;
  if (!manifest) {
    try { manifest = await fetchLatestManifest(); } catch { return; }
  }
  if (!manifest.url || !manifest.url.setup) return;

  updateState.downloading = true;
  updateState.progress = 0;
  pushUpdateState();

  let dest = "";
  try {
    const tmpDir = path.join(app.getPath("temp"), "fig-pos-update");
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    const setupName = (manifest.url.setup.split("/").pop() || `Fig-POS-Setup-${manifest.version}.exe`).split("?")[0];
    dest = path.join(tmpDir, setupName);

    const res = await fetch(manifest.url.setup, { signal: AbortSignal.timeout(300000) });
    if (!res.ok || !res.body) throw new Error(`Download failed: HTTP ${res.status}`);

    const total = Number(res.headers.get("content-length") || 0);
    let received = 0;
    const file = fs.createWriteStream(dest);
    const reader = res.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      file.write(Buffer.from(value));
      if (total) {
        const pct = Math.round((received / total) * 100);
        if (pct !== updateState.progress) {
          updateState.progress = pct;
          pushUpdateState();
        }
      } else {
        const mb = (received / (1024 * 1024)).toFixed(1);
        if (received % (2 * 1024 * 1024) < 65536) {
          logging.write(`OTA: downloading… ${mb} MB`);
        }
      }
    }
    await new Promise((resolve, reject) => file.end((err) => (err ? reject(err) : resolve())));

    updateState.installerPath = dest;
    updateState.downloading = false;
    updateState.downloaded = true;
    updateState.progress = 100;
    logging.write(`OTA: update ${manifest.version} downloaded — will install on quit.`);
    pushUpdateState();

    try {
      dialog.showMessageBox(mainWindow, {
        type: "info",
        buttons: ["Restart & update now", "Later"],
        defaultId: 0,
        cancelId: 1,
        title: "Fig POS — Update ready",
        message: `Version ${manifest.version} is ready to install.`,
        detail: "Restart now to apply the update, or choose Later to install it the next time you quit the app.",
      }).then(({ response }) => {
        if (response === 0) installUpdate();
      }).catch(() => {});
    } catch (e) {
      logging.error("OTA: could not show update dialog: " + e.message);
    }
  } catch (err) {
    updateState.downloading = false;
    updateState.error = err && err.message ? err.message : String(err);
    logging.error("OTA: download failed: " + updateState.error);
    try { if (dest && fs.existsSync(dest)) fs.rmSync(dest, { force: true }); } catch {}
    pushUpdateState();
  }
}

function installUpdate() {
  if (!updateState.installerPath || !fs.existsSync(updateState.installerPath)) return;
  const { exec } = require("node:child_process");
  try {
    const win = new BrowserWindow({
      width: 420,
      height: 200,
      resizable: false,
      minimizable: false,
      maximizable: false,
      frame: false,
      transparent: true,
      hasShadow: false,
      alwaysOnTop: true,
      backgroundColor: "#00000000",
      webPreferences: { contextIsolation: true, sandbox: true },
    });
    win.loadURL(
      `data:text/html,${encodeURIComponent(`<html><head><meta charset="UTF-8"><style>html,body{margin:0;height:100%;background:transparent;font-family:Montserrat,system-ui,sans-serif} .card{margin:20px;background:#fff;border-radius:20px;padding:24px;box-shadow:0 20px 40px rgba(0,0,0,0.15);text-align:center} .spinner{width:28px;height:28px;border:3px solid #f3efe7;border-top-color:#9b3f68;border-radius:50%;animation:spin .7s linear infinite;margin:0 auto 12px} @keyframes spin{to{transform:rotate(360deg)}} h1{margin:0;font-size:15px;color:#1c1916} p{margin:6px 0 0;font-size:12px;color:#7d7467}</style></head><body><div class="card"><div class="spinner"></div><h1>Installing update v${updateState.version || ""}…</h1><p>The app will restart automatically. Please wait.</p></div></body></html>`)}`,
    );
    win.show();
    setTimeout(() => {
      exec(`"${updateState.installerPath}" /S`, () => {});
      setTimeout(() => app.quit(), 600);
    }, 900);
    return;
  } catch {}
  exec(`"${updateState.installerPath}" /S`, () => {});
  app.quit();
}

// ---------------------------------------------------------------------------
// Single update channel: full installer only (no frontend/backend delta zips).

// ---------------------------------------------------------------------------
// Logging + crash surfacing. Everything is written to a log file in the
// user-data dir so a packaged app can always explain *why* it failed even
// though there is no terminal on Windows.
// ---------------------------------------------------------------------------
try {
  logging.init(path.join(userDataDir(), "logs"));
} catch {
  /* userData not ready yet */
}

function systemInfo() {
  return [
    `App version: ${app.getVersion()}`,
    `Electron: ${process.versions.electron || "?"}`,
    `Node: ${process.versions.node}`,
    `Platform: ${process.platform} ${process.arch}`,
    `OS: ${process.getSystemVersion ? process.getSystemVersion() : process.platform}`,
  ].join("\n");
}

function buildReport(err) {
  const body =
    `${systemInfo()}\n\n` +
    `## Error\n\n\`\`\`\n${err && err.stack ? err.stack : err}\n\`\`\`\n\n` +
    `## Last log lines\n\n\`\`\`\n${logging.tail(150).join("\n")}\n\`\`\`\n`;
  return body;
}

function buildManualReport() {
  const lastErr = lastErrorDetail ? `\n\n## Last reported error\n\n\`\`\`\n${lastErrorDetail}\n\`\`\`\n` : "";
  return (
    `${systemInfo()}\n\n` +
    `## Description\n\nManual crash report sent from the Settings screen.\n` +
    lastErr +
    `\n## Last log lines\n\n\`\`\`\n${logging.tail(150).join("\n")}\n\`\`\`\n`
  );
}

// Send a crash report to the backend, which forwards it to GitHub Issues
// server-side (the GitHub token never ships with the app). Opt-in via Settings.
// Fire-and-forget and fully silent — the user is never told an Issue was opened.
function sendReport(title, err) {
  const cfg = loadRuntime();
  if (!cfg.report || !cfg.report.enabled) return;
  sendReportNow(`[Crash] ${title}`, err).catch((e) => logging.write(`[report] failed (silent): ${e.message}`));
}

// Attempts a crash report regardless of the enabled flag and returns the result
// so callers (e.g. the manual "Send crash report" button) can surface success or
// failure. Resolves to { ok, url }.
async function sendReportNow(title, err) {
  const cfg = loadRuntime();
  const backendUrl = (cfg.report && cfg.report.backendUrl) || `http://localhost:${BACKEND_PORT}`;
  const res = await report.submit({
    cfg: { ...(cfg.report || {}), backendUrl },
    title,
    body: err ? buildReport(err) : buildManualReport(),
    meta: {
      version: app.getVersion(),
      platform: `${process.platform} ${process.arch}`,
      logTail: logging.tail(50).join("\n"),
    },
  });
  return { ok: true, url: res.url };
}

// Store the latest error so the error window can fetch it and let the user copy it.
let lastErrorDetail = "";
let lastErrorTitle = "Fig POS for Mobile Phones encountered an error";

// Show a small window with the error, selectable text, and a Copy button — the
// OS dialog's text is not copyable. A crash report is sent first (silently).
function fatalDialog(title, err) {
  sendReport(title, err);
  lastErrorTitle = title || "Fig POS for Mobile Phones encountered an error";
  const logPath = logging.getPath();
  lastErrorDetail =
    `${String(err && err.stack ? err.stack : err)}\n\n` +
    `Log file: ${logPath}\n\n--- last ${50} log lines ---\n${logging.tail(50).join("\n")}`;
  try {
    const win = new BrowserWindow({
      width: 560,
      height: 480,
      resizable: true,
      title: "Fig POS for Mobile Phones. Error",
      backgroundColor: "#f6f5f2",
      webPreferences: {
        preload: path.join(__dirname, "preload.js"),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });
    win.loadFile(path.join(__dirname, "error.html"), { query: { t: encodeURIComponent(lastErrorTitle) } });
  } catch {
    /* ignore */
  }
}

process.on("uncaughtException", (err) => {
  logging.error("Uncaught exception: " + (err && err.stack ? err.stack : err));
  fatalDialog("Fig POS for Mobile Phones crashed", err);
  app.exit(1);
});

process.on("unhandledRejection", (reason) => {
  logging.error("Unhandled rejection: " + (reason && reason.stack ? reason.stack : reason));
});

// ---------------------------------------------------------------------------
// Runtime config (local server vs hosted URL), stored in the user data dir so
// it can be switched at runtime from Settings.
// ---------------------------------------------------------------------------
const LEGACY_APP_DATA_DIR = path.join("C:\\Wavlon Studio", "Fig POS");

function userDataDir() {
  return app.getPath("userData");
}

function migrateLegacyDataDir() {
  if (process.platform !== "win32") return;
  const legacy = LEGACY_APP_DATA_DIR;
  const next = userDataDir();
  if (legacy === next) return;
  if (!fs.existsSync(legacy)) return;
  const hasNewData = fs.existsSync(path.join(next, "data", "fig.db")) || fs.existsSync(path.join(next, "fig-runtime.json"));
  if (hasNewData) return;
  try {
    fs.mkdirSync(next, { recursive: true });
    const entries = fs.readdirSync(legacy);
    for (const name of entries) {
      if (name === "data" || name === "logs" || name === "fig-runtime.json" || name === "fig-secret.txt" || name === "backups") {
        const src = path.join(legacy, name);
        const dest = path.join(next, name);
        if (fs.existsSync(dest)) continue;
        try {
          fs.cpSync(src, dest, { recursive: true, force: false });
          logging.write(`Migrated legacy ${name} from ${src} to ${dest}`);
        } catch (e) {
          logging.error(`Legacy migrate ${name} failed: ${e.message}`);
        }
      }
    }
  } catch (e) {
    logging.error(`Legacy data migration failed: ${e.message}`);
  }
}

function runtimeFile() {
  return path.join(userDataDir(), "fig-runtime.json");
}

function loadRuntime() {
  try {
    const data = JSON.parse(fs.readFileSync(runtimeFile(), "utf8"));
    return {
      ...DEFAULT_RUNTIME,
      ...data,
      report: { ...DEFAULT_RUNTIME.report, ...(data.report || {}) },
    };
  } catch {
    return { ...DEFAULT_RUNTIME };
  }
}

function saveRuntime(cfg) {
  fs.mkdirSync(userDataDir(), { recursive: true });
  fs.writeFileSync(runtimeFile(), JSON.stringify(cfg, null, 2));
}

function getSecret() {
  const f = path.join(userDataDir(), "fig-secret.txt");
  try {
    const s = fs.readFileSync(f, "utf8").trim();
    if (s.length >= 16) return s;
  } catch {
    /* first run */
  }
  const s = randomBytes(32).toString("hex");
  fs.mkdirSync(userDataDir(), { recursive: true });
  fs.writeFileSync(f, s, { mode: 0o600 });
  return s;
}

// GitHub token for crash reporting. Provided via the FIG_GH_TOKEN env var// (development/CI) or the gitignored backend/.env file, and passed to the
// backend so reports can be opened as Issues server-side. Never shipped with
// the app and never exposed in the UI.
function getGhToken() {
  if (process.env.FIG_GH_TOKEN && process.env.FIG_GH_TOKEN.trim()) {
    return process.env.FIG_GH_TOKEN.trim();
  }
  const envFile = path.join(__dirname, "..", "backend", ".env");
  try {
    if (fs.existsSync(envFile)) {
      const line = fs
        .readFileSync(envFile, "utf8")
        .split("\n")
        .find((l) => l.trim().startsWith("FIG_GH_TOKEN="));
      if (line) {
        const value = line.split("=").slice(1).join("=").trim().replace(/^["']|["']$/g, "");
        if (value) return value;
      }
    }
  } catch {
    // ignore unreadable .env
  }
  return "";
}

// License verification public key (Ed25519 PEM). Public — safe to ship with the
// app; it is passed to the backend so signed license keys can be verified.
function getLicensePublicKey() {
  if (process.env.LICENSE_PUBLIC_KEY && process.env.LICENSE_PUBLIC_KEY.trim()) {
    return process.env.LICENSE_PUBLIC_KEY.trim();
  }
  const pem = path.join(__dirname, "license-public.pem");
  try {
    if (fs.existsSync(pem)) {
      return fs.readFileSync(pem, "utf8").trim();
    }
  } catch {
    // ignore unreadable key file
  }
  return "";
}

// Online license redemption URL (Convex HTTP action that swaps a 10-digit
// activation code for a signed license key). Read from the environment or the
// backend .env file and passed to the backend so online activation works.
function getRedeemUrl() {
  if (process.env.LICENSE_REDEEM_URL && process.env.LICENSE_REDEEM_URL.trim()) {
    return process.env.LICENSE_REDEEM_URL.trim();
  }
  const envFile = path.join(__dirname, "..", "backend", ".env");
  try {
    if (fs.existsSync(envFile)) {
      const line = fs
        .readFileSync(envFile, "utf8")
        .split("\n")
        .find((l) => l.trim().startsWith("LICENSE_REDEEM_URL="));
      if (line) {
        const value = line.split("=").slice(1).join("=").trim().replace(/^["']|["']$/g, "");
        if (value) return value;
      }
    }
  } catch {
    // ignore unreadable .env
  }
  // Public Convex HTTP endpoint — not a secret, safe to ship with the app. This
  // fallback keeps online activation working in packaged builds where neither
  // the env var nor the gitignored backend/.env file is present.
  return URLS.licenseRedeem;
}

// The database always lives in the OS user-data dir — the same in dev and in a
// packaged build — so behaviour (and data) is identical either way.
function dbPath() {
  return path.join(userDataDir(), "data", "fig.db");
}

// ---------------------------------------------------------------------------
// Child processes (local mode). Children are spawned with Electron's Node so
// a packaged app never depends on a system Node install. Native deps must be
// rebuilt for Electron's ABI (npm run rebuild) before packaging.
// ---------------------------------------------------------------------------
function runNode(args, { cwd, env = {} }) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd,
      env: { ...process.env, ELECTRON_RUN_AS_NODE: "1", NODE_PATH: nativeDir(), ...env },
      stdio: ["ignore", "pipe", "pipe"],
    });
    logging.childStream(child, "setup");
    child.on("error", (err) => {
      logging.error(`child spawn error: ${err.message}`);
      reject(err);
    });
    child.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`child exited with code ${code}`)),
    );
  });
}

async function ensureDatabase(onStatus) {
  const db = dbPath();

  if (!fs.existsSync(db)) {
    fs.mkdirSync(path.dirname(db), { recursive: true });
    console.log(`First run — creating fresh database at ${db}`);
    const setup = path.join(bundleBackendDir(), "setup.cjs");
    if (fs.existsSync(setup)) {
      // setup.cjs only initializes the DB file + migration table. The schema
      // itself is applied below by migrate-db.cjs (000_initial baseline + any
      // later migrations), which is the single source of truth.
      onStatus && onStatus("Creating database tables…");
      await runNode([setup, db], { cwd: bundleBackendDir() });
    } else if (!app.isPackaged) {
      const prismaCli = path.join(SRC_BACKEND, "node_modules", "prisma", "build", "index.js");
      await runNode([prismaCli, "db", "push", "--skip-generate"], {
        cwd: SRC_BACKEND,
        env: { DATABASE_URL: `file:${db}` },
      });
    } else {
      throw new Error(`Database setup file missing in the app bundle. Expected ${setup}.`);
    }
  }

  // Apply migrations: fresh DBs get the baseline + all migrations; existing
  // DBs get only the ones not yet recorded (with a pre-migration backup and a
  // post-migration integrity check). Present in the production bundle; dev DBs
  // are kept current by prisma, so a missing runner there is fine.
  const migrate = path.join(bundleBackendDir(), "migrate-db.cjs");
  const migrations = path.join(bundleBackendDir(), "migrations");
  if (fs.existsSync(migrate) && fs.existsSync(migrations)) {
    onStatus && onStatus("Checking for database updates…");
    await runNode([migrate, db, migrations], { cwd: bundleBackendDir() });
  }
}

// Copy bundled data files (e.g. print-layouts.json) into the user-data dir so
// the backend can find them when it runs from there.
function ensureBackendData() {
  const dataDir = path.join(userDataDir(), "data");
  fs.mkdirSync(dataDir, { recursive: true });
  const bundled = path.join(bundleBackendDir(), "data", "print-layouts.json");
  if (fs.existsSync(bundled)) {
    const dest = path.join(dataDir, "print-layouts.json");
    if (!fs.existsSync(dest)) fs.copyFileSync(bundled, dest);
  }
}

function spawnBackend() {
  const baseEnv = {
    ...process.env,
    ELECTRON_RUN_AS_NODE: "1",
    NODE_PATH: nativeDir(),
    PORT: String(BACKEND_PORT),
    HOST: "localhost",
    NODE_ENV: "production",
    DATABASE_URL: `file:${dbPath()}`,
    JWT_SECRET: getSecret(),
    CORS_ORIGIN: `http://localhost:${FRONTEND_PORT}`,
    AUTO_BACKUP_ON_START: process.env.FIG_AUTO_BACKUP || "true",
    BACKUP_INTERVAL_HOURS: process.env.FIG_BACKUP_INTERVAL_HOURS || "24",
    BACKUP_RETENTION: process.env.FIG_BACKUP_RETENTION || "14",
    FIG_GH_TOKEN: getGhToken(),
    FIG_GH_REPO: process.env.FIG_GH_REPO || "arsalanwahab/Fig-POS",
    FIG_FEEDBACK_SECRET: process.env.FIG_FEEDBACK_SECRET || "",
    LICENSE_PUBLIC_KEY: getLicensePublicKey(),
    LICENSE_REDEEM_URL: getRedeemUrl(),
    FIG_DESKTOP: "1",
  };

  // Prefer the compiled backend bundle; fall back to tsx for development.
  const bundled = path.join(bundleBackendDir(), "server.cjs");
  if (fs.existsSync(bundled)) {
    // Run the backend from the user-data dir so backups and any data files it
    // writes persist outside Program Files (which is wiped on app updates).
    const child = spawn(process.execPath, [bundled], { cwd: userDataDir(), env: baseEnv, stdio: ["ignore", "pipe", "pipe"] });
    logging.write(`[backend] spawned (pid ${child.pid})`);
    logging.childStream(child, "backend");
    return child;
  }

  const tsx = path.join(SRC_BACKEND, "node_modules", "tsx", "dist", "cli.mjs");
  const child = spawn(process.execPath, [tsx, "server.ts"], {
    cwd: SRC_BACKEND,
    env: baseEnv,
    stdio: ["ignore", "pipe", "pipe"],
  });
  logging.childStream(child, "backend");
  return child;
}

function spawnFrontend() {
  // Prefer the Next.js "standalone" server from the production bundle.
  const standalone = fs.existsSync(path.join(frontendDir(), "server.js"))
    ? path.join(frontendDir(), "server.js")
    : path.join(frontendDir(), ".next", "standalone", "server.js");
  if (fs.existsSync(standalone)) {
    prepareStandalone(path.dirname(standalone));
    const child = spawn(process.execPath, [standalone], {
      cwd: path.dirname(standalone),
      env: {
        ...process.env,
        ELECTRON_RUN_AS_NODE: "1",
        NODE_PATH: path.join(frontendDir(), "deps"),
        PORT: String(FRONTEND_PORT),
        HOSTNAME: "localhost",
        BACKEND_URL: `http://localhost:${BACKEND_PORT}`,
        FIG_DESKTOP_SECRET: getDesktopSecret(),
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    logging.write(`[frontend] spawned (pid ${child.pid})`);
    logging.childStream(child, "frontend");
    return child;
  }

  // Fallback for development (no standalone build): next dev / next start.
  const nextBin = path.join(SRC_FRONTEND, "node_modules", "next", "dist", "bin", "next");
  const hasProdBuild = fs.existsSync(path.join(SRC_FRONTEND, ".next", "BUILD_ID"));
  const cmd = hasProdBuild ? "start" : "dev";
  const child = spawn(process.execPath, [nextBin, cmd, "-p", String(FRONTEND_PORT), "-H", "localhost"], {
    cwd: SRC_FRONTEND,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      NODE_PATH: path.join(SRC_FRONTEND, "deps"),
      PORT: String(FRONTEND_PORT),
      BACKEND_URL: `http://localhost:${BACKEND_PORT}`,
      FIG_DESKTOP_SECRET: getDesktopSecret(),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  logging.childStream(child, "frontend");
  return child;
}

// The standalone output needs its static assets and public files alongside it.
// The production bundle already contains them, so this is a no-op there.
function prepareStandalone(standDir) {
  const staticDest = path.join(standDir, ".next", "static");
  const staticSrc = path.join(frontendDir(), ".next", "static");
  if (fs.existsSync(staticSrc) && !fs.existsSync(staticDest)) {
    fs.mkdirSync(path.dirname(staticDest), { recursive: true });
    fs.cpSync(staticSrc, staticDest, { recursive: true });
  }
  const publicDest = path.join(standDir, "public");
  const publicSrc = path.join(frontendDir(), "public");
  if (fs.existsSync(publicSrc) && !fs.existsSync(publicDest)) {
    fs.mkdirSync(path.dirname(publicDest), { recursive: true });
    fs.cpSync(publicSrc, publicDest, { recursive: true });
  }
}

function track(child) {
  children.add(child);
  child.on("exit", (code) => {
    children.delete(child);
    if (code && code !== 0) logging.error(`child exited unexpectedly with code ${code}`);
  });
  child.on("error", (err) => logging.error(`child error: ${err.message}`));
}

// ---------------------------------------------------------------------------
// Window
// ---------------------------------------------------------------------------
// Loading screen shown immediately while DB setup + servers boot. It swaps to
// the real app URL once everything is healthy, so first run never looks dead.
function hardenWindow(win) {
  if (!win || !win.webContents) return;
  const wc = win.webContents;
  wc.on("before-input-event", (event, input) => {
    if (input.control && input.key.toLowerCase() === "r") event.preventDefault();
  });
}

function createLoadingWindow() {
  const win = new BrowserWindow({
    width: 1000,
    height: 620,
    resizable: false,
    minimizable: false,
maximizable: false,
    frame: false,
    transparent: true,
    hasShadow: false,
    backgroundColor: "#00000000",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  win.loadFile(path.join(__dirname, "loading.html"), { query: { v: app.getVersion() } });
  hardenWindow(win);
  win.webContents.setWindowOpenHandler(({ url: u }) => {
    if (/^https?:\/\//.test(u)) shell.openExternal(u);
    return { action: "deny" };
  });
  return win;
}

function setupAppMenu() {
  const isMac = process.platform === "darwin";
  const template = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { label: "About Fig POS", click: () => openAboutWindow() },
              { type: "separator" },
              { role: "hide" },
              { role: "hideOthers" },
              { role: "unhide" },
              { type: "separator" },
              { role: "quit" },
            ],
          },
        ]
      : []),
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    {
      role: "window",
      submenu: [{ role: "minimize" }, { role: "close" }],
    },
    {
      role: "help",
      submenu: [
        {
          label: "Help & documentation",
          click: () => openHelp(),
        },
        { type: "separator" },
        { label: "Getting started", click: () => openHelp("getting-started") },
        { label: "Dashboard", click: () => openHelp("dashboard") },
        { label: "Sales & POS", click: () => openHelp("sales") },
        { label: "Stock & inventory", click: () => openHelp("stock") },
        { label: "Products", click: () => openHelp("products") },
        { label: "Purchases", click: () => openHelp("purchases") },
        { label: "Contacts & credit", click: () => openHelp("people") },
        { label: "Reservations & vouchers", click: () => openHelp("reservations") },
        { label: "Money & expenses", click: () => openHelp("money") },
        { label: "Reports", click: () => openHelp("reports") },
        { label: "Printing", click: () => openHelp("printing") },
        { label: "Settings", click: () => openHelp("settings") },
        { label: "Backup & data", click: () => openHelp("backup-data") },
        { label: "Troubleshooting", click: () => openHelp("troubleshooting") },
        { label: "Contact & support", click: () => openHelp("contact-support") },
        { type: "separator" },
        {
          label: "About Fig POS",
          click: () => openAboutWindow(),
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function openHelp(section) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const base = mainWindow.webContents.getURL();
  const url = new URL(base);
  url.pathname = "/help";
  if (section) url.search = `?section=${section}`;
  mainWindow.loadURL(url.toString());
  mainWindow.show();
  mainWindow.focus();
}

function openAboutWindow() {
  if (aboutWindow && !aboutWindow.isDestroyed()) {
    aboutWindow.focus();
    return aboutWindow;
  }
  aboutWindow = new BrowserWindow({
    width: 1000,
    height: 620,
    resizable: false,
    minimizable: false,
    maximizable: false,
    frame: false,
    transparent: true,
    hasShadow: false,
    icon: APP_ICON,
    title: "About Fig POS",
    backgroundColor: "#00000000",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  aboutWindow.loadFile(path.join(__dirname, "about.html"), { query: { v: app.getVersion() } });
  hardenWindow(aboutWindow);
  aboutWindow.webContents.setWindowOpenHandler(({ url: u }) => {
    if (/^https?:\/\//.test(u)) shell.openExternal(u);
    return { action: "deny" };
  });
  aboutWindow.on("closed", () => {
    aboutWindow = null;
  });
  return aboutWindow;
}

function createWindow(url) {
  if (!mainWindow) {
    mainWindow = new BrowserWindow({
    width: 1680,
    height: 1020,
    minWidth: 1280,
    minHeight: 720,
    icon: APP_ICON,
    title: "Fig POS for Mobile Phones",
    backgroundColor: "#f6f5f2",
    // Hide the native title bar but keep the OS window controls (traffic lights
    // on macOS, min/max/close overlay on Windows/Linux). The renderer adds a
    // draggable strip so the window can still be moved.
    titleBarStyle: "hidden",
    ...(process.platform !== "darwin" ? { titleBarOverlay: true } : {}),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.loadURL(url);

  // Tee the renderer's console into the log file so frontend messages (which
  // include structured log lines and uncaught errors) are captured silently in
  // the packaged app just like the main process and backend are.
  mainWindow.webContents.on("console-message", (_e, levelOrDetails, messageOrNothing) => {
    const level = typeof levelOrDetails === "object" ? levelOrDetails.level : levelOrDetails;
    const message = typeof levelOrDetails === "object" ? levelOrDetails.message : messageOrNothing;
    const tag = level === 3 ? "renderer:error" : level === 2 ? "renderer:warn" : "renderer:info";
    logging.write(`[${tag}] ${String(message)}`);
  });

  mainWindow.webContents.on("did-finish-load", () => {
    logging.write(`[renderer] loaded ${mainWindow && mainWindow.webContents.getURL()}`);
  });

  hardenWindow(mainWindow);
  mainWindow.webContents.setWindowOpenHandler(({ url: u }) => {
    if (/^https?:\/\//.test(u)) shell.openExternal(u);
    return { action: "deny" };
  });

  mainWindow.webContents.on("will-navigate", (event, u) => {
    if (u.startsWith(url)) return;
    event.preventDefault();
    if (/^https?:\/\//.test(u)) shell.openExternal(u);
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
  }
}

function waitForHealth(url, timeoutMs) {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const tick = () => {
      if (Date.now() - started > timeoutMs) {
        reject(new Error(`Timed out waiting for ${url}`));
        return;
      }
      const req = http.get(url, (res) => {
        res.resume();
        if (res.statusCode === 200) {
          resolve();
        } else {
          setTimeout(tick, 750);
        }
      });
      req.setTimeout(2000, () => {
        req.destroy();
        setTimeout(tick, 750);
      });
      req.on("error", () => setTimeout(tick, 750));
    };
    tick();
  });
}

// ---------------------------------------------------------------------------
// App lifecycle
// ---------------------------------------------------------------------------
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  ipcMain.handle("runtime:get", () => loadRuntime());

  ipcMain.handle("theme:get", () => loadRuntime().theme || "fig");

  ipcMain.handle("theme:set", (_event, theme) => {
    const rt = loadRuntime();
    const next = /^[a-z0-9]+$/.test(String(theme || "")) ? String(theme) : "fig";
    saveRuntime({ ...rt, theme: next });
    return next;
  });

  ipcMain.handle("report:get", () => {
    const r = loadRuntime().report || {};
    return { enabled: Boolean(r.enabled), backendUrl: r.backendUrl || "", hasSecret: Boolean(r.secret) };
  });

  ipcMain.handle("report:set", (_event, cfg) => {
    const rt = loadRuntime();
    const next = rt.report || {};
    const clean = {
      enabled: Boolean(cfg && cfg.enabled),
      backendUrl: cfg && cfg.backendUrl ? String(cfg.backendUrl).trim() : "",
      secret: cfg && cfg.secret ? String(cfg.secret).trim() : next.secret || "",
    };
    saveRuntime({ ...rt, report: clean });
    return { enabled: clean.enabled, backendUrl: clean.backendUrl, hasSecret: Boolean(clean.secret) };
  });

  // Manual crash report triggered from Settings. Returns { ok, url } so the UI
  // can tell the user whether the report reached our team. Rate-limited so a
  // user can't spam reports (at most one per 5 minutes).
  const REPORT_MIN_INTERVAL_MS = 5 * 60 * 1000;
  let lastManualReportAt = 0;
  ipcMain.handle("report:send", async () => {
    const now = Date.now();
    if (now - lastManualReportAt < REPORT_MIN_INTERVAL_MS) {
      const waitMin = Math.ceil((REPORT_MIN_INTERVAL_MS - (now - lastManualReportAt)) / 60000);
      return { ok: false, retryAfterMin: waitMin, error: "Please wait before sending another report." };
    }
    lastManualReportAt = now;
    try {
      const res = await sendReportNow("[Manual report] Fig POS", null);
      return { ok: true, url: res.url };
    } catch (e) {
      return { ok: false, error: (e && e.message) || String(e) };
    }
  });

  ipcMain.handle("logs:get", () => logging.tail(500));

  ipcMain.handle("dialog:pick-directory", async () => {
    const result = await dialog.showOpenDialog(mainWindow ?? undefined, {
      title: "Choose a backup folder",
      properties: ["openDirectory", "createDirectory"],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  ipcMain.handle("logs:open", () => {
    const dir = path.dirname(logging.getPath() || "");
    if (dir) shell.openPath(dir);
    return true;
  });

  ipcMain.handle("data:open", () => {
    const dir = userDataDir();
    try { fs.mkdirSync(dir, { recursive: true }); } catch {}
    shell.openPath(dir);
    return true;
  });

  // In-app update controls: current status, trigger a check, download an
  // available update, apply a downloaded one, or open the release page.
  ipcMain.handle("update:status", () => updateSnapshot());

  ipcMain.handle("update:check", () => {
    if (!updateState.checking) {
      checkForUpdates();
    }
    return updateSnapshot();
  });

  ipcMain.handle("update:download", async () => {
    if (!updateState.available || updateState.downloaded) return updateSnapshot();
    await downloadUpdate();
    return updateSnapshot();
  });

  ipcMain.handle("update:install", () => {
    if (updateState.downloaded) installUpdate();
    return updateSnapshot();
  });

  ipcMain.handle("update:open-changelog", () => {
    shell.openExternal(URLS.changelog);
    return true;
  });

  ipcMain.handle("about:open", () => openAboutWindow());

  ipcMain.handle("about:close", () => {
    if (aboutWindow && !aboutWindow.isDestroyed()) aboutWindow.close();
    return true;
  });

  ipcMain.handle("about:info", () => ({
    version: app.getVersion(),
    runtime: `Electron ${process.versions.electron} · Node ${process.versions.node}`,
    channel: app.isPackaged ? "stable" : "dev",
  }));

  ipcMain.handle("error:get", () => lastErrorDetail);

  ipcMain.handle("error:copy", (_event, text) => {
    try {
      clipboard.writeText(String(text || ""));
      return true;
    } catch {
      return false;
    }
  });

  // Share a generated PDF through the OS share sheet (lets the user pick
  // WhatsApp, mail, etc. to attach the document). The renderer sends the PDF as
  // a base64 data URL; we write it to a temp file and invoke webContents.share.
  ipcMain.handle("share:pdf", async (event, dataUrl, name) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) throw new Error("No window to share from");
    const match = /^data:([^;]+);base64,(.+)$/.exec(String(dataUrl || ""));
    if (!match) throw new Error("Invalid PDF data");
    const buffer = Buffer.from(match[2], "base64");
    const filePath = path.join(app.getPath("temp"), `fig-${Date.now()}-${String(name || "document").replace(/[^a-z0-9-_]/gi, "")}.pdf`);
    fs.writeFileSync(filePath, buffer);
    try {
      await win.webContents.share({ files: [filePath], title: name || "Document" });
      return true;
    } catch (err) {
      if (err && err.message === "Share call cancelled") return false;
      throw err;
    }
  });

  ipcMain.handle("print:silent", async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) throw new Error("No window to print from");
    const contents = win.webContents;
    const silent = await new Promise((resolve, reject) => {
      try {
        const maybePromise = contents.print({ silent: true, printBackground: true }, (success, failureReason) => {
          if (success) resolve(true);
          else reject(new Error(failureReason || "Print failed"));
        });
        if (maybePromise && typeof maybePromise.then === "function") {
          maybePromise.then(() => resolve(true)).catch(reject);
        }
      } catch (err) {
        reject(err);
      }
    });
    return silent;
  });

  ipcMain.handle("print:dialog", async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) throw new Error("No window to print from");
    const contents = win.webContents;
    return new Promise((resolve, reject) => {
      try {
        const maybePromise = contents.print({ silent: false, printBackground: true }, (success, failureReason) => {
          if (success) resolve(true);
          else reject(new Error(failureReason || "Print cancelled"));
        });
        if (maybePromise && typeof maybePromise.then === "function") {
          maybePromise.then(() => resolve(true)).catch(reject);
        }
      } catch (err) {
        reject(err);
      }
    });
  });

  ipcMain.handle("runtime:set", (_event, cfg) => {
    const next = {
      mode: cfg && cfg.mode === "hosted" ? "hosted" : "local",
      hostedUrl: cfg && cfg.mode === "hosted" ? String(cfg.hostedUrl || "").trim() : "",
    };
    saveRuntime(next);
    app.relaunch();
    app.exit(0);
    return next;
  });

  app.whenReady().then(async () => {
    try { migrateLegacyDataDir(); } catch {}
    logging.init(path.join(userDataDir(), "logs"));
    if (process.platform === "darwin" && app.dock) {
      app.dock.setIcon(APP_ICON);
    }
    const cfg = loadRuntime();
    let url;

    // Show the loading screen immediately so startup (esp. first run) doesn't
    // look like a frozen/slow open.
    const loadingWin = createLoadingWindow();
    const setStatus = (text) => {
      try {
        if (!loadingWin.isDestroyed()) loadingWin.webContents.send("loading:status", text);
      } catch {
        /* window closed */
      }
    };

    logging.write(`Version ${app.getVersion()} | Electron ${process.versions.electron} | Node ${process.versions.node}`);

    {
      const rt = loadRuntime();
      const staleContent = path.join(userDataDir(), "content");
      if (fs.existsSync(staleContent)) {
        try { fs.rmSync(staleContent, { recursive: true, force: true }); } catch {}
      }
      if (rt.lastAppVersion !== app.getVersion() || rt.content) {
        const { content: _content, ...rest } = rt;
        saveRuntime({ ...rest, lastAppVersion: app.getVersion() });
      }
    }

    if (DEV_ATTACH) {
      // Attach to already-running dev servers (frontend + backend) without
      // spawning anything: e.g. FIG_FRONTEND_URL=http://localhost:3000.
      url = process.env.FIG_FRONTEND_URL || "http://localhost:3000";
    } else if (cfg.mode === "hosted") {
      if (!/^https?:\/\//.test(cfg.hostedUrl)) {
        logging.error("Hosted mode is selected but the URL is missing/invalid.");
        fatalDialog("Fig POS for Mobile Phones could not start", "Hosted mode is selected but the URL is missing/invalid. Open Settings in local mode to fix it.");
        app.exit(1);
        return;
      }
      url = cfg.hostedUrl;
    } else {
      setStatus("Preparing app data folder…");
      try {
        await ensureDatabase(setStatus);
      } catch (err) {
        logging.error("Could not prepare the local database: " + (err && err.stack ? err.stack : err));
        setStatus("Could not prepare the database.");
        fatalDialog("Could not prepare the local database", err);
        app.exit(1);
        return;
      }

      // Clear any orphaned backend/frontend left behind by a hard-killed
      // previous run, then verify the fixed ports are free before spawning. If
      // one is still taken (e.g. by an unrelated app), fail loudly instead of
      // silently picking another port.
      await reapPortOrphans();
      if (!(await isPortFree(BACKEND_PORT)) || !(await isPortFree(FRONTEND_PORT))) {
        const err = new Error(
          `Port in use. Backend ${BACKEND_PORT} and frontend ${FRONTEND_PORT} must both be free (set FIG_BACKEND_PORT / FIG_FRONTEND_PORT to change).`,
        );
        logging.error(err.message);
        setStatus("A required port is already in use.");
        fatalDialog("Fig POS for Mobile Phones could not start", err);
        app.exit(1);
        return;
      }

      setStatus("Starting backend server…");
      ensureBackendData();
      track(spawnBackend());
      setStatus("Starting app server…");
      track(spawnFrontend());
      url = `http://localhost:${FRONTEND_PORT}`;
      setStatus("Waiting for server — this can take a few seconds on first run…");
      try {
        await waitForHealth(`${url}/api/health`, 120_000);
      } catch (err) {
        logging.error("Frontend/backend did not come up in time: " + (err && err.stack ? err.stack : err));
        setStatus("Servers did not start in time.");
        fatalDialog("Fig POS for Mobile Phones could not start", err);
        app.exit(1);
        return;
      }
    }

    // Open the real (framed) app window, then dismiss the loading screen.
    // Clear the renderer HTTP cache on every startup so stale Next.js chunks
    // from a previous content update never persist into the new session.
    const { session } = require("electron");
    await session.defaultSession.clearCache();

    // Set the desktop gate cookie on the server origin so the Electron window
    // passes the Next middleware, while a plain browser (no cookie) gets 403.
    try {
      await session.defaultSession.cookies.set({
        url: `http://localhost:${FRONTEND_PORT}`,
        name: "fig.desktop",
        value: getDesktopSecret(),
        httpOnly: true,
        sameSite: "lax",
        path: "/",
      });
    } catch (err) {
      logging.error("Could not set desktop gate cookie: " + (err && err.message ? err.message : err));
    }

    createWindow(url);
    setupAppMenu();
    if (!loadingWin.isDestroyed() && process.env.FIG_STAY_ON_LOADING !== "1") loadingWin.close();

    // Temporary dev aid: when staying on the loading window, reload it whenever
    // loading.html changes so styling/layout edits show up without relaunching.
    if (process.env.FIG_STAY_ON_LOADING === "1") {
      const loadingHtml = path.join(__dirname, "loading.html");
      fs.watchFile(loadingHtml, { interval: 500 }, () => {
        if (!loadingWin.isDestroyed()) {
          loadingWin.reload();
        }
      });
    }

    // OTA is manual-only via frontend Settings → Update (window.fig.update.check/download/install).
    // No silent startup check — user must trigger Check for updates explicitly.

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0 && url) createWindow(url);
    });
  });

  app.on("window-all-closed", () => {
    app.quit();
  });

  app.on("before-quit", () => {
    for (const child of children) {
      try {
        child.kill("SIGTERM");
      } catch {
        /* already gone */
      }
    }
  });

  app.on("quit", () => {
    for (const child of children) {
      try {
        child.kill("SIGKILL");
      } catch {
        /* already gone */
      }
    }
  });
}