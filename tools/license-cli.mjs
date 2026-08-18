#!/usr/bin/env node
// License key tool for Fig POS.
//
// Keys are Ed25519-signed tokens that encode everything (customer name, expiry,
// device limit) so they cannot be forged or altered without the private key.
// The app ships only the public key; the private key lives with the vendor.
//
// Every license key is created through the Convex backend (activation code ->
// redeem -> signed license key). There is no offline "make" — keys cannot be
// minted outside Convex.
//
// Usage:
//   node tools/license-cli.mjs gen-key                     generate the signing key pair
//   node tools/license-cli.mjs issue                       mint a code (and optionally redeem)
//   node tools/license-cli.mjs mint                        mint an activation code only
//   node tools/license-cli.mjs details <CODE>              look up a code
//   node tools/license-cli.mjs redeem <CODE> [deviceId]    redeem a code -> license key
//   node tools/license-cli.mjs verify <KEY> [--key <pub>]  verify a key (offline)
// Set LICENSE_ADMIN_TOKEN (and optionally CONVEX_SITE_URL) for mint/issue/details.
import { generateKeyPairSync, createPublicKey, verify } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import readline from "node:readline";

const PREFIX = "FIG-";

function b64d(s) {
  return Buffer.from(s, "base64url");
}

function verifyKey(publicKeyPem, key) {
  const body = key.startsWith(PREFIX) ? key.slice(PREFIX.length) : key;
  const sep = body.indexOf(".");
  if (sep < 0) {
    throw new Error("Invalid key format — expected FIG-<payload>.<signature>");
  }
  const payloadB64 = body.slice(0, sep);
  const sigB64 = body.slice(sep + 1);
  if (!payloadB64 || !sigB64) {
    throw new Error("Invalid key format — expected FIG-<payload>.<signature>");
  }
  const publicKey = createPublicKey(publicKeyPem);
  const payloadBytes = b64d(payloadB64);
  const payload = JSON.parse(payloadBytes.toString("utf8"));
  const ok = verify(null, payloadBytes, publicKey, b64d(sigB64));
  return { ok, payload };
}

function parseExp(raw) {
  if (!raw) return null;
  const n = Number(raw);
  if (Number.isInteger(n) && n > 0) return n;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid expiry: "${raw}" (use YYYY-MM-DD or a unix timestamp)`);
  }
  return Math.floor(date.getTime() / 1000);
}

function prettyPayload(p) {
  const lines = [`name: ${p.sub}`, `issuer: ${p.iss}`, `devices: ${p.maxDevices}`];
  lines.push(p.exp ? `expires: ${new Date(p.exp * 1000).toISOString()}` : "expires: never");
  lines.push(`issued: ${new Date(p.iat * 1000).toISOString()}`);
  return lines.join("\n");
}

function makePrompter() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const lines = rl[Symbol.asyncIterator]();
  return async (q, fallback = "") => {
    process.stdout.write(`${q}${fallback ? ` (${fallback})` : ""}: `);
    const { value } = await lines.next();
    if (value === undefined) return fallback;
    return value.trim() || fallback;
  };
}

async function genKey(ask) {
  const out = await ask("Output directory", "tools/keys");
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const pub = publicKey.export({ type: "spki", format: "pem" }).toString();
  const priv = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
  mkdirSync(out, { recursive: true });
  writeFileSync(path.join(out, "license-private.pem"), priv, { mode: 0o600 });
  writeFileSync(path.join(out, "license-public.pem"), pub);
  console.log(`\nWrote license-private.pem and license-public.pem to ${out}`);
  console.log("\nPublic key (add to backend/.env as LICENSE_PUBLIC_KEY):");
  console.log(pub);
}

function verifyKeyCmd(args) {
  const key = args[1];
  if (!key) throw new Error("verify needs a key");
  const publicPem = readFileSync(args[2] === "--key" ? args[3] : "license-public.pem", "utf8");
  const { ok, payload } = verifyKey(publicPem, key);
  if (!ok) throw new Error("Signature is invalid — key has been altered or forged.");
  console.log("Valid signature. Payload:");
  console.log(prettyPayload(payload));
}

const CONVEX_SITE_URL =
  (process.env.CONVEX_SITE_URL || "").replace(/\/+$/, "") || "https://fiery-panda-147.convex.site";

const ADMIN_TOKEN = "8b1b2259ed15f548ffa2dea265a8330272a6092138802e4a";

function adminToken() {
  return (process.env.LICENSE_ADMIN_TOKEN || ADMIN_TOKEN).trim();
}

async function apiPost(endpoint, body, { token } = {}) {
  const res = await fetch(`${CONVEX_SITE_URL}${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error((data && data.message) || `Request failed with status ${res.status}`);
  }
  return data;
}

