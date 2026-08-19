import type { Request, NextFunction, Response } from "express";
import { prisma } from "./prisma";
import { env } from "../config/env";
import { ApiError } from "../middleware/error";

export function buildLoginKeys(username: string, ip: string): string[] {
  const upper = username.toUpperCase();
  return [`user:${upper}`, `ip:${ip || "unknown"}`];
}

function step() {
  return env.LOGIN_RATE_LIMIT_MAX;
}

function lockoutSeconds(failures: number, cap: number) {
  if (failures < step()) return 0;
  const tier = Math.floor(failures / step()) - 1;
  const seconds = env.LOGIN_LOCKOUT_BASE_SECONDS * Math.pow(env.LOGIN_LOCKOUT_MULTIPLIER, tier);
  return Math.min(cap, seconds);
}

function tierIndex(failures: number) {
  return Math.floor(failures / step());
}

function capForKey(key: string) {
  return key.startsWith("ip:") ? Math.min(env.LOGIN_LOCKOUT_CAP_SECONDS, 60) : env.LOGIN_LOCKOUT_CAP_SECONDS;
}

export async function assertLoginAllowed(keys: string[]) {
  const rows = await prisma.loginAttempt.findMany({
    where: { key: { in: keys } },
  });
  const now = Date.now();
  let retryAfterMs = 0;
  for (const row of rows) {
    if (row.blockedUntil && row.blockedUntil.getTime() > now) {
      retryAfterMs = Math.max(retryAfterMs, row.blockedUntil.getTime() - now);
    }
  }
  if (retryAfterMs > 0) {
    const seconds = Math.max(1, Math.ceil(retryAfterMs / 1000));
    throw new ApiError(
      429,
      "auth.rate_limited",
      `Too many attempts. Try again in ${seconds} second${seconds === 1 ? "" : "s"}.`,
      { retryAfterMs, retryAfterSeconds: seconds },
    );
  }
}

export async function registerLoginFailure(keys: string[], username: string) {
  const upper = username.toUpperCase();
  const user = await prisma.user.findUnique({
    where: { username: upper },
    select: { id: true },
  });

  for (const key of keys) {
    const cap = capForKey(key);
    const row = await prisma.loginAttempt.upsert({
      where: { key },
      update: { failures: { increment: 1 } },
      create: { key, failures: 1 },
    });

    const failures = row.failures;
    const seconds = lockoutSeconds(failures, cap);
    if (seconds > 0) {
      await prisma.loginAttempt.update({
        where: { key },
        data: { blockedUntil: new Date(Date.now() + seconds * 1000) },
      });
    }

    const tier = tierIndex(failures);
    if (user && tier > 0 && row.lastAlertedTier < tier) {
      await prisma.loginAttempt.update({
        where: { key },
        data: { lastAlertedTier: tier },
      });
      await prisma.auditLog.create({
        data: {
          userId: user.id,
          action: "AUTH.BRUTE_FORCE",
          entity: "User",
          entityId: user.id,
          details: `Brute-force suspected: ${failures} failed login attempts for ${upper}. Locked out for ${seconds}s.`,
        },
      });
    }
  }
}

export async function registerLoginSuccess(keys: string[]) {
  await prisma.loginAttempt.updateMany({
    where: { key: { in: keys } },
    data: { failures: 0, blockedUntil: null, lastAlertedTier: 0 },
  });
}

export async function loginThrottle(req: Request, _res: Response, next: NextFunction) {
  const username = String(req.body?.username ?? "").toUpperCase();
  const keys = buildLoginKeys(username, req.ip ?? "unknown");
  try {
    await assertLoginAllowed(keys);
    next();
  } catch (e) {
    next(e);
  }
}