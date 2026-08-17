"use strict";

// Content self-update. The Electron shell (main.js/preload/native module) is
// updated by electron-updater via a full installer. Frontend/backend changes
// ship as a content bundle instead: a typed manifest + production.zip published
// on the same GitHub Release. Applying a content update downloads the zip,
// verifies it, and swaps the backend/frontend bundle into the user-data dir.
// The database, backups and runtime config live in separate user-data paths, so
// they are never touched.

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { pipeline } = require("node:stream");
const { promisify } = require("node:util");
const got = require("got");
const extractZip = require("extract-zip");

const streamPipeline = promisify(pipeline);

const OWNER = "arsalanwahab";
const REPO = "Mobile-Shop-POS";
const BASE = `https://github.com/${OWNER}/${REPO}/releases/latest/download`;
const MANIFEST_URL = `${BASE}/manifest.json`;
const ZIP_URL = `${BASE}/production.zip`;

// Passed in by main.js so this module stays decoupled from Electron.
let userDataDir = () => "";

function init(dirFn) {
  userDataDir = dirFn;
}

function contentDir() {
  return path.join(userDataDir(), "content");
}

function stagingDir() {
  return path.join(contentDir(), "staging");
}

function finalDir() {
  return path.join(contentDir(), "production");
}

function versionFile() {
  return path.join(contentDir(), "version.json");
}

// The updated production root (backend + frontend) if a content update has been
// applied, otherwise null so main.js falls back to the bundled copy.
function appliedContentRoot() {
  const dir = finalDir();
  if (fs.existsSync(path.join(dir, "backend", "server.cjs")) || fs.existsSync(path.join(dir, "frontend", "server.js"))) {
    return dir;
  }
  return null;
}

function readAppliedVersion() {
  try {
    return JSON.parse(fs.readFileSync(versionFile(), "utf8")).contentVersion || "";
  } catch {
    return "";
  }
}

function writeAppliedVersion(version) {
  fs.mkdirSync(contentDir(), { recursive: true });
  fs.writeFileSync(versionFile(), JSON.stringify({ contentVersion: version }, null, 2));
}

async function downloadWithProgress(url, dest, onProgress) {
  const writeStream = fs.createWriteStream(dest);
  const readStream = got.stream(url);
  if (onProgress) {
    readStream.on("downloadProgress", (p) => onProgress(Math.round((p.transferred / p.total) * 100) || 0));
  }
  await streamPipeline(readStream, writeStream);
}

function sha256File(file) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    const s = fs.createReadStream(file);
    s.on("data", (d) => hash.update(d));
    s.on("end", () => resolve(hash.digest("hex")));
    s.on("error", reject);
  });
}

// Fetch the release manifest and report what kind of update is available.
// type: "content" = backend/frontend bundle only (in-app apply),
//       "full"   = shell/main process (needs the installer via electron-updater).
// Returns null when the check could not run (offline / non-Windows).
async function checkContentUpdate() {
  if (process.platform !== "win32") return null;
  const log = require("./logging");
  let manifest;
  try {
    manifest = await got.get(MANIFEST_URL).json();
  } catch (err) {
    log.write(`content: manifest fetch skipped (${err && err.message ? err.message : "no network"}).`);
    return null;
  }
  if (!manifest || !manifest.contentVersion) return null;

  const applied = readAppliedVersion();
  return {
    type: manifest.type === "full" ? "full" : "content",
    available: applied !== manifest.contentVersion,
    contentVersion: manifest.contentVersion,
    applied,
    version: manifest.version || "",
  };
}

// Download, verify, and apply the content bundle. Returns the applied
// contentVersion, or null when nothing changed / failed. Callers should run
// checkContentUpdate first and only apply when type === "content" and available.
async function applyContentUpdate(onProgress) {
  if (process.platform !== "win32") return null;
  const log = require("./logging");
  let manifest;
  try {
    manifest = await got.get(MANIFEST_URL).json();
  } catch (err) {
    log.write(`content: manifest fetch skipped (${err && err.message ? err.message : "no network"}).`);
    return null;
  }
  if (!manifest || !manifest.contentVersion) return null;

  const applied = readAppliedVersion();
  if (applied === manifest.contentVersion) return null;

  onProgress && onProgress(0);
  log.write(`content: applying ${manifest.contentVersion}.`);

  const staging = stagingDir();
  const final = finalDir();
  const zipPath = path.join(staging, "production.zip");

  try {
    fs.rmSync(staging, { recursive: true, force: true });
    fs.mkdirSync(staging, { recursive: true });
    await downloadWithProgress(ZIP_URL, zipPath, (pct) => {
      onProgress && onProgress(Math.max(1, Math.min(99, pct)));
    });

    const hash = await sha256File(zipPath);
    if (manifest.sha256 && hash !== manifest.sha256) {
      throw new Error(`content hash mismatch (expected ${manifest.sha256}, got ${hash})`);
    }

    await extractZip(zipPath, { dir: staging });
    fs.rmSync(final, { recursive: true, force: true });
    fs.mkdirSync(final, { recursive: true });
    for (const sub of ["backend", "frontend"]) {
      const src = path.join(staging, sub);
      if (fs.existsSync(src)) fs.cpSync(src, path.join(final, sub), { recursive: true });
    }

    writeAppliedVersion(manifest.contentVersion);
    onProgress && onProgress(100);
    log.write(`content: applied ${manifest.contentVersion}.`);
    return manifest.contentVersion;
  } catch (err) {
    log.error(`content: update failed (${err && err.message ? err.message : err}).`);
    return null;
  }
}

module.exports = { init, checkContentUpdate, applyContentUpdate, appliedContentRoot, readAppliedVersion };