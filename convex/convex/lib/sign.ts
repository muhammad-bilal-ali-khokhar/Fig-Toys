import { getPublicKeyAsync, signAsync, verifyAsync } from "@noble/ed25519";

export const LICENSE_PREFIX = "FIG-";
export const LICENSE_ISSUER = "MYKO";

export type TokenPayload = {
  sub: string;
  iss: string;
  exp: number | null;
  maxDevices: number;
  iat: number;
  pricePkr?: number;
};

function b64url(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const bin = atob(padded);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
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
export async function verifyLicenseToken(token: string): Promise<TokenPayload | null> {
  const body = token.startsWith(LICENSE_PREFIX)
    ? token.slice(LICENSE_PREFIX.length)
    : token;
  const [payloadB64, sigB64] = body.split(".");
  if (!payloadB64 || !sigB64) return null;
  try {
    const payloadBytes = fromB64url(payloadB64);
    const signature = fromB64url(sigB64);
    const publicKey = await getPublicKeyAsync(getSigningSeed());
    const valid = await verifyAsync(signature, payloadBytes, publicKey);
    if (!valid) return null;
    const raw = JSON.parse(new TextDecoder().decode(payloadBytes)) as Partial<TokenPayload>;
    if (typeof raw.sub !== "string" || !raw.sub) return null;
    if (raw.iss !== LICENSE_ISSUER) return null;
    return {
      sub: raw.sub,
      iss: raw.iss,
      exp: typeof raw.exp === "number" ? raw.exp : null,
      maxDevices:
        typeof raw.maxDevices === "number" && raw.maxDevices > 0
          ? raw.maxDevices
          : 1,
      iat: typeof raw.iat === "number" ? raw.iat : 0,
      pricePkr:
        typeof raw.pricePkr === "number" && raw.pricePkr > 0
          ? Math.round(raw.pricePkr)
          : undefined,
    };
  } catch {
    return null;
  }
}
