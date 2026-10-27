import type { MutationCtx } from "../_generated/server";
import {
  findClientByDevice,
  getPricing,
  logActivity,
  newId,
} from "./data";
import { createAdminNotification } from "./notify";
import type { TokenPayload } from "./sign";

export async function linkLegacyClient(
  ctx: MutationCtx,
  input: {
    deviceId: string;
    payload: TokenPayload;
    appVersion?: string;
    localExpiresAt?: number | null;
    localCustomerName?: string;
    localPricePkr?: number;
  },
): Promise<{ clientId: string; created: boolean }> {
  const existing = await findClientByDevice(ctx, input.deviceId);
  if (existing) return { clientId: existing.id, created: false };

  const pricing = await getPricing(ctx);
  const now = Date.now();
  const tokenExpiry =
    input.payload.exp === null ? null : input.payload.exp * 1000;
  const localExpiry =
    typeof input.localExpiresAt === "number" ? input.localExpiresAt : 0;
  const name =
    input.localCustomerName?.trim() || input.payload.sub.trim() || "My Shop";
  const id = newId("c");

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
    lastVersion: input.appVersion,
    plan: "monthly",
    monthlyPricePkr:
      input.localPricePkr ??
      input.payload.pricePkr ??
      pricing.defaultMonthlyPricePkr,
    durationDays: pricing.durationDays,
    trialEndsAt: now,
    paidUntil:
      tokenExpiry === null ? undefined : Math.max(tokenExpiry, localExpiry),
    lifetime: tokenExpiry === null,
    blocked: false,
    notes: "Linked from an existing Fig POS license.",
    source: "pos",
  });

  await logActivity(ctx, {
    actor: name,
    clientId: id,
    kind: "register",
    message: `Linked existing installation ${name}.`,
  });
  await createAdminNotification(ctx, {
    type: "client",
    title: "Existing shop linked",
    body: `${name} is now linked to the owner console.`,
    url: `/clients/${id}`,
    clientId: id,
  });

  return { clientId: id, created: true };
}
