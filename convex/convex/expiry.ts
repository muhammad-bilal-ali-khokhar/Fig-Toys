import { internalMutation } from "./_generated/server";
import { createAdminNotification } from "./lib/notify";

const DAY = 86_400_000;
const ALERT_DAYS = new Set([7, 3, 1, 0]);

export const check = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const clients = await ctx.db.query("clients").collect();
    const recent = await ctx.db.query("notifications").collect();
    const notified = new Set(
      recent
        .filter((note: any) => note.type === "expiry" && note.createdAt > now - DAY)
        .map((note: any) => note.clientId),
    );

    let sent = 0;
    for (const client of clients) {
      if (client.lifetime || client.blocked) continue;
      const endsAt =
        client.plan === "monthly" ? client.paidUntil : client.trialEndsAt;
      if (!endsAt) continue;
      const daysLeft = Math.ceil((endsAt - now) / DAY);
      if (!ALERT_DAYS.has(daysLeft) || notified.has(client.id)) continue;

      const trial = client.plan === "trial";
      const label = trial ? "Trial" : "License";
      const title =
        daysLeft <= 0
          ? `${label} expired`
          : daysLeft === 1
            ? `${label} expires tomorrow`
            : `${label} expires in ${daysLeft} days`;
      const body =
        daysLeft <= 0
          ? `${client.shopName} has expired.`
          : `${client.shopName} expires on ${new Date(endsAt).toISOString().slice(0, 10)}.`;

      await createAdminNotification(ctx, {
        type: "expiry",
        title,
        body,
        url: `/clients/${client.id}`,
        clientId: client.id,
      });
      notified.add(client.id);
      sent += 1;
    }
    return { sent };
  },
});
