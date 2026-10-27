import { httpAction, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { buildLicenseToken, getSigningSeed, LICENSE_ISSUER } from "./lib/sign";
import { json } from "./lib/auth";
import { findClientById, logActivity, newId } from "./lib/data";

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
        throw new ConvexError(
          `This code is already active on ${row.maxDevices} device${row.maxDevices === 1 ? "" : "s"}. Ask the owner to remove the old device or issue a new code.`,
        );
      }
      await ctx.db.insert("activations", { code, deviceId, activatedAt: now });
    } else if (existing.revokedAt !== undefined) {
      await ctx.db.patch(existing._id, {
        revokedAt: undefined,
        activatedAt: now,
      });
    }

    await ctx.db.patch(row._id, { status: "active", redeemedAt: row.redeemedAt ?? now });

    let clientId = row.clientId;
    if (!clientId) {
      const createdAt = Date.now();
      clientId = newId("c");
      await ctx.db.insert("clients", {
        id: clientId,
        shopName: row.customerName,
        ownerName: row.customerName,
        email: "",
        phone: "",
        city: "",
        deviceId,
        registeredAt: createdAt,
        lastSeenAt: createdAt,
        plan: "monthly",
        monthlyPricePkr: row.pricePkr ?? 5000,
        durationDays: row.durationDays ?? 30,
        trialEndsAt: createdAt,
        paidUntil: row.expiresAt,
        lifetime: row.expiresAt === undefined,
        blocked: false,
        notes: "Activated from a pre-sale code.",
        source: "pos",
        activationCode: code,
      });
      await ctx.db.patch(row._id, { clientId });
    }

    if (clientId) {
      const client = await findClientById(ctx, clientId);
      if (client) {
        await ctx.db.patch(client._id, {
          deviceId,
          lastSeenAt: now,
          activationCode: code,
          plan: "monthly",
          paidUntil: row.expiresAt ?? client.paidUntil,
          lifetime: row.expiresAt === undefined ? true : Boolean(client.lifetime),
        });
        await logActivity(ctx, {
          actor: client.shopName,
          clientId: client.id,
          kind: "key",
          message: `Activated code ${code} on a device.`,
        });
      }
    }

    return {
      customerName: row.customerName,
      edition: row.edition,
      maxDevices: row.maxDevices,
      pricePkr: row.pricePkr,
      expiresAt: row.expiresAt,
      deviceId,
      clientId,
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
    pricePkr?: number;
    expiresAt?: number;
    deviceId: string;
    clientId?: string | null;
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
      pricePkr: result.pricePkr,
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
      pricePkr: result.pricePkr ?? null,
      deviceId: result.deviceId,
      clientId: result.clientId ?? null,
    },
    200,
  );
});