import { cookies } from "next/headers";
import { sessionSecret } from "@/lib/server/convex";
import {
  bytesText,
  constantTimeEqual,
  fromBase64Url,
  hmacSha256,
  textBytes,
  toBase64Url,
} from "@/lib/server/encoding";

export const ADMIN_COOKIE = "fig_admin";
const MAX_AGE = 60 * 60 * 24 * 7;
export type AdminRole = "owner" | "admin" | "support";
export type AdminSession = { email: string; role: AdminRole };

function isRole(value: string): value is AdminRole {
  return value === "owner" || value === "admin" || value === "support";
}

export async function createSessionValue(
  email: string,
  role: AdminRole,
): Promise<string> {
  const payload = `${email}|${role}|${Date.now() + MAX_AGE * 1000}`;
  const encoded = toBase64Url(textBytes(payload));
  const secret = sessionSecret();
  if (!secret) throw new Error("ADMIN_SESSION_SECRET is not configured.");
  return `${encoded}.${await hmacSha256(secret, payload)}`;
}

export async function verifySessionValue(
  value: string | undefined,
): Promise<AdminSession | null> {
  if (!value) return null;
  const [encoded, provided] = value.split(".");
  if (!encoded || !provided) return null;
  let payload: string;
  try {
    payload = bytesText(fromBase64Url(encoded));
  } catch {
    return null;
  }
  const secret = sessionSecret();
  if (!secret) return null;
  const expected = await hmacSha256(secret, payload);
  if (!constantTimeEqual(provided, expected)) return null;
  const [email, role, expires] = payload.split("|");
  if (!email || !role || !expires) return null;
  if (!isRole(role)) return null;
  if (Number(expires) < Date.now()) return null;
  return { email, role };
}

export async function readAdminSession(): Promise<AdminSession | null> {
  const store = await cookies();
  return verifySessionValue(store.get(ADMIN_COOKIE)?.value);
}

export function sessionCookie(value: string) {
  return {
    name: ADMIN_COOKIE,
    value,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  };
}

export function clearSessionCookie() {
  return {
    name: ADMIN_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  };
}
