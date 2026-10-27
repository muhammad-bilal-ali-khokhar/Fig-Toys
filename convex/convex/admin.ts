import { httpAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { ConvexError, v } from "convex/values";
import { isAdminRequest, json } from "./lib/auth";
import {
  DAY_MS,
  findClientByDevice,
  findClientById,
  generateUniqueCode,
  getAdmin,
  getPricing,
  iso,
  logActivity,
  mapActivity,
  mapAdminUser,
  mapClient,
  mapCrash,
  mapKey,
  mapPayment,
  newId,
  setSetting,
  stackExpiry,
} from "./lib/data";

async function snapshot(ctx: any) {
  const clients = (await ctx.db.query("clients").collect())
    .sort((a: any, b: any) => b.registeredAt - a.registeredAt)
    .map(mapClient);
  const payments = (await ctx.db.query("payments").collect())
    .sort((a: any, b: any) => b.submittedAt - a.submittedAt)
    .map(mapPayment);
  const keyRows = (await ctx.db.query("activationCodes").collect()).sort(
    (a: any, b: any) => b.createdAt - a.createdAt,
  );
  const keys = await Promise.all(
    keyRows.map(async (row: any) => {
      const activations = await ctx.db
        .query("activations")
        .withIndex("by_code", (q: any) => q.eq("code", row.code))
        .collect();
      return {
        ...mapKey(row),
        maxDevices: row.maxDevices ?? 1,
        activeDevices: activations.filter((item: any) => !item.revokedAt).length,
        activations: activations
          .sort((a: any, b: any) => b.activatedAt - a.activatedAt)
          .map((item: any) => ({
            id: item._id,
            deviceId: item.deviceId,
            activatedAt: new Date(item.activatedAt).toISOString(),
            revokedAt: item.revokedAt
              ? new Date(item.revokedAt).toISOString()
              : null,
          })),
      };
    }),
  );
  const activity = (await ctx.db.query("activity").collect())
    .sort((a: any, b: any) => b.at - a.at)
    .slice(0, 60)
    .map(mapActivity);
  const crashReports = (await ctx.db.query("crashReports").collect())
    .sort((a: any, b: any) => b.createdAt - a.createdAt)
    .slice(0, 100)
    .map(mapCrash);
  return {
    clients,
    payments,
    keys,
    crashReports,
    pricing: await getPricing(ctx),
    admin: await getAdmin(ctx),
    activity,
  };
}

export const getSnapshot = internalQuery({
  args: {},
  handler: async (ctx) => snapshot(ctx),
});

export const applyAction = internalMutation({
  args: {
    type: v.string(),
    payload: v.any(),
    actor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const payload = (args.payload ?? {}) as any;
    const actor = args.actor ?? "Fig Admin";
    const now = Date.now();
    const pricing = await getPricing(ctx);

    async function requireClient() {
      const client = await findClientById(ctx, String(payload.id ?? ""));
      if (!client) throw new ConvexError("Client not found.");
      return client;
    }

    async function mintKey(input: {
      client: any;
      days: number;
      amountPkr: number;
      paymentRequestId?: string;
      expiresAt?: number;
    }) {
      const expiresAt =
        input.expiresAt ?? stackExpiry(input.client, input.days, now);
      const code = await generateUniqueCode(ctx);
      const createdAt = Date.now();
      const keyId = await ctx.db.insert("activationCodes", {
        code,
        status: "active",
        customerName: input.client.shopName,
        edition: "PRO",
        maxDevices: 1,
        pricePkr: input.amountPkr,
        expiresAt,
        createdAt,
        clientId: input.client.id,
        durationDays: input.days,
        paymentRequestId: input.paymentRequestId,
      });
      return {
        keyId,
        expiresAt,
        key: mapKey({
          _id: keyId,
          code,
          status: "active",
          createdAt,
          expiresAt,
          clientId: input.client.id,
          durationDays: input.days,
          paymentRequestId: input.paymentRequestId,
        }),
      };
    }

    switch (args.type) {
      case "registerClient":
      case "createClient": {
        const trialMinutes =
          typeof payload.trialMinutes === "number" ? payload.trialMinutes : null;
        const trialEndsAt =
          trialMinutes !== null
            ? now + trialMinutes * 60_000
            : now + pricing.trialDays * DAY_MS;
        const client = {
          id: newId("c"),
          shopName: String(payload.shopName ?? "").trim(),
          ownerName: String(payload.ownerName ?? "").trim(),
          email: String(payload.email ?? "").trim(),
          phone: String(payload.phone ?? "").trim(),
          city: String(payload.city ?? "").trim(),
          deviceId: payload.deviceId ? String(payload.deviceId) : undefined,
          registeredAt: now,
          lastSeenAt: now,
          plan: "trial" as const,
          monthlyPricePkr: Number(
            payload.monthlyPricePkr ?? pricing.defaultMonthlyPricePkr,
          ),
          durationDays: Number(payload.durationDays ?? pricing.durationDays),
          trialEndsAt,
          lifetime: false,
          blocked: false,
          notes: String(payload.notes ?? ""),
          username: payload.username ? String(payload.username) : undefined,
          password: payload.password ? String(payload.password) : undefined,
          source: (payload.source ?? "admin") as "admin" | "pos",
        };
        if (!client.shopName || !client.ownerName) {
          throw new ConvexError("Shop name and owner name are required.");
        }
        const id = await ctx.db.insert("clients", client);
        await logActivity(ctx, {
          actor,
          clientId: client.id,
          kind: "register",
          message: `Registered ${client.shopName}.`,
        });
        return { client: mapClient({ _id: id, ...client }) };
      }

      case "updateClient": {
        const client = await requireClient();
        const patch: any = {};
        for (const field of [
          "shopName",
          "ownerName",
          "email",
          "phone",
          "city",
          "deviceId",
          "plan",
          "monthlyPricePkr",
          "durationDays",
          "lifetime",
          "blocked",
          "notes",
          "activationCode",
        ]) {
          if (payload.patch?.[field] !== undefined) {
            patch[field] = payload.patch[field];
          }
        }
        if (payload.patch?.trialEndsAt !== undefined) {
          patch.trialEndsAt = new Date(payload.patch.trialEndsAt).getTime();
        }
        if (payload.patch?.paidUntil !== undefined) {
          patch.paidUntil =
            payload.patch.paidUntil === null
              ? undefined
              : new Date(payload.patch.paidUntil).getTime();
        }
        await ctx.db.patch(client._id, patch);
        const updated = await findClientById(ctx, client.id);
        return { client: mapClient(updated) };
      }

      case "setClientPlan": {
        const client = await requireClient();
        await ctx.db.patch(client._id, {
          monthlyPricePkr: Number(payload.monthlyPricePkr),
          durationDays: Number(payload.durationDays),
          plan: "monthly",
          lifetime: false,
        });
        await logActivity(ctx, {
          actor,
          clientId: client.id,
          kind: "plan",
          message: `Set plan for ${client.shopName}.`,
        });
        return { ok: true };
      }

      case "setClientBlocked": {
        const client = await requireClient();
        await ctx.db.patch(client._id, { blocked: Boolean(payload.blocked) });
        await logActivity(ctx, {
          actor,
          clientId: client.id,
          kind: payload.blocked ? "block" : "unblock",
          message: `${payload.blocked ? "Blocked" : "Unblocked"} ${client.shopName}.`,
        });
        return { ok: true };
      }

      case "setClientTrial": {
        const client = await requireClient();
        const minutes = Number(payload.minutes ?? 0);
        await ctx.db.patch(client._id, {
          plan: "trial",
          trialEndsAt: now + minutes * 60_000,
          paidUntil: undefined,
          lifetime: false,
          blocked: false,
        });
        await logActivity(ctx, {
          actor,
          clientId: client.id,
          kind: "plan",
          message: `Gave ${client.shopName} a ${minutes} minute trial.`,
        });
        return { ok: true };
      }

      case "setClientAccess": {
        const client = await requireClient();
        const minutes = Number(payload.minutes ?? 0);
        await ctx.db.patch(client._id, {
          plan: "monthly",
          paidUntil: now + minutes * 60_000,
          lifetime: false,
          blocked: false,
        });
        await logActivity(ctx, {
          actor,
          clientId: client.id,
          kind: "plan",
          message: `Gave ${client.shopName} ${minutes} minutes of access.`,
        });
        return { ok: true };
      }

      case "setClientFree": {
        const client = await requireClient();
        await ctx.db.patch(client._id, {
          plan: "monthly",
          lifetime: true,
          paidUntil: undefined,
          blocked: false,
        });
        await logActivity(ctx, {
          actor,
          clientId: client.id,
          kind: "plan",
          message: `Gave ${client.shopName} lifetime access.`,
        });
        return { ok: true };
      }

      case "expireClient": {
        const client = await requireClient();
        await ctx.db.patch(client._id, {
          plan: "trial",
          lifetime: false,
          trialEndsAt: now - 1,
          paidUntil: now - 1,
        });
        await logActivity(ctx, {
          actor,
          clientId: client.id,
          kind: "plan",
          message: `Expired ${client.shopName}.`,
        });
        return { ok: true };
      }

      case "submitPayment": {
        const client = await findClientById(ctx, String(payload.clientId ?? ""));
        if (!client) throw new ConvexError("Client not found.");
        const payment = {
          id: newId("p"),
          clientId: client.id,
          amountPkr: Number(payload.amountPkr ?? 0),
          method: String(payload.method ?? "jazzcash"),
          txnId: String(payload.txnId ?? ""),
          note: String(payload.note ?? ""),
          submittedAt: now,
          status: "pending" as const,
        };
        await ctx.db.insert("payments", payment);
        await logActivity(ctx, {
          actor,
          clientId: client.id,
          kind: "payment",
          message: `${client.shopName} submitted a payment.`,
        });
        return { payment: mapPayment(payment) };
      }

      case "approvePayment": {
        const payment = await ctx.db
          .query("payments")
          .withIndex("by_payment_id", (q) => q.eq("id", String(payload.id ?? "")))
          .unique();
        if (!payment) throw new ConvexError("Payment not found.");
        if (payment.status !== "pending") {
          throw new ConvexError("This payment has already been reviewed.");
        }
        const client = await findClientById(ctx, payment.clientId);
        if (!client) throw new ConvexError("Client not found.");
        const days = client.durationDays || pricing.durationDays;
        const minted = await mintKey({
          client,
          days,
          amountPkr: payment.amountPkr,
          paymentRequestId: payment.id,
        });
        const reviewedAt = Date.now();
        const reviewedBy = String(payload.reviewedBy ?? actor);
        await ctx.db.patch(payment._id, {
          status: "approved",
          reviewedAt,
          reviewedBy,
          licenseKeyId: minted.keyId,
          licenseKey: minted.key.key,
        });
        await ctx.db.patch(client._id, {
          plan: "monthly",
          paidUntil: minted.expiresAt,
          lifetime: false,
          blocked: false,
          activationCode: minted.key.key,
        });
        await logActivity(ctx, {
          actor: reviewedBy,
          clientId: client.id,
          kind: "approve",
          message: `Approved payment for ${client.shopName}.`,
        });
        return {
          key: minted.key,
          payment: mapPayment({
            ...payment,
            status: "approved",
            reviewedAt,
            reviewedBy,
            licenseKeyId: minted.keyId,
          }),
        };
      }

      case "rejectPayment": {
        const payment = await ctx.db
          .query("payments")
          .withIndex("by_payment_id", (q) => q.eq("id", String(payload.id ?? "")))
          .unique();
        if (!payment) throw new ConvexError("Payment not found.");
        const reviewedAt = Date.now();
        const reviewedBy = String(payload.reviewedBy ?? actor);
        await ctx.db.patch(payment._id, {
          status: "rejected",
          reviewedAt,
          reviewedBy,
          rejectionReason: String(payload.reason ?? ""),
        });
        await logActivity(ctx, {
          actor: reviewedBy,
          clientId: payment.clientId,
          kind: "reject",
          message: `Rejected payment for ${payment.clientId}.`,
        });
        return { ok: true };
      }

      case "issueKey": {
        const client = await requireClient();
        const days = Number(payload.durationDays ?? client.durationDays);
        const minted = await mintKey({
          client,
          days,
          amountPkr: client.monthlyPricePkr,
        });
        await ctx.db.patch(client._id, {
          plan: "monthly",
          paidUntil: minted.expiresAt,
          lifetime: false,
          activationCode: minted.key.key,
        });
        await logActivity(ctx, {
          actor,
          clientId: client.id,
          kind: "key",
          message: `Issued a ${days} day key to ${client.shopName}.`,
        });
        return { key: minted.key };
      }

      case "listAdminUsers": {
        const users = (await ctx.db.query("adminUsers").collect())
          .sort((a: any, b: any) => a.createdAt - b.createdAt)
          .map(mapAdminUser);
        return { users };
      }

      case "lookupAdminUser": {
        const email = String(payload.email ?? "").trim().toLowerCase();
        const user = await ctx.db
          .query("adminUsers")
          .withIndex("by_email", (q) => q.eq("email", email))
          .unique();
        if (!user) return { user: null };
        return { user: { ...mapAdminUser(user), passwordHash: user.passwordHash } };
      }

      case "createAdminUser": {
        const email = String(payload.email ?? "").trim().toLowerCase();
        const name = String(payload.name ?? "").trim();
        const role = String(payload.role ?? "admin");
        const passwordHash = String(payload.passwordHash ?? "");
        if (!name || !email || !passwordHash) {
          throw new ConvexError("Name, email and password are required.");
        }
        if (!["owner", "admin", "support"].includes(role)) {
          throw new ConvexError("Invalid role.");
        }
        if (role === "owner" && String(payload.actorRole ?? "") !== "owner") {
          throw new ConvexError("Only an owner can create another owner.");
        }
        const existing = await ctx.db
          .query("adminUsers")
          .withIndex("by_email", (q) => q.eq("email", email))
          .unique();
        if (existing) throw new ConvexError("A user with this email already exists.");
        const doc = {
          id: newId("u"),
          name,
          email,
          role: role as "owner" | "admin" | "support",
          passwordHash,
          disabled: false,
          createdAt: Date.now(),
          createdBy: actor,
        };
        const id = await ctx.db.insert("adminUsers", doc);
        return { user: mapAdminUser({ _id: id, ...doc }) };
      }

      case "updateAdminUser": {
        const user = await ctx.db
          .query("adminUsers")
          .withIndex("by_admin_id", (q) => q.eq("id", String(payload.id ?? "")))
          .unique();
        if (!user) throw new ConvexError("User not found.");
        const patch: any = {};
        if (payload.name !== undefined) patch.name = String(payload.name).trim();
        if (payload.email !== undefined) {
          const email = String(payload.email).trim().toLowerCase();
          const clash = await ctx.db
            .query("adminUsers")
            .withIndex("by_email", (q) => q.eq("email", email))
            .unique();
          if (clash && clash._id !== user._id) {
            throw new ConvexError("A user with this email already exists.");
          }
          patch.email = email;
        }
        if (payload.role !== undefined) {
          const role = String(payload.role);
          if (!["owner", "admin", "support"].includes(role)) {
            throw new ConvexError("Invalid role.");
          }
          patch.role = role;
        }
        if (payload.disabled !== undefined) patch.disabled = Boolean(payload.disabled);
        if (
          (user.role === "owner" || patch.role === "owner") &&
          String(payload.actorRole ?? "") !== "owner"
        ) {
          throw new ConvexError("Only an owner can change an owner account.");
        }
        const actorEmail = String(payload.actorEmail ?? "").trim().toLowerCase();
        if (actorEmail && user.email === actorEmail) {
          if (patch.disabled === true) {
            throw new ConvexError("You cannot disable your own account.");
          }
        }
        const owners = (await ctx.db.query("adminUsers").collect()).filter(
          (item: any) => item.role === "owner" && !item.disabled,
        );
        if (
          user.role === "owner" &&
          ((patch.role !== undefined && patch.role !== "owner") ||
            patch.disabled === true) &&
          owners.length <= 1
        ) {
          throw new ConvexError("You cannot remove the last owner.");
        }
        await ctx.db.patch(user._id, patch);
        const updated = await ctx.db.get(user._id);
        return { user: mapAdminUser(updated) };
      }

      case "setAdminUserPassword": {
        const user = await ctx.db
          .query("adminUsers")
          .withIndex("by_admin_id", (q) => q.eq("id", String(payload.id ?? "")))
          .unique();
        if (!user) throw new ConvexError("User not found.");
        if (
          user.role === "owner" &&
          String(payload.actorRole ?? "") !== "owner"
        ) {
          throw new ConvexError("Only an owner can reset an owner password.");
        }
        const passwordHash = String(payload.passwordHash ?? "");
        if (!passwordHash) throw new ConvexError("Password is required.");
        await ctx.db.patch(user._id, { passwordHash });
        return { ok: true };
      }

      case "deleteAdminUser": {
        const user = await ctx.db
          .query("adminUsers")
          .withIndex("by_admin_id", (q) => q.eq("id", String(payload.id ?? "")))
          .unique();
        if (!user) throw new ConvexError("User not found.");
        if (
          user.role === "owner" &&
          String(payload.actorRole ?? "") !== "owner"
        ) {
          throw new ConvexError("Only an owner can delete another owner.");
        }
        if (user.email === String(payload.actorEmail ?? "").toLowerCase()) {
          throw new ConvexError("You cannot delete your own account.");
        }
        const owners = (await ctx.db.query("adminUsers").collect()).filter(
          (item: any) => item.role === "owner" && !item.disabled,
        );
        if (user.role === "owner" && owners.length <= 1) {
          throw new ConvexError("You cannot delete the last owner.");
        }
        await ctx.db.delete(user._id);
        return { ok: true };
      }

      case "touchAdminUser": {
        const user = await ctx.db
          .query("adminUsers")
          .withIndex("by_admin_id", (q) => q.eq("id", String(payload.id ?? "")))
          .unique();
        if (user) await ctx.db.patch(user._id, { lastLoginAt: Date.now() });
        return { ok: true };
      }

      case "resolveCrashReport": {
        const report = await ctx.db
          .query("crashReports")
          .withIndex("by_report_id", (q) => q.eq("id", String(payload.id ?? "")))
          .unique();
        if (!report) throw new ConvexError("Crash report not found.");
        await ctx.db.patch(report._id, {
          status: "resolved",
          resolvedAt: Date.now(),
        });
        return { ok: true };
      }

      case "reviveKey": {
        const key = (await ctx.db.get(String(payload.id ?? "") as any)) as {
          _id: any;
          code: string;
          clientId?: string;
        } | null;
        if (!key) throw new ConvexError("Key not found.");
        await ctx.db.patch(key._id, {
          status: "active",
          revokedAt: undefined,
        });
        const activations = await ctx.db
          .query("activations")
          .withIndex("by_code", (q) => q.eq("code", key.code))
          .collect();
        for (const activation of activations) {
          await ctx.db.patch(activation._id, { revokedAt: undefined });
        }
        const client = key.clientId
          ? await findClientById(ctx, key.clientId)
          : null;
        await logActivity(ctx, {
          actor,
          clientId: client?.id,
          kind: "key",
          message: `Revived key ${key.code}.`,
        });
        return { ok: true };
      }

      case "revokeDevice": {
        const activation = (await ctx.db.get(
          String(payload.activationId ?? "") as any,
        )) as {
          _id: any;
          code: string;
          deviceId: string;
        } | null;
        if (!activation) throw new ConvexError("Device activation not found.");
        await ctx.db.patch(activation._id, { revokedAt: Date.now() });
        const key = await ctx.db
          .query("activationCodes")
          .withIndex("by_code", (q) => q.eq("code", activation.code))
          .unique();
        await logActivity(ctx, {
          actor,
          clientId: key?.clientId,
          kind: "revoke",
          message: `Removed device ${activation.deviceId} from code ${activation.code}.`,
        });
        return { ok: true };
      }

      case "revokeKey": {
        const key = (await ctx.db.get(String(payload.id ?? "") as any)) as {
          _id: any;
          code: string;
          clientId?: string;
        } | null;
        if (!key) throw new ConvexError("Key not found.");
        await ctx.db.patch(key._id, { status: "disabled", revokedAt: Date.now() });
        const activations = await ctx.db
          .query("activations")
          .withIndex("by_code", (q) => q.eq("code", key.code))
          .collect();
        for (const activation of activations) {
          await ctx.db.patch(activation._id, { revokedAt: Date.now() });
        }
        const client = key.clientId
          ? await findClientById(ctx, key.clientId)
          : null;
        await logActivity(ctx, {
          actor,
          clientId: client?.id,
          kind: "revoke",
          message: `Revoked key ${key.code}.`,
        });
        return { ok: true };
      }

      case "mintCode": {
        const code = await generateUniqueCode(ctx);
        const createdAt = Date.now();
        const expiresAt =
          typeof payload.expiresAt === "number" ? payload.expiresAt : undefined;
        const keyId = await ctx.db.insert("activationCodes", {
          code,
          status: "available",
          customerName: String(payload.customerName ?? "Customer"),
          edition: "PRO",
          maxDevices: Number(payload.maxDevices ?? 1),
          pricePkr: Number(payload.pricePkr ?? pricing.defaultMonthlyPricePkr),
          expiresAt,
          createdAt,
        });
        return {
          code,
          key: mapKey({
            _id: keyId,
            code,
            status: "available",
            createdAt,
            expiresAt,
            customerName: payload.customerName,
            maxDevices: payload.maxDevices,
          }),
        };
      }

      case "savePricing": {
        await setSetting(ctx, "pricing", {
          ...pricing,
          ...(payload.pricing ?? {}),
        });
        await logActivity(ctx, {
          actor,
          kind: "pricing",
          message: "Updated pricing and payment details.",
        });
        return { ok: true };
      }

      case "saveAdmin": {
        await setSetting(ctx, "admin", {
          name: String(payload.name ?? "Fig Admin"),
          email: String(payload.email ?? "fig@dev.com"),
        });
        return { ok: true };
      }

      default:
        throw new ConvexError(`Unknown action: ${args.type}`);
    }
  },
});

export const purgeUnlinkedCodes = internalMutation({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("activationCodes").collect();
    let removed = 0;
    for (const row of rows) {
      if (!row.clientId) {
        await ctx.db.delete(row._id);
        removed += 1;
      }
    }
    return { removed };
  },
});

