import { z } from "zod";

export const bundleSchema = z.object({
  name: z.string().trim().min(1).max(160),
  sku: z.string().trim().max(80).optional(),
  price: z.coerce.number().min(0),
  active: z.boolean().optional().default(true),
  items: z.array(z.object({ productId: z.string().min(1), quantity: z.coerce.number().int().min(1) })).min(1),
});

export type BundleInput = z.infer<typeof bundleSchema>;
