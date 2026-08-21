"use strict";

const fs = require("node:fs");
const path = require("node:path");

let logPath = null;
let pendingDir = null;

function init(dir) {
  pendingDir = dir;
  tryOpen();
}

// Retried on every write until it succeeds, so the logs folder is created
// automatically even if init ran before Electron's userData was available.
function tryOpen() {
  if (logPath || !pendingDir) return;
  try {
    fs.mkdirSync(pendingDir, { recursive: true });
    logPath = path.join(pendingDir, "fig.log");
    write("=== Fig Mobile POS started " + new Date().toISOString() + " ===");
  } catch (err) {
    logPath = null;
    try { console.error("Could not init logging:", err); } catch {}
  }
}

function write(line) {
  const text = `[${new Date().toISOString()}] ${line}`;
  try { console.log(text); } catch {}
  if (!logPath) tryOpen();
  if (!logPath) return;
  try { fs.appendFileSync(logPath, text + "\n"); } catch {}
}

function error(line) { write("ERROR " + line); }

// Tee a child process's stdout/stderr into the log so startup failures are
// visible even in a packaged app (no terminal).
function childStream(child, label) {
  if (!child || !child.stdout || !child.stderr) return;
  const tee = (stream, kind) => {
    stream.setEncoding("utf8");
    stream.on("data", (chunk) => {
      for (const line of String(chunk).split("\n")) {
        if (line) write(`[${label}:${kind}] ${line}`);
      }
    });
  };
  tee(child.stdout, "out");
  tee(child.stderr, "err");
}

function tail(count) {
  if (!logPath || !fs.existsSync(logPath)) return [];
  try {
    const all = fs.readFileSync(logPath, "utf8").split("\n").filter(Boolean);
    return all.slice(-count);
  } catch {
    return [];
  }
}

function getPath() { return logPath; }

module.exports = { init, write, error, childStream, tail, getPath };