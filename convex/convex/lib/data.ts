import type { MutationCtx, QueryCtx } from "../_generated/server";

export const DAY_MS = 86_400_000;

export const DEFAULT_PRICING = {
  defaultMonthlyPricePkr: 5000,
  durationDays: 30,
  trialDays: 14,
  jazzcash: "",
  easypaisa: "",
  bankName: "",
  accountTitle: "",
  accountNumber: "",
  qrUrl: "",
  supportPhone: "",
  supportEmail: "",
};

export const DEFAULT_ADMIN = {
  name: "Fig Admin",
  email: "fig@dev.com",
};

export function iso(ms: number | null | undefined): string | null {
  return typeof ms === "number" ? new Date(ms).toISOString() : null;
}

export function newId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function generateUniqueCode(ctx: MutationCtx): Promise<string> {
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

export async function getSetting(
  ctx: MutationCtx | QueryCtx,
  key: string,
): Promise<any | null> {
  const row = await ctx.db
    .query("settings")
    .withIndex("by_key", (q) => q.eq("key", key))
    .unique();
  return row?.value ?? null;
}

export async function setSetting(
  ctx: MutationCtx,
  key: string,
  value: unknown,
): Promise<void> {
  const row = await ctx.db
    .query("settings")
    .withIndex("by_key", (q) => q.eq("key", key))
    .unique();
  if (row) await ctx.db.patch(row._id, { value });
  else await ctx.db.insert("settings", { key, value });
}

export async function getPricing(ctx: MutationCtx | QueryCtx) {
  return { ...DEFAULT_PRICING, ...((await getSetting(ctx, "pricing")) ?? {}) };
}

export async function getAdmin(ctx: MutationCtx | QueryCtx) {
  return { ...DEFAULT_ADMIN, ...((await getSetting(ctx, "admin")) ?? {}) };
}

export async function findClientById(ctx: MutationCtx | QueryCtx, id: string) {
  return await ctx.db
    .query("clients")
    .withIndex("by_client_id", (q) => q.eq("id", id))
    .unique();
}

export async function findClientByDevice(
  ctx: MutationCtx | QueryCtx,
  deviceId: string,
) {
  return await ctx.db
    .query("clients")
    .withIndex("by_device", (q) => q.eq("deviceId", deviceId))
    .first();
}

export async function findClientByCode(
  ctx: MutationCtx | QueryCtx,
  code: string,
) {
  const row = await ctx.db
    .query("activationCodes")
    .withIndex("by_code", (q) => q.eq("code", code.trim()))
    .unique();
  if (!row?.clientId) return null;
  return await findClientById(ctx, row.clientId);
}

export async function logActivity(
  ctx: MutationCtx,
  input: {
    actor: string;
    clientId?: string;
    kind: string;
    message: string;
  },
): Promise<void> {
  await ctx.db.insert("activity", {
    id: newId("a"),
    at: Date.now(),
    actor: input.actor,
    clientId: input.clientId,
    kind: input.kind,
    message: input.message,
  });
}

export function stackExpiry(
  client: { paidUntil?: number; trialEndsAt?: number },
  days: number,
  now: number,
): number {
  const trial = client.trialEndsAt && client.trialEndsAt > now ? client.trialEndsAt : 0;
  const base = Math.max(now, client.paidUntil ?? 0, trial);
  return base + days * DAY_MS;
}

export function mapClient(client: any) {
  return {
    id: client.id,
    shopName: client.shopName,
    ownerName: client.ownerName,
    email: client.email,
    phone: client.phone,
    city: client.city,
    deviceId: client.deviceId ?? "",
    registeredAt: iso(client.registeredAt) ?? new Date().toISOString(),
    lastSeenAt: iso(client.lastSeenAt) ?? new Date().toISOString(),
    lastVersion: client.lastVersion ?? "",
    plan: client.plan,
    monthlyPricePkr: client.monthlyPricePkr,
    durationDays: client.durationDays,
    trialEndsAt: iso(client.trialEndsAt) ?? new Date().toISOString(),
    paidUntil: iso(client.paidUntil),
    lifetime: Boolean(client.lifetime),
    blocked: Boolean(client.blocked),
    notes: client.notes ?? "",
    username: client.username,
    source: client.source,
  };
}

export function mapPayment(payment: any) {
  return {
    id: payment.id,
    clientId: payment.clientId,
    amountPkr: payment.amountPkr,
    method: payment.method,
    txnId: payment.txnId,
    note: payment.note ?? "",
    submittedAt: iso(payment.submittedAt) ?? new Date().toISOString(),
    status: payment.status,
    reviewedAt: iso(payment.reviewedAt),
    reviewedBy: payment.reviewedBy ?? null,
    rejectionReason: payment.rejectionReason ?? "",
    licenseKeyId: payment.licenseKeyId ?? null,
  };
}

export function mapKey(key: any) {
  return {
    id: key._id,
    clientId: key.clientId ?? "",
    key: key.code,
    issuedAt: iso(key.createdAt) ?? new Date().toISOString(),
    expiresAt:
      iso(key.expiresAt) ??
      new Date((key.createdAt ?? Date.now()) + 3650 * DAY_MS).toISOString(),
    durationDays: key.durationDays ?? 0,
    status: key.status === "disabled" ? "revoked" : "active",
    paymentRequestId: key.paymentRequestId ?? null,
  };
}

export function mapAdminUser(user: any) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    disabled: Boolean(user.disabled),
    createdAt: iso(user.createdAt) ?? new Date().toISOString(),
    lastLoginAt: iso(user.lastLoginAt),
    createdBy: user.createdBy ?? null,
  };
}

export function mapCrash(report: any) {
  return {
    id: report.id,
    clientId: report.clientId ?? null,
    deviceId: report.deviceId,
    licenseKey: report.licenseKey ?? null,
    app: report.app,
    version: report.version ?? "",
    platform: report.platform ?? "",
    title: report.title,
    message: report.message,
    logTail: report.logTail ?? "",
    status: report.status,
    createdAt: iso(report.createdAt) ?? new Date().toISOString(),
    resolvedAt: iso(report.resolvedAt),
  };
}

export function mapActivity(event: any) {
  return {
    id: event.id,
    at: iso(event.at) ?? new Date().toISOString(),
    actor: event.actor,
    clientId: event.clientId ?? null,
    kind: event.kind,
    message: event.message,
  };
}
