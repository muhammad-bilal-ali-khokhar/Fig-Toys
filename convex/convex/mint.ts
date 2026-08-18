import { httpAction, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { isAdminRequest, json } from "./lib/auth";

async function generateUniqueCode(ctx: {
  db: {
    query: (
      table: "activationCodes",
    ) => {
      withIndex: (
        index: "by_code",
        filter: (q: { eq: (field: "code", value: string) => unknown }) => unknown,
      ) => {
        unique: () => Promise<{ _id: string } | null>;
      };
    };
  };
}): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    let code = "";
    for (let i = 0; i < 10; i++) code += Math.floor(Math.random() * 10);
    const existing = await ctx.db
      .query("activationCodes")
      .withIndex("by_code", (q) => q.eq("code", code))
      .unique();
    if (!existing) return code;
  }
  throw new Error("Could not generate a unique activation code. Try again.");
}

export const createCode = internalMutation({
  args: {
    customerName: v.string(),
    edition: v.string(),
    maxDevices: v.number(),
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

  let body: { customerName?: unknown; edition?: unknown; maxDevices?: unknown; expiresAt?: unknown } | null = null;
  try {
    body = await request.json();
  } catch {
    return json({ message: "Invalid request body." }, 400);
  }

  const customerName = typeof body?.customerName === "string" ? body.customerName.trim() : "";
  const edition = typeof body?.edition === "string" ? body.edition.trim() : "PRO";
  const maxDevices = typeof body?.maxDevices === "number" ? body.maxDevices : 1;
  const expiresAt = typeof body?.expiresAt === "number" ? body.expiresAt : undefined;

  if (!customerName) {
    return json({ message: "customerName is required." }, 400);
  }

  const result = await ctx.runMutation(internal.mint.createCode, {
    customerName,
    edition,
    maxDevices,
    expiresAt,
  });

  return json(result, 200);
});