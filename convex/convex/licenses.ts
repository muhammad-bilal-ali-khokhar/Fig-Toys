import { httpAction, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { isAdminRequest, json } from "./lib/auth";

export const getDetails = internalQuery({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    const row = await ctx.db
      .query("activationCodes")
      .withIndex("by_code", (q) => q.eq("code", code.trim()))
      .unique();
    if (!row) {
      throw new ConvexError("Activation code not found.");
    }

    const activations = (
      await ctx.db
        .query("activations")
        .withIndex("by_code", (q) => q.eq("code", row.code))
        .collect()
    ).map((a) => ({
      deviceId: a.deviceId,
      activatedAt: a.activatedAt,
      revokedAt: a.revokedAt ?? null,
    }));

    return {
      code: row.code,
      status: row.status,
      customerName: row.customerName,
      edition: row.edition,
      maxDevices: row.maxDevices,
      expiresAt: row.expiresAt ?? null,
      createdAt: row.createdAt,
      redeemedAt: row.redeemedAt ?? null,
      activeDevices: activations.filter((a) => a.revokedAt === null).length,
      activations,
    };
  },
});

export const getActivationCodeDetails = httpAction(async (ctx, request) => {
  if (!isAdminRequest(request)) {
    return json({ message: "Unauthorized." }, 401);
  }

  let body: { code?: unknown } | null = null;
  try {
    body = await request.json();
  } catch {
    return json({ message: "Invalid request body." }, 400);
  }

  const code = typeof body?.code === "string" ? body.code.trim() : "";
  if (!code) {
    return json({ message: "code is required." }, 400);
  }

  try {
    const details = await ctx.runQuery(internal.licenses.getDetails, { code });
    return json(details, 200);
  } catch (e) {
    const message = e instanceof ConvexError ? String(e.data) : "Activation code not found.";
    return json({ message }, 404);
  }
});