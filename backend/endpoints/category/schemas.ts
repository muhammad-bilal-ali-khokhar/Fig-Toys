import { z } from "zod";

export const categorySchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  type: z.enum(["PHONE", "ACCESSORY"]).default("PHONE"),
  sortOrder: z.coerce.number().int().min(0).optional(),
  parentId: z.string().nullable().optional(),
});

export const categoryUpdateSchema = z.object({
  name: z.string().trim().min(1, "Name is required").optional(),
  type: z.enum(["PHONE", "ACCESSORY"]).optional(),
  sortOrder: z.coerce.number().int().min(0).optional(),
  active: z.boolean().optional(),
  parentId: z.string().nullable().optional(),
});

export type CategoryInput = z.infer<typeof categorySchema>;
export type CategoryUpdateInput = z.infer<typeof categoryUpdateSchema>;
