import { httpAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { ConvexError, v } from "convex/values";
import { json } from "./lib/auth";
import {
  DAY_MS,
  findClientByDevice,
  findClientById,
  getAdmin,
  getPricing,
  logActivity,
  mapActivity,
  mapClient,
  mapKey,
  mapPayment,
  newId,
} from "./lib/data";
import { verifyLicenseToken } from "./lib/sign";

function clientStatus(client: any, now: number) {
  if (client.blocked) return "blocked" as const;
  if (client.lifetime || (client.paidUntil ?? 0) > now) return "active" as const;
  if (client.trialEndsAt > now) return "trial" as const;
  return "expired" as const;
}

export const registerTrial = internalMutation({
  args: {
    deviceId: v.string(),
    shopName: v.string(),
    ownerName: v.string(),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    city: v.optional(v.string()),
  },
  handler: async (ctx, input) => {
    const now = Date.now();
    const existing = await findClientByDevice(ctx, input.deviceId);
    if (existing) {
      return {
        clientId: existing.id,
        status: clientStatus(existing, now),
        trialEndsAt: new Date(existing.trialEndsAt).toISOString(),
        paidUntil: existing.paidUntil
          ? new Date(existing.paidUntil).toISOString()
          : null,
        lifetime: Boolean(existing.lifetime),
        blocked: Boolean(existing.blocked),
        monthlyPricePkr: existing.monthlyPricePkr,
        days: 0,
        existing: true,
      };
    }

    const pricing = await getPricing(ctx);
    const trialDays = pricing.trialDays > 0 ? pricing.trialDays : 14;
    const trialEndsAt = now + trialDays * DAY_MS;
    const id = newId("c");
    const shopName = input.shopName.trim() || "My Shop";
    const ownerName = input.ownerName.trim() || shopName;
    await ctx.db.insert("clients", {
      id,
      shopName,
      ownerName,
      email: input.email?.trim() ?? "",
      phone: input.phone?.trim() ?? "",
      city: input.city?.trim() ?? "",
      deviceId: input.deviceId,
      registeredAt: now,
      lastSeenAt: now,
      plan: "trial",
      monthlyPricePkr: pricing.defaultMonthlyPricePkr,
      durationDays: pricing.durationDays,
      trialEndsAt,
      lifetime: false,
      blocked: false,
      notes: "Trial started from Fig POS setup.",
      source: "pos",
    });
    await logActivity(ctx, {
      actor: shopName,
      clientId: id,
      kind: "register",
      message: `Started a ${trialDays} day trial for ${shopName}.`,
    });
    return {
      clientId: id,
      status: "trial" as const,
      trialEndsAt: new Date(trialEndsAt).toISOString(),
      paidUntil: null,
      lifetime: false,
      blocked: false,
      monthlyPricePkr: pricing.defaultMonthlyPricePkr,
      days: trialDays,
      existing: false,
    };
  },
});

export const registerTrialHttp = httpAction(async (ctx, request) => {
  let body: any = null;
  try {
    body = await request.json();
  } catch {
    return json({ message: "Invalid request body." }, 400);
  }
  const deviceId = typeof body?.deviceId === "string" ? body.deviceId.trim() : "";
  if (!deviceId) {
    return json({ message: "deviceId is required." }, 400);
  }
  const result = await ctx.runMutation(internal.portal.registerTrial, {
    deviceId,
    shopName: typeof body?.shopName === "string" ? body.shopName : "",
    ownerName: typeof body?.ownerName === "string" ? body.ownerName : "",
    email: typeof body?.email === "string" ? body.email : undefined,
    phone: typeof body?.phone === "string" ? body.phone : undefined,
    city: typeof body?.city === "string" ? body.city : undefined,
  });
  return json(result, 200);
});

export const portalSnapshot = internalQuery({
  args: { clientId: v.string() },
  handler: async (ctx, { clientId }) => {
    const pricing = await getPricing(ctx);
    const admin = await getAdmin(ctx);
    if (!clientId) {
      return {
        clients: [],
        payments: [],
        keys: [],
        crashReports: [],
        activity: [],
        pricing,
        admin,
      };
    }
    const client = await findClientById(ctx, clientId);
    if (!client) {
      return {
        clients: [],
        payments: [],
        keys: [],
        crashReports: [],
        activity: [],
        pricing,
        admin,
      };
    }
    const payments = await ctx.db
      .query("payments")
      .withIndex("by_client", (q) => q.eq("clientId", clientId))
      .collect();
    const keys = await ctx.db
      .query("activationCodes")
      .withIndex("by_client", (q) => q.eq("clientId", clientId))
      .collect();
    const activity = (await ctx.db.query("activity").collect())
      .filter((event) => event.clientId === clientId)
      .sort((a, b) => b.at - a.at)
      .slice(0, 20);
    return {
      clients: [mapClient(client)],
      payments: payments
        .sort((a, b) => b.submittedAt - a.submittedAt)
        .map(mapPayment),
      keys: keys.map(mapKey),
      crashReports: [],
      activity: activity.map(mapActivity),
      pricing,
      admin,
    };
  },
});

export const portalState = httpAction(async (ctx, request) => {
  let body: { clientId?: unknown } | null = null;
  try {
    body = await request.json();
  } catch {
    body = null;
  }
  const clientId = typeof body?.clientId === "string" ? body.clientId : "";
  const data = await ctx.runQuery(internal.portal.portalSnapshot, {
    clientId,
  });
  return json(data, 200);
});

export const portalRegister = httpAction(async (ctx, request) => {
  let body: any = null;
  try {
    body = await request.json();
  } catch {
    return json({ message: "Invalid request body." }, 400);
  }
  try {
    const result = await ctx.runMutation(internal.admin.applyAction, {
      type: "registerClient",
      payload: body,
      actor: String(body?.shopName ?? "Client"),
    });
    return json(result, 200);
  } catch (error) {
    const message =
      error instanceof ConvexError
        ? String(error.data)
        : error instanceof Error
          ? error.message
          : "Registration failed.";
    return json({ message }, 400);
  }
});

export const portalPayment = httpAction(async (ctx, request) => {
  let body: any = null;
  try {
    body = await request.json();
  } catch {
    return json({ message: "Invalid request body." }, 400);
  }
  try {
    const result = await ctx.runMutation(internal.admin.applyAction, {
      type: "submitPayment",
      payload: body,
      actor: String(body?.clientId ?? "Client"),
    });
    return json(result, 200);
  } catch (error) {
    const message =
      error instanceof ConvexError
        ? String(error.data)
        : error instanceof Error
          ? error.message
          : "Payment submission failed.";
    return json({ message }, 400);
  }
});

export const claimInstallation = internalMutation({
  args: {
    deviceId: v.string(),
    sub: v.string(),
    exp: v.union(v.number(), v.null()),
    maxDevices: v.number(),
    pricePkr: v.optional(v.number()),
    localExpiresAt: v.optional(v.union(v.number(), v.null())),
    localCustomerName: v.optional(v.string()),
    localPricePkr: v.optional(v.number()),
  },
  handler: async (ctx, input) => {
    const existing = await findClientByDevice(ctx, input.deviceId);
    if (existing) {
      return { clientId: existing.id, created: false };
    }
    const pricing = await getPricing(ctx);
    const now = Date.now();
    const id = newId("c");
    const tokenExpiry =
      input.exp === null ? null : new Date(input.exp * 1000).getTime();
    const localExpiry =
      typeof input.localExpiresAt === "number" ? input.localExpiresAt : 0;
    const name = input.localCustomerName?.trim() || input.sub;
    await ctx.db.insert("clients", {
      id,
      shopName: name,
      ownerName: name,
      email: "",
      phone: "",
      city: "",
      deviceId: input.deviceId,
      registeredAt: now,
      lastSeenAt: now,
      plan: "monthly",
      monthlyPricePkr:
        input.localPricePkr ??
        input.pricePkr ??
        pricing.defaultMonthlyPricePkr,
      durationDays: pricing.durationDays,
      trialEndsAt: now,
      paidUntil:
        tokenExpiry === null
          ? undefined
          : Math.max(tokenExpiry, localExpiry),
      lifetime: tokenExpiry === null,
      blocked: false,
      notes: "Migrated from an existing Fig POS license.",
      source: "pos",
    });
    await logActivity(ctx, {
      actor: input.sub,
      clientId: id,
      kind: "register",
      message: `Linked existing installation ${input.sub}.`,
    });
    return { clientId: id, created: true };
  },
});

export const claimInstallationHttp = httpAction(async (ctx, request) => {
  let body: any = null;
  try {
    body = await request.json();
  } catch {
    return json({ message: "Invalid request body." }, 400);
  }
  const deviceId = typeof body?.deviceId === "string" ? body.deviceId.trim() : "";
  const licenseToken =
    typeof body?.licenseToken === "string" ? body.licenseToken.trim() : "";
  if (!deviceId || !licenseToken) {
    return json({ message: "deviceId and licenseToken are required." }, 400);
  }
  const payload = await verifyLicenseToken(licenseToken);
  if (!payload) {
    return json(
      { message: "This license could not be linked. Contact Fig support." },
      400,
    );
  }
  const result = await ctx.runMutation(internal.portal.claimInstallation, {
    deviceId,
    sub: payload.sub,
    exp: payload.exp,
    maxDevices: payload.maxDevices,
    pricePkr: payload.pricePkr,
    localExpiresAt:
      typeof body?.localExpiresAt === "string"
        ? Date.parse(body.localExpiresAt) || null
        : null,
    localCustomerName:
      typeof body?.localCustomerName === "string"
        ? body.localCustomerName
        : undefined,
    localPricePkr:
      typeof body?.localPricePkr === "number"
        ? Math.round(body.localPricePkr)
        : undefined,
  });
  return json(result, 200);
});
