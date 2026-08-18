#!/usr/bin/env node
// License key tool for Fig POS.
//
// Keys are Ed25519-signed tokens that encode everything (customer name, expiry,
// device limit) so they cannot be forged or altered without the private key.
// The app ships only the public key; the private key lives with the vendor.
//
// Usage (interactive):
//   node tools/license-cli.mjs gen-key
//   node tools/license-cli.mjs make
//   node tools/license-cli.mjs verify <KEY> [--key <public.pem>]
import {
  generateKeyPairSync,
  createPrivateKey,
  createPublicKey,
  sign,
  verify,
} from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import readline from "node:readline";

const ISSUER = "MYKO";
const PREFIX = "FIG-";

function b64e(buf) {
  return Buffer.from(buf).toString("base64url");
}
function b64d(s) {
  return Buffer.from(s, "base64url");
}

function canonical(payload) {
  return Buffer.from(JSON.stringify(payload), "utf8");
}

function signPayload(privateKeyPem, payload) {
  const key = createPrivateKey(privateKeyPem);
  return sign(null, canonical(payload), key);
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

async function make(ask) {
  const name = (await ask("Customer name")).trim();
  if (!name) throw new Error("Customer name is required");
  const devices = Number((await ask("Device limit", "1")) || "1");
  const expRaw = await ask("Expiry (YYYY-MM-DD, blank = never)", "");
  const keyPath = await ask("Private key path", "backend/keys/license-private.pem");
  const privatePem = readFileSync(keyPath, "utf8");
  const payload = {
    sub: name,
    iss: ISSUER,
    exp: parseExp(expRaw),
    maxDevices: Number.isFinite(devices) && devices > 0 ? devices : 1,
    iat: Math.floor(Date.now() / 1000),
  };
  const sig = signPayload(privatePem, payload);
  const key = `${PREFIX}${b64e(canonical(payload))}.${b64e(sig)}`;
  console.log("\nLicense key:");
  console.log(key);
  console.log("\n" + prettyPayload(payload));
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

async function run() {
  const cmd = process.argv[2];
  if (cmd === "gen-key") {
    await genKey(makePrompter());
  } else if (cmd === "make") {
    await make(makePrompter());
  } else if (cmd === "verify") {
    verifyKeyCmd(process.argv.slice(2));
  } else {
    console.log(
      "Usage:\n  node tools/license-cli.mjs gen-key\n  node tools/license-cli.mjs make\n  node tools/license-cli.mjs verify <KEY> [--key <public.pem>]",
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
