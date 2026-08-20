import { z } from "zod";

export const eventSchema = z.object({
  source: z.string().min(1).max(32).default("frontend"),
  level: z.enum(["debug", "info", "warn", "error"]).default("info"),
  type: z.string().min(1).max(64),
  message: z.string().min(1).max(500),
  detail: z.unknown().optional(),
  meta: z.unknown().optional(),
});

export type EventInput = z.infer<typeof eventSchema>;