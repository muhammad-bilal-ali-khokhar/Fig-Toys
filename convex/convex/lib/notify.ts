import type { MutationCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import { newId } from "./data";

export async function createAdminNotification(
  ctx: MutationCtx,
  input: {
    type: "payment" | "client" | "crash" | "release" | "expiry" | "test";
    title: string;
    body: string;
    url: string;
    clientId?: string;
  },
): Promise<string> {
  const id = newId("n");
  await ctx.db.insert("notifications", {
    id,
    type: input.type,
    title: input.title,
    body: input.body,
    url: input.url,
    clientId: input.clientId,
    createdAt: Date.now(),
    readBy: [],
  });
  await ctx.scheduler.runAfter(0, internal.push.sendNotification, {
    notificationId: id,
  });
  return id;
}
