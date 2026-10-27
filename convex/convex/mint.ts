import { httpAction, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { isAdminRequest, json } from "./lib/auth";
import { generateUniqueCode } from "./lib/data";

export const createCode = internalMutation({
  args: {
    customerName: v.string(),
    edition: v.string(),
    maxDevices: v.number(),
    pricePkr: v.optional(v.number()),
    expiresAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const code = await generateUniqueCode(ctx);
    await ctx.db.insert("activationCodes", {
      code,
      status: "available",
      customerName: args.customerName,
      edition: args.edition,
      maxDevices: args.maxDevices,
      pricePkr: args.pricePkr,
      expiresAt: args.expiresAt,
      createdAt: Date.now(),
    });
    return { code };
  },
});

export const mintActivationCode = httpAction(async (ctx, request) => {
  if (!isAdminRequest(request)) {
    return json({ message: "Unauthorized." }, 401);
  }

  let body: { customerName?: unknown; edition?: unknown; maxDevices?: unknown; pricePkr?: unknown; expiresAt?: unknown } | null = null;
  try {
    body = await request.json();
  } catch {
    return json({ message: "Invalid request body." }, 400);
  }

  const customerName = typeof body?.customerName === "string" ? body.customerName.trim() : "";
  const edition = typeof body?.edition === "string" ? body.edition.trim() : "PRO";
  const maxDevices = typeof body?.maxDevices === "number" ? body.maxDevices : 1;
  const pricePkr =
    typeof body?.pricePkr === "number" && body.pricePkr > 0
      ? Math.round(body.pricePkr)
      : undefined;
  const expiresAt = typeof body?.expiresAt === "number" ? body.expiresAt : undefined;

  if (!customerName) {
    return json({ message: "customerName is required." }, 400);
  }

  const result = await ctx.runMutation(internal.mint.createCode, {
    customerName,
    edition,
    maxDevices,
    pricePkr,
    expiresAt,
  });

  return json(result, 200);
});