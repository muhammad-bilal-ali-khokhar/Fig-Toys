import { httpAction, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { buildLicenseToken, getSigningSeed, LICENSE_ISSUER } from "./lib/sign";
import { json } from "./lib/auth";

export const recordActivation = internalMutation({
  args: {
    code: v.string(),
    deviceId: v.string(),
  },
  handler: async (ctx, { code, deviceId }) => {
    const row = await ctx.db
      .query("activationCodes")
      .withIndex("by_code", (q) => q.eq("code", code))
      .unique();
    if (!row) {
      throw new ConvexError("Invalid activation code.");
    }

    const now = Date.now();
    if (row.status === "disabled") {
      throw new ConvexError("This activation code has been disabled.");
    }
    if (row.expiresAt !== undefined && row.expiresAt < now) {
      throw new ConvexError("This activation code has expired.");
    }

    const existing = await ctx.db
      .query("activations")
      .withIndex("by_code", (q) => q.eq("code", code))
      .filter((q) => q.eq(q.field("deviceId"), deviceId))
      .unique();

    if (!existing) {
      const activeCount = (
        await ctx.db.query("activations").withIndex("by_code", (q) => q.eq("code", code)).collect()
      ).filter((a) => a.revokedAt === undefined).length;
      if (activeCount >= row.maxDevices) {
        throw new ConvexError("This activation code is already in use on the maximum number of devices.");
      }
      await ctx.db.insert("activations", { code, deviceId, activatedAt: now });
    }

    await ctx.db.patch(row._id, { status: "active", redeemedAt: row.redeemedAt ?? now });

    return {
      customerName: row.customerName,
      edition: row.edition,
      maxDevices: row.maxDevices,
      expiresAt: row.expiresAt,
      deviceId,
    };
  },
});

export const redeem = httpAction(async (ctx, request) => {
  let body: { code?: unknown; deviceId?: unknown } | null = null;
  try {
    body = await request.json();
  } catch {
    return json({ message: "Invalid request body." }, 400);
  }

  const code = typeof body?.code === "string" ? body.code.trim() : "";
  const deviceId = typeof body?.deviceId === "string" ? body.deviceId.trim() : "";

  if (!/^\d{10}$/.test(code)) {
    return json({ message: "Enter a valid 10-digit activation code." }, 400);
  }
  if (!deviceId) {
    return json({ message: "Missing deviceId." }, 400);
  }

  let result: {
    customerName: string;
    edition: string;
    maxDevices: number;
    expiresAt?: number;
    deviceId: string;
  };
  try {
    result = await ctx.runMutation(internal.redeem.recordActivation, { code, deviceId });
  } catch (e) {
    const message = e instanceof ConvexError ? String(e.data) : "Activation failed.";
    return json({ message }, 400);
  }

  let licenseToken: string;
  try {
    const seed = getSigningSeed();
    licenseToken = await buildLicenseToken(seed, {
      sub: result.customerName,
      iss: LICENSE_ISSUER,
      exp: result.expiresAt !== undefined ? Math.floor(result.expiresAt / 1000) : null,
      maxDevices: result.maxDevices,
      iat: Math.floor(Date.now() / 1000),
    });
  } catch (e) {
    return json({ message: e instanceof Error ? e.message : "Could not sign the license key." }, 500);
  }

  return json(
    {
      licenseToken,
      customerName: result.customerName,
      edition: result.edition,
      expiresAt: result.expiresAt !== undefined ? new Date(result.expiresAt).toISOString() : null,
      maxDevices: result.maxDevices,
      deviceId: result.deviceId,
    },
    200,
  );
});