import { z } from "zod";

export const RESET_SECTIONS = [
  "sales",
  "inventory",
  "contacts",
  "reservations",
  "purchaseOrders",
  "money",
  "logs",
] as const;

export type ResetSection = (typeof RESET_SECTIONS)[number];

export const resetSchema = z.object({
  sections: z.array(z.enum(RESET_SECTIONS)).min(1, "Pick at least one thing to reset"),
  confirm: z.literal("RESET", { error: 'Type RESET to confirm' }),
});

export type ResetInput = z.infer<typeof resetSchema>;
