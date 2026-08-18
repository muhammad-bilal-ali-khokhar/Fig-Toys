#!/usr/bin/env node
// Publish the Windows installer + auto-update files to a Cloudflare R2 bucket
// using the S3-compatible API (SigV4 signed PUTs). Runs in the GitHub Actions
// release workflow and locally. No external CLI (aws/rclone) required.
//
// Env:
//   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY,
//   R2_BUCKET, R2_PUBLIC_URL, R2_VERSION (optional), R2_SOURCE_DIR (default desktop/release)
import { createHash, createHmac } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const ACCOUNT = process.env.R2_ACCOUNT_ID || "";
const KEY = process.env.R2_ACCESS_KEY_ID || "";
const SECRET = process.env.R2_SECRET_ACCESS_KEY || "";
const BUCKET = process.env.R2_BUCKET || "";
const PUBLIC = (process.env.R2_PUBLIC_URL || "").replace(/\/+$/, "");
const VERSION = process.env.R2_VERSION || "";
const SOURCE = path.resolve(process.env.R2_SOURCE_DIR || "desktop/release");

if (!ACCOUNT || !KEY || !SECRET || !BUCKET || !PUBLIC) {
  console.error(
    "Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET and R2_PUBLIC_URL.",
  );
  process.exit(1);
}

const HOST = `${ACCOUNT}.r2.cloudflarestorage.com`;
const REGION = "auto";
const SERVICE = "s3";
const ENDPOINT = `https://${HOST}`;

const sha256 = (d) => createHash("sha256").update(d).digest("hex");
const hmac = (k, d) => createHmac("sha256", k).update(d).digest();
const hmacHex = (k, d) => createHmac("sha256", k).update(d).digest("hex");

async function putObject(key, body, contentType) {
  const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = sha256(body);
  const uri = `/${BUCKET}/${key.split("/").map(encodeURIComponent).join("/")}`;

  const canonicalHeaders = `host:${HOST}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = "host;x-amz-content-sha256;x-amz-date";
  const canonicalRequest = ["PUT", uri, "", canonicalHeaders, signedHeaders, payloadHash].join("\n");

  const scope = `${dateStamp}/${REGION}/${SERVICE}/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, sha256(canonicalRequest)].join("\n");

  const kSigning = hmac(hmac(hmac(hmac(`AWS4${SECRET}`, dateStamp), REGION), SERVICE), "aws4_request");
  const signature = hmacHex(kSigning, stringToSign);

  const res = await fetch(`${ENDPOINT}${uri}`, {
    method: "PUT",
    headers: {
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzDate,
      Authorization: `AWS4-HMAC-SHA256 Credential=${KEY}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=300",
    },
    body,
  });
  if (!res.ok) {
    throw new Error(`R2 PUT ${key} failed: ${res.status} ${await res.text()}`);
  }
  console.log(`  uploaded ${key}`);
}

async function getObject(key) {
  const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = sha256("");
  const uri = `/${BUCKET}/${key.split("/").map(encodeURIComponent).join("/")}`;

  const canonicalHeaders = `host:${HOST}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = "host;x-amz-content-sha256;x-amz-date";
  const canonicalRequest = ["GET", uri, "", canonicalHeaders, signedHeaders, payloadHash].join("\n");

  const scope = `${dateStamp}/${REGION}/${SERVICE}/aws4_request`;
  const stringToSign = ["AWS4-HMAC-SHA256", amzDate, scope, sha256(canonicalRequest)].join("\n");
  const kSigning = hmac(hmac(hmac(hmac(`AWS4${SECRET}`, dateStamp), REGION), SERVICE), "aws4_request");
  const signature = hmacHex(kSigning, stringToSign);

  const res = await fetch(`${ENDPOINT}${uri}`, {
    method: "GET",
    headers: {
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzDate,
      Authorization: `AWS4-HMAC-SHA256 Credential=${KEY}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`R2 GET ${key} failed: ${res.status} ${await res.text()}`);
  return await res.text();
}

function bytes(n) {
  const mb = n / (1024 * 1024);
  return `${mb.toFixed(mb < 10 ? 1 : 0)} MB`;
}

async function main() {
  const files = readdirSync(SOURCE);
  const setup = files.find((f) => f.endsWith(".exe") && !f.includes(".blockmap"));
  const blockmap = files.find((f) => f.endsWith(".exe.blockmap"));
  const latestYml = files.find((f) => f === "latest.yml");
  if (!setup) throw new Error(`No setup .exe found in ${SOURCE}`);

  const setupPath = path.join(SOURCE, setup);
  const setupBuf = readFileSync(setupPath);
  const version = VERSION || (setup.match(/-(\d+\.\d+\.\d+)\.exe$/) || [])[1] || "unknown";

  // Each version's files live in a versioned folder, e.g. v0.1.50/.
  const prefix = `v${version}/`;
  const setupKey = `${prefix}${setup}`;
  const blockmapKey = blockmap ? `${prefix}${blockmap}` : null;
  const latestYmlKey = latestYml ? `${prefix}${latestYml}` : null;

  const latest = {
    version,
    size: bytes(setupBuf.length),
    url: {
      setup: `${PUBLIC}/${setupKey}`,
      latestYml: latestYmlKey ? `${PUBLIC}/${latestYmlKey}` : null,
      blockmap: blockmapKey ? `${PUBLIC}/${blockmapKey}` : null,
    },
  };
  if (latestYml) {
    const m = readFileSync(path.join(SOURCE, latestYml), "utf8").match(/releaseDate:\s*([^\s]+)/);
    if (m) latest.publishedAt = m[1].replace(/\.\d{3}Z/, "Z");
  }

  console.log(`Publishing Fig POS ${version} → ${BUCKET}/${prefix}`);
  await putObject(setupKey, setupBuf, "application/octet-stream");
  if (blockmapKey) {
    await putObject(blockmapKey, readFileSync(path.join(SOURCE, blockmap)), "application/octet-stream");
  }
  if (latestYmlKey) {
    await putObject(latestYmlKey, readFileSync(path.join(SOURCE, latestYml)), "application/octet-stream");
  }
  await putObject("latest.json", Buffer.from(JSON.stringify(latest, null, 2)), "application/json");
  await putObject("latest.js", Buffer.from(`window.FIG_LATEST=${JSON.stringify(latest)};`), "application/javascript");

  // Maintain a versions.json listing the last 5 releases so visitors can
  // download recent versions (older installers stay in the bucket untouched).
  const KEEP = 5;
  let history = [];
  const existing = await getObject("versions.json");
  if (existing) {
    try {
      const parsed = JSON.parse(existing);
      history = Array.isArray(parsed.versions) ? parsed.versions : [];
    } catch {
      history = [];
    }
  }
  const entry = {
    version,
    size: latest.size,
    publishedAt: latest.publishedAt || null,
    url: { setup: latest.url.setup, blockmap: latest.url.blockmap },
  };
  history = [entry, ...history.filter((v) => v.version !== version)].slice(0, KEEP);
  await putObject(
    "versions.json",
    Buffer.from(JSON.stringify({ versions: history }, null, 2)),
    "application/json",
  );
  await putObject(
    "versions.js",
    Buffer.from(`window.FIG_VERSIONS=${JSON.stringify({ versions: history })};`),
    "application/javascript",
  );

  console.log("Done. Download page:");
  console.log(`  ${PUBLIC}`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});