export const installStatus = internalMutation({
  args: { deviceId: v.string(), code: v.optional(v.string()) },
  handler: async (ctx, { deviceId, code }) => {
    const now = Date.now();
    let client = deviceId ? await findClientByDevice(ctx, deviceId) : null;
    if (!client && code) {
      const row = await ctx.db
        .query("activationCodes")
        .withIndex("by_code", (q) => q.eq("code", code.trim()))
        .unique();
      if (row?.clientId) client = await findClientById(ctx, row.clientId);
    }
    if (!client) {
      return { status: "unlicensed" as const, serverTime: now };
    }
    const patch: any = { lastSeenAt: now };
    if (deviceId && client.deviceId !== deviceId) patch.deviceId = deviceId;
    if (code && client.activationCode !== code) patch.activationCode = code;
    await ctx.db.patch(client._id, patch);

    const latestPayment = (
      await ctx.db
        .query("payments")
        .withIndex("by_client", (q) => q.eq("clientId", client.id))
        .collect()
    ).sort((a: any, b: any) => b.submittedAt - a.submittedAt)[0];

    const status = client.blocked
      ? "blocked"
      : client.lifetime || (client.paidUntil ?? 0) > now
        ? "active"
        : client.trialEndsAt > now
          ? "trial"
          : "expired";

    return {
      status,
      serverTime: now,
      id: client.id,
      clientId: client.id,
      customerName: client.shopName,
      plan: client.plan,
      lifetime: Boolean(client.lifetime),
      blocked: Boolean(client.blocked),
      trialEndsAt: iso(client.trialEndsAt),
      paidUntil: iso(client.paidUntil),
      monthlyPricePkr: client.monthlyPricePkr,
      durationDays: client.durationDays,
      licenseKey: client.activationCode ?? null,
      latestPayment: latestPayment ? mapPayment(latestPayment) : null,
      portalUrl: (() => {
        const base = (process.env.PORTAL_BASE_URL ?? "").replace(/\/+$/, "");
        return base ? `${base}/portal?client=${client.id}` : null;
      })(),
      pricing: await getPricing(ctx),
    };
  },
});

export const adminSnapshot = httpAction(async (ctx, request) => {
  if (!isAdminRequest(request)) return json({ message: "Unauthorized." }, 401);
  const data = await ctx.runQuery(internal.admin.getSnapshot, {});
  return json(data, 200);
});

export const adminMutate = httpAction(async (ctx, request) => {
  if (!isAdminRequest(request)) return json({ message: "Unauthorized." }, 401);
  let body: { type?: unknown; payload?: unknown; actor?: unknown } | null = null;
  try {
    body = await request.json();
  } catch {
    return json({ message: "Invalid request body." }, 400);
  }
  const type = typeof body?.type === "string" ? body.type : "";
  if (!type) return json({ message: "Action type is required." }, 400);
  try {
    const result = await ctx.runMutation(internal.admin.applyAction, {
      type,
      payload: body?.payload ?? {},
      actor: typeof body?.actor === "string" ? body.actor : undefined,
    });
    return json(result, 200);
  } catch (error) {
    const message =
      error instanceof ConvexError
        ? String(error.data)
        : error instanceof Error
          ? error.message
          : "Admin action failed.";
    return json({ message }, 400);
  }
});

export const installStatusHttp = httpAction(async (ctx, request) => {
  let body: { deviceId?: unknown; code?: unknown } | null = null;
  try {
    body = await request.json();
  } catch {
    return json({ message: "Invalid request body." }, 400);
  }
  const deviceId = typeof body?.deviceId === "string" ? body.deviceId : "";
  const code = typeof body?.code === "string" ? body.code : undefined;
  if (!deviceId && !code) {
    return json({ message: "deviceId or code is required." }, 400);
  }
  const result = await ctx.runMutation(internal.admin.installStatus, {
    deviceId,
    code,
  });
  return json(result, 200);
});
