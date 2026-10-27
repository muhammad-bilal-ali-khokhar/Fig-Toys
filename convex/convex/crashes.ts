import { httpAction, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { ConvexError, v } from "convex/values";
import { json } from "./lib/auth";
import {
  findClientByCode,
  findClientByDevice,
  findClientById,
  logActivity,
  newId,
} from "./lib/data";

export const createCrashReport = internalMutation({
  args: {
    clientId: v.optional(v.string()),
    deviceId: v.string(),
    licenseKey: v.optional(v.string()),
    app: v.string(),
    version: v.optional(v.string()),
    platform: v.optional(v.string()),
    title: v.string(),
    message: v.string(),
    logTail: v.optional(v.string()),
  },
  handler: async (ctx, input) => {
    let client = null;
    if (input.clientId) {
      const candidate = await findClientById(ctx, input.clientId);
      if (
        candidate &&
        ((input.deviceId && candidate.deviceId === input.deviceId) ||
          (input.licenseKey && candidate.activationCode === input.licenseKey))
      ) {
        client = candidate;
      }
    }
    if (!client && input.deviceId) {
      client = await findClientByDevice(ctx, input.deviceId);
    }
    if (!client && input.licenseKey) {
      client = await findClientByCode(ctx, input.licenseKey);
    }

    const createdAt = Date.now();
    const id = newId("crash");
    await ctx.db.insert("crashReports", {
      id,
      clientId: client?.id,
      deviceId: input.deviceId,
      licenseKey: input.licenseKey,
      app: input.app,
      version: input.version,
      platform: input.platform,
      title: input.title,
      message: input.message,
      logTail: input.logTail,
      status: "new",
      createdAt,
    });
    if (client) {
      await logActivity(ctx, {
        actor: "Fig POS",
        clientId: client.id,
        kind: "crash",
        message: `Crash report received: ${input.title}`,
      });
    }
    return { id, clientId: client?.id ?? null };
  },
});

export const reportCrash = httpAction(async (ctx, request) => {
  let body: any = null;
  try {
    body = await request.json();
  } catch {
    return json({ message: "Invalid request body." }, 400);
  }
  const deviceId = typeof body?.deviceId === "string" ? body.deviceId : "";
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const message = typeof body?.message === "string" ? body.message : "";
  if (!deviceId || !title || !message) {
    return json({ message: "deviceId, title and message are required." }, 400);
  }
  try {
    const result = await ctx.runMutation(internal.crashes.createCrashReport, {
      clientId:
        typeof body?.clientId === "string" && body.clientId
          ? body.clientId
          : undefined,
      deviceId,
      licenseKey:
        typeof body?.licenseKey === "string" && body.licenseKey
          ? body.licenseKey
          : undefined,
      app: typeof body?.app === "string" ? body.app : "Fig POS",
      version: typeof body?.version === "string" ? body.version : undefined,
      platform: typeof body?.platform === "string" ? body.platform : undefined,
      title,
      message,
      logTail: typeof body?.logTail === "string" ? body.logTail : undefined,
    });
    return json(result, 200);
  } catch (error) {
    return json(
      {
        message:
          error instanceof ConvexError
            ? String(error.data)
            : "Could not store the crash report.",
      },
      400,
    );
  }
});
