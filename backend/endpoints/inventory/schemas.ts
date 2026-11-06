import { z } from "zod";

export const quantityAdjustmentSchema = z.object({
  productId: z.string().min(1),
  quantity: z.coerce.number().int(),
  damagedQuantity: z.coerce.number().int().min(0).optional(),
  note: z.string().trim().max(500).optional(),
});

export type QuantityAdjustmentInput = z.infer<typeof quantityAdjustmentSchema>;
