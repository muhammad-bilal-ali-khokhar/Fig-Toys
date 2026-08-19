"use strict";

// Forwards crash / error reports to the local backend, which holds the GitHub
// token server-side and opens the Issue. No token is ever shipped with the
// desktop app — this module only knows where the backend lives.

const DEFAULT_BACKEND_URL = "http://localhost:47620";

function backendUrl(cfg) {
  const custom = cfg && cfg.backendUrl && cfg.backendUrl.trim();
  if (custom) return custom.replace(/\/$/, "");
  return process.env.FIG_BACKEND_URL || DEFAULT_BACKEND_URL;
}

async function submit({ cfg, title, body, meta }) {
  const url = `${backendUrl(cfg)}/api/feedback/crash`;
  const headers = { "Content-Type": "application/json" };
  const secret = cfg && cfg.secret && String(cfg.secret).trim();
  if (secret) headers["x-feedback-secret"] = secret;
  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      app: "Fig POS",
      version: meta && meta.version,
      platform: meta && meta.platform,
      title,
      body,
      logTail: meta && meta.logTail ? meta.logTail : "",
    }),
  });
  if (!res.ok) {
    throw new Error(`Feedback API ${res.status}: ${await res.text()}`);
  }
  const json = await res.json();
  return { sent: true, url: json && json.data && json.data.url };
}

module.exports = { submit, backendUrl };