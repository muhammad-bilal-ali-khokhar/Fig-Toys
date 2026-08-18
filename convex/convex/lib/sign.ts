import { signAsync } from "@noble/ed25519";

export const LICENSE_PREFIX = "FIG-";
export const LICENSE_ISSUER = "MYKO";

export type TokenPayload = {
  sub: string;
  iss: string;
  exp: number | null;
  maxDevices: number;
  iat: number;
};

function b64url(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function decodePem(pem: string): Uint8Array {
  const base64 = pem
    .replace(/-----BEGIN [^-]+-----/, "")
    .replace(/-----END [^-]+-----/, "")
    .replace(/\s+/g, "");
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function seedFromPrivateKey(pem: string): Uint8Array {
  const der = decodePem(pem);
  return der.slice(der.length - 32);
}

export function getSigningSeed(): Uint8Array {
  const pem = process.env.LICENSE_PRIVATE_KEY?.trim();
  if (!pem) {
    throw new Error("LICENSE_PRIVATE_KEY is not configured on this Convex project.");
  }
  return seedFromPrivateKey(pem);
}

export async function buildLicenseToken(seed: Uint8Array, payload: TokenPayload): Promise<string> {
  const canonical = JSON.stringify(payload);
  const bytes = new TextEncoder().encode(canonical);
  const sig = await signAsync(bytes, seed);
  return `${LICENSE_PREFIX}${b64url(bytes)}.${b64url(sig)}`;
}