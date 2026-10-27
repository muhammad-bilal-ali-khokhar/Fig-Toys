import {
  fromBase64Url,
  pbkdf2,
  textBytes,
  toBase64Url,
  constantTimeEqual,
} from "@/lib/server/encoding";

const ITERATIONS = 100_000;

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await pbkdf2(password, salt, ITERATIONS);
  return `pbkdf2$${ITERATIONS}$${toBase64Url(salt)}$${toBase64Url(hash)}`;
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const [scheme, iterationsRaw, saltRaw, hashRaw] = stored.split("$");
  if (scheme !== "pbkdf2" || !iterationsRaw || !saltRaw || !hashRaw) return false;
  const iterations = Number(iterationsRaw);
  if (!Number.isFinite(iterations) || iterations <= 0) return false;
  const salt = fromBase64Url(saltRaw);
  const expected = fromBase64Url(hashRaw);
  const actual = await pbkdf2(password, salt, iterations);
  if (actual.length !== expected.length) return false;
  return constantTimeEqual(toBase64Url(actual), toBase64Url(expected));
}

export function passwordBytes(password: string): Uint8Array {
  return textBytes(password);
}
