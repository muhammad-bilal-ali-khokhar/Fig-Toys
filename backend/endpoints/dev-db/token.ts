import crypto from "node:crypto";
import type { Request, Response } from "express";
import { env } from "../../core/config/env";

const DEV_TOKEN_TTL_MS = 1000 * 60 * 60 * 8;
export const DEV_COOKIE_NAME = "fig.dev";

function secret(): string {
  return `${env.JWT_SECRET}:dev-portal`;
}

export function checkPassword(password: string): boolean {
  const a = Buffer.from(password);
  const b = Buffer.from(env.DEV_PORTAL_PASSWORD);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function issueDevToken(): { token: string; maxAge: number } {
  const exp = Date.now() + DEV_TOKEN_TTL_MS;
  const payload = `dev.${exp}`;
  const sig = crypto.createHmac("sha256", secret()).update(payload).digest("hex");
  return { token: `${payload}.${sig}`, maxAge: DEV_TOKEN_TTL_MS / 1000 };
}

export function verifyDevToken(token: string | undefined | null): boolean {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== "dev") return false;
  const [kind, expRaw, sig] = parts;
  const expected = crypto
    .createHmac("sha256", secret())
    .update(`${kind}.${expRaw}`)
    .digest("hex");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;
  return Number(expRaw) > Date.now();
}

export function getDevToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) return header.slice("Bearer ".length);
  const raw = req.headers.cookie;
  if (!raw) return null;
  for (const part of raw.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    if (part.slice(0, idx).trim() === DEV_COOKIE_NAME) {
      return decodeURIComponent(part.slice(idx + 1).trim());
    }
  }
  return null;
}

export function setDevCookie(res: Response, token: string, maxAge: number): void {
  res.cookie(DEV_COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge,
  });
}

export function clearDevCookie(res: Response): void {
  res.clearCookie(DEV_COOKIE_NAME, {
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });
}
