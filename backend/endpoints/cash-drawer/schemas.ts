import { z } from "zod";

export const cashDrawerSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  isDefault: z.boolean().optional(),
  active: z.boolean().optional(),
  sortOrder: z.coerce.number().int().min(0).optional(),
});

export const cashDrawerUpdateSchema = cashDrawerSchema.partial();

export type CashDrawerInput = z.infer<typeof cashDrawerSchema>;
export type CashDrawerUpdateInput = z.infer<typeof cashDrawerUpdateSchema>;
