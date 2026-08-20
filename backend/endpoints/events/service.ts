import { prisma } from "../../core/lib/prisma";
import { logger } from "../../core/lib/logger";
import type { EventInput } from "./schemas";

export async function recordEvent(input: EventInput) {
  const detail = input.detail === undefined ? null : JSON.stringify(input.detail);
  const meta = input.meta === undefined ? null : JSON.stringify(input.meta);

  const stored = await prisma.eventLog.create({
    data: {
      source: input.source,
      level: input.level,
      type: input.type,
      message: input.message,
      detail,
      meta,
    },
  });

  const fields =
    input.detail && typeof input.detail === "object"
      ? (input.detail as Record<string, unknown>)
      : undefined;

  if (input.level === "error") logger.error(`[${input.source}:${input.type}] ${input.message}`, undefined, fields);
  else if (input.level === "warn") logger.warn(`[${input.source}:${input.type}] ${input.message}`, fields);
  else logger.info(`[${input.source}:${input.type}] ${input.message}`, fields);

  return stored;
}