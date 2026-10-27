import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { sendPushNotification } from "@mmmike/web-push/send";
import { mapNotification } from "./lib/data";

export const getNotification = internalQuery({
  args: { id: v.string() },
  handler: async (ctx, { id }) => {
    const note = await ctx.db
      .query("notifications")
      .withIndex("by_notification_id", (q) => q.eq("id", id))
      .unique();
    return note ? mapNotification(note) : null;
  },
});

export const getTargets = internalQuery({
  args: {},
  handler: async (ctx) => {
    const admins = await ctx.db.query("adminUsers").collect();
    const subscriptions = await ctx.db.query("pushSubscriptions").collect();
    return {
      admins: admins.map((admin) => ({
        email: admin.email,
        notify: admin.notify ?? null,
      })),
      subscriptions: subscriptions.map((sub) => ({
        id: sub.id,
        email: sub.email,
        endpoint: sub.endpoint,
        p256dh: sub.p256dh,
        auth: sub.auth,
      })),
    };
  },
});

export const deleteSubscription = internalMutation({
  args: { id: v.string() },
  handler: async (ctx, { id }) => {
    const sub = await ctx.db
      .query("pushSubscriptions")
      .withIndex("by_push_id", (q) => q.eq("id", id))
      .unique();
    if (sub) await ctx.db.delete(sub._id);
    return { ok: true };
  },
});

const prefKeys: Record<
  string,
  "payments" | "clients" | "crashes" | "releases" | "expiry"
> = {
  payment: "payments",
  client: "clients",
  crash: "crashes",
  release: "releases",
  expiry: "expiry",
};

export const sendNotification = internalAction({
  args: { notificationId: v.string(), skipEmail: v.optional(v.string()) },
  handler: async (ctx, { notificationId, skipEmail }) => {
    const note = await ctx.runQuery(internal.push.getNotification, {
      id: notificationId,
    });
    if (!note) return;
    const publicKey = process.env.VAPID_PUBLIC_KEY?.trim();
    const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
    const subject = process.env.VAPID_SUBJECT?.trim();
    if (!publicKey || !privateKey || !subject) return;
    const targets = await ctx.runQuery(internal.push.getTargets, {});
    if (!targets.subscriptions.length) return;

    const prefKey = prefKeys[note.type];
    for (const sub of targets.subscriptions) {
      if (skipEmail && sub.email === skipEmail) continue;
      const admin = targets.admins.find((item: { email: string }) => item.email === sub.email);
      if (note.type !== "test" && prefKey && admin?.notify?.[prefKey] === false) {
        continue;
      }
      try {
        const delivered = await sendPushNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          {
            title: note.title,
            body: note.body,
            url: note.url,
            tag: note.id,
          },
          { publicKey, privateKey, subject },
        );
        if (!delivered) {
          await ctx.runMutation(internal.push.deleteSubscription, { id: sub.id });
        }
      } catch (error) {
        console.warn("Push failed", error);
      }
    }
  },
});
