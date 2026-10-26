import webpush from "web-push";
import { env } from "../../core/config/env";
import { prisma } from "../../core/lib/prisma";

const SETTINGS_KEY = "push.subscriptions";

type PushSubscription = {
  endpoint: string;
  expirationTime?: number | null;
  keys: { p256dh: string; auth: string };
};

export type AdminPushPayload = {
  title: string;
  body: string;
  url: string;
  tag?: string;
};

function configured() {
  return Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY);
}

async function readSubscriptions(): Promise<PushSubscription[]> {
  const row = await prisma.settings.findUnique({ where: { key: SETTINGS_KEY } });
  if (!row?.value) return [];
  try {
    const parsed = JSON.parse(row.value) as PushSubscription[];
    return Array.isArray(parsed) ? parsed.filter((item) => item?.endpoint && item?.keys) : [];
  } catch {
    return [];
  }
}

async function writeSubscriptions(subscriptions: PushSubscription[]) {
  await prisma.settings.upsert({
    where: { key: SETTINGS_KEY },
    update: { value: JSON.stringify(subscriptions) },
    create: { key: SETTINGS_KEY, value: JSON.stringify(subscriptions) },
  });
}

export async function subscribeAdminPush(input: PushSubscription) {
  const subscriptions = await readSubscriptions();
  const next = subscriptions.filter((item) => item.endpoint !== input.endpoint);
  next.push(input);
  const stored = next.slice(-20);
  await writeSubscriptions(stored);
  return { subscriptions: stored.length };
}

export async function unsubscribeAdminPush(endpoint: string) {
  const subscriptions = await readSubscriptions();
  const next = subscriptions.filter((item) => item.endpoint !== endpoint);
  await writeSubscriptions(next);
  return { subscriptions: next.length };
}

export async function getPushStatus() {
  return {
    configured: configured(),
    subscriptions: (await readSubscriptions()).length,
  };
}

export async function sendAdminPush(payload: AdminPushPayload) {
  if (!configured()) return { sent: 0, skipped: true };

  webpush.setVapidDetails(
    env.VAPID_SUBJECT,
    env.VAPID_PUBLIC_KEY!,
    env.VAPID_PRIVATE_KEY!,
  );

  const subscriptions = await readSubscriptions();
  if (subscriptions.length === 0) return { sent: 0, skipped: false };

  const stale: string[] = [];
  let sent = 0;

  await Promise.all(
    subscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification(subscription, JSON.stringify(payload));
        sent += 1;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) stale.push(subscription.endpoint);
      }
    }),
  );

  if (stale.length > 0) {
    await writeSubscriptions(
      subscriptions.filter((item) => !stale.includes(item.endpoint)),
    );
  }

  return { sent, skipped: false };
}
