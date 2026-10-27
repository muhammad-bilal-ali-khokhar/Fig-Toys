import { env } from "../../core/config/env";
import { prisma } from "../../core/lib/prisma";
import { getDeviceId } from "../../core/lib/device";
import type { CrashReportInput } from "./schemas";

async function forwardToConvex(
  input: CrashReportInput,
  deviceId: string,
  clientId: string | undefined,
  licenseKey: string | undefined,
): Promise<string> {
  const redeemUrl = env.LICENSE_REDEEM_URL?.trim();
  if (!redeemUrl) return "";
  try {
    const response = await fetch(redeemUrl.replace(/\/redeem$/, "/crash/report"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId,
        deviceId,
        licenseKey,
        app: input.app,
        version: input.version,
        platform: input.platform,
        title: input.title,
        message: input.body,
        logTail: input.logTail,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) return "";
    const body = (await response.json().catch(() => null)) as
      | { id?: unknown }
      | null;
    return typeof body?.id === "string" ? body.id : "";
  } catch {
    return "";
  }
}

export async function submitCrashReport(input: CrashReportInput) {
  const stored = await prisma.crashReport.create({
    data: {
      app: input.app,
      version: input.version || null,
      platform: input.platform || null,
      message: input.body,
      stack: input.logTail || null,
    },
  });

  const [deviceId, license] = await Promise.all([
    getDeviceId(),
    prisma.license.findUnique({
      where: { id: "store" },
      select: { clientId: true, key: true },
    }),
  ]);

  await forwardToConvex(
    input,
    deviceId,
    license?.clientId ?? undefined,
    license?.key ?? undefined,
  );

  return { stored: true, id: stored.id, url: "" };
}
