import { prisma } from "../../core/lib/prisma";
import { getDeviceId } from "../../core/lib/device";
import { verifyLicenseKey } from "../../core/lib/license";
import { ApiError } from "../../core/middleware/error";
import type { ActivateInput, LicenseStatus } from "./schemas";

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

  const payload = result.payload;
  const deviceId = await getDeviceId();
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
      key: input.key.trim(),
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
      key: input.key.trim(),
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