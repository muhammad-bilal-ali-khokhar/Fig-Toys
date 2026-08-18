import { prisma } from "../../core/lib/prisma";
import { getDeviceId } from "../../core/lib/device";
import { verifyLicenseKey, type LicensePayload } from "../../core/lib/license";
import { ApiError } from "../../core/middleware/error";
import { env } from "../../core/config/env";
import type { ActivateInput, LicenseStatus, RedeemInput } from "./schemas";

const LICENSE_ID = "store";

export async function getLicenseStatus(): Promise<LicenseStatus> {
  const license = await prisma.license.findUnique({ where: { id: LICENSE_ID } });
  if (!license) {
    return {
      status: "UNLICENSED",
      customerName: null,
      edition: "PRO",
      expiresAt: null,
      maxDevices: 1,
      deviceId: await getDeviceId(),
    };
  }

  const expired = license.expiresAt ? license.expiresAt.getTime() < Date.now() : false;
  return {
    status: expired ? "EXPIRED" : "ACTIVE",
    customerName: license.customerName,
    edition: license.edition,
    expiresAt: license.expiresAt ? license.expiresAt.toISOString() : null,
    maxDevices: license.maxDevices,
    deviceId: license.deviceId,
  };
}

export async function activateLicense(input: ActivateInput) {
  const result = verifyLicenseKey(input.key);
  if (!result.valid) {
    throw new ApiError(400, `license.${result.reason}`, licenseErrorText(result.reason));
  }

  const deviceId = await getDeviceId();
  return persistLicense(input.key.trim(), result.payload, deviceId);
}

export async function redeemLicense(input: RedeemInput) {
  const url = env.LICENSE_REDEEM_URL?.trim();
  if (!url) {
    throw new ApiError(503, "license.redeem_not_configured", "Online activation is not configured.");
  }

  const deviceId = await getDeviceId();

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: input.code, deviceId }),
      signal: AbortSignal.timeout(env.LICENSE_REDEEM_TIMEOUT_MS),
    });
  } catch {
    throw new ApiError(502, "license.redeem_unreachable", "Could not reach the license server. Check your internet connection and try again.");
  }

  let body: { licenseToken?: string; deviceId?: string; message?: string } | null = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }

  if (!res.ok) {
    const message =
      body && typeof body.message === "string" ? body.message : "This license code was rejected.";
    throw new ApiError(400, "license.redeem_rejected", message);
  }

  const token = body?.licenseToken;
  if (typeof token !== "string" || !token) {
    throw new ApiError(502, "license.redeem_invalid_response", "The license server returned an invalid response.");
  }

  const result = verifyLicenseKey(token);
  if (!result.valid) {
    throw new ApiError(400, `license.${result.reason}`, licenseErrorText(result.reason));
  }

  if (body?.deviceId && body.deviceId !== deviceId) {
    throw new ApiError(409, "license.used_elsewhere", "This code is already activated on another device.");
  }

  return persistLicense(token, result.payload, deviceId);
}

async function persistLicense(key: string, payload: LicensePayload, deviceId: string) {
  const existing = await prisma.license.findUnique({ where: { id: LICENSE_ID } });

  if (existing && existing.status === "ACTIVE" && existing.deviceId && existing.deviceId !== deviceId) {
    throw new ApiError(
      409,
      "license.used_elsewhere",
      "This license is already activated on another device.",
    );
  }

  const expiresAt = payload.exp ? new Date(payload.exp * 1000) : null;
  const now = new Date();

  await prisma.license.upsert({
    where: { id: LICENSE_ID },
    update: {
      key,
      customerName: payload.sub,
      edition: "PRO",
      issuedAt: payload.iat || null,
      expiresAt,
      maxDevices: payload.maxDevices,
      deviceId,
      activatedAt: existing?.activatedAt ?? now,
      status: "ACTIVE",
      lastVerifiedAt: now,
    },
    create: {
      id: LICENSE_ID,
      key,
      customerName: payload.sub,
      edition: "PRO",
      issuedAt: payload.iat || null,
      expiresAt,
      maxDevices: payload.maxDevices,
      deviceId,
      activatedAt: now,
      status: "ACTIVE",
      lastVerifiedAt: now,
    },
  });

  return {
    status: "ACTIVE" as const,
    customerName: payload.sub,
    edition: "PRO",
    expiresAt: expiresAt ? expiresAt.toISOString() : null,
    maxDevices: payload.maxDevices,
    deviceId,
  };
}

function licenseErrorText(reason: string): string {
  switch (reason) {
    case "invalid_format":
      return "That doesn't look like a valid license key.";
    case "invalid_payload":
      return "This license key is not valid for Fig POS.";
    case "bad_signature":
      return "This license key has been altered or forged.";
    case "expired":
      return "This license key has expired.";
    case "not_configured":
      return "License verification is not configured on this server.";
    default:
      return "This license key could not be verified.";
  }
}