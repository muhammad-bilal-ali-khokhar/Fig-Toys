import { createPublicKey, verify } from "node:crypto";
import { env } from "../config/env";

export const LICENSE_PREFIX = "FIG-";
export const LICENSE_ISSUER = "MYKO";

export type LicensePayload = {
  sub: string;
  iss: string;
  exp: number | null;
  maxDevices: number;
  iat: number;
};

export type LicenseVerification =
  | { valid: true; payload: LicensePayload }
  | { valid: false; reason: string };

export function parseLicenseKey(key: string): { payloadB64: string; sigB64: string } | null {
  const trimmed = (key || "").trim();
  const body = trimmed.startsWith(LICENSE_PREFIX) ? trimmed.slice(LICENSE_PREFIX.length) : trimmed;
  const sep = body.indexOf(".");
  if (sep < 0) return null;
  const payloadB64 = body.slice(0, sep);
  const sigB64 = body.slice(sep + 1);
  if (!payloadB64 || !sigB64) return null;
  return { payloadB64, sigB64 };
}

function decodePayload(payloadB64: string): LicensePayload | null {
  try {
    const text = Buffer.from(payloadB64, "base64url").toString("utf8");
    const raw = JSON.parse(text) as Partial<LicensePayload>;
    if (typeof raw.sub !== "string" || !raw.sub) return null;
    if (raw.iss !== LICENSE_ISSUER) return null;
    return {
      sub: raw.sub,
      iss: raw.iss,
      exp: typeof raw.exp === "number" ? raw.exp : null,
      maxDevices: typeof raw.maxDevices === "number" && raw.maxDevices > 0 ? raw.maxDevices : 1,
      iat: typeof raw.iat === "number" ? raw.iat : 0,
    };
  } catch {
    return null;
  }
}

export function verifyLicenseKey(key: string): LicenseVerification {
  const parts = parseLicenseKey(key);
  if (!parts) {
    return { valid: false, reason: "invalid_format" };
  }

  const publicPem = (env.LICENSE_PUBLIC_KEY || "").trim();
  if (!publicPem) {
    return { valid: false, reason: "not_configured" };
  }

  const payload = decodePayload(parts.payloadB64);
  if (!payload) {
    return { valid: false, reason: "invalid_payload" };
  }

  const payloadBytes = Buffer.from(parts.payloadB64, "base64url");
  const sigBytes = Buffer.from(parts.sigB64, "base64url");

  let ok = false;
  try {
    const publicKey = createPublicKey(publicPem);
    ok = verify(null, payloadBytes, publicKey, sigBytes);
  } catch {
    ok = false;
  }

  if (!ok) {
    return { valid: false, reason: "bad_signature" };
  }

  if (payload.exp !== null && payload.exp * 1000 < Date.now()) {
    return { valid: false, reason: "expired" };
  }

  return { valid: true, payload };
}