async function mint(ask) {
  const name = (await ask("Customer name")).trim();
  if (!name) throw new Error("Customer name is required");
  const devices = Number((await ask("Device limit", "1")) || "1");
  const expRaw = await ask("Expiry (YYYY-MM-DD, blank = never)", "");
  const expSec = parseExp(expRaw);
  const data = await apiPost(
    "/mint",
    {
      customerName: name,
      edition: "PRO",
      maxDevices: Number.isFinite(devices) && devices > 0 ? devices : 1,
      expiresAt: expSec ? expSec * 1000 : undefined,
    },
    { token: adminToken() },
  );
  console.log("\nActivation code:");
  console.log(data.code);
}

async function issue(ask) {
  const name = (await ask("Customer name")).trim();
  if (!name) throw new Error("Customer name is required");
  const devices = Number((await ask("Device limit", "1")) || "1");
  const expRaw = await ask("Expiry (YYYY-MM-DD, blank = never)", "");
  const expSec = parseExp(expRaw);

  const minted = await apiPost(
    "/mint",
    {
      customerName: name,
      edition: "PRO",
      maxDevices: Number.isFinite(devices) && devices > 0 ? devices : 1,
      expiresAt: expSec ? expSec * 1000 : undefined,
    },
    { token: adminToken() },
  );
  const code = minted.code;

  console.log("\nActivation code:");
  console.log(code);

  const redeemNow = (await ask("\nRedeem now to get the license key?", "y")).toLowerCase();
  if (redeemNow !== "y" && redeemNow !== "yes") {
    console.log(`\nShare code ${code} with the customer to activate in the app.`);
    return;
  }

  const deviceId = (await ask("Device id", `device-${Date.now()}`)).trim();
  const redeemed = await apiPost("/redeem", { code, deviceId });
  console.log("\nLicense key:");
  console.log(redeemed.licenseToken);
  console.log(`\n  customer:     ${redeemed.customerName}`);
  console.log(`  edition:      ${redeemed.edition}`);
  console.log(`  max devices:  ${redeemed.maxDevices}`);
  console.log(`  expires:      ${redeemed.expiresAt || "never"}`);
  console.log(`  device:       ${redeemed.deviceId}`);
}

async function details(args) {
  const code = args[1];
  if (!code) throw new Error("details needs a 10-digit code");
  const data = await apiPost("/details", { code }, { token: adminToken() });
  console.log("\nActivation code details:");
  console.log(`  code:         ${data.code}`);
  console.log(`  status:       ${data.status}`);
  console.log(`  customer:     ${data.customerName}`);
  console.log(`  edition:      ${data.edition}`);
  console.log(`  max devices:  ${data.maxDevices}`);
  console.log(`  active:       ${data.activeDevices}`);
  console.log(
    `  expires:      ${data.expiresAt ? new Date(data.expiresAt).toISOString() : "never"}`,
  );
  console.log(`  redeemed:     ${data.redeemedAt ? new Date(data.redeemedAt).toISOString() : "no"}`);
  if (data.activations && data.activations.length) {
    console.log("\n  Activations:");
    for (const a of data.activations) {
      console.log(`    - device ${a.deviceId} @ ${new Date(a.activatedAt).toISOString()}`);
    }
  }
}

async function redeem(args) {
  const code = args[1];
  if (!code) throw new Error("redeem needs a 10-digit code");
  const deviceId = args[2] || `cli-${Date.now()}`;
  const data = await apiPost("/redeem", { code, deviceId });
  console.log("\nLicense key:");
  console.log(data.licenseToken);
  console.log(`\n  customer:     ${data.customerName}`);
  console.log(`  edition:      ${data.edition}`);
  console.log(`  max devices:  ${data.maxDevices}`);
  console.log(`  expires:      ${data.expiresAt || "never"}`);
  console.log(`  device:       ${data.deviceId}`);
}

async function run() {
  const cmd = process.argv[2];
  if (cmd === "gen-key") {
    await genKey(makePrompter());
  } else if (cmd === "verify") {
    verifyKeyCmd(process.argv.slice(2));
  } else if (cmd === "mint") {
    await mint(makePrompter());
  } else if (cmd === "issue") {
    await issue(makePrompter());
  } else if (cmd === "details") {
    await details(process.argv.slice(2));
  } else if (cmd === "redeem") {
    await redeem(process.argv.slice(2));
  } else {
    console.log(
      "Usage:\n  node tools/license-cli.mjs gen-key\n  node tools/license-cli.mjs issue\n  node tools/license-cli.mjs mint\n  node tools/license-cli.mjs details <CODE>\n  node tools/license-cli.mjs redeem <CODE> [deviceId]\n  node tools/license-cli.mjs verify <KEY> [--key <public.pem>]",
    );
    process.exit(1);
  }
}

try {
  await run();
} catch (err) {
  console.error(err.message);
  process.exitCode = 1;
}
