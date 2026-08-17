import { z } from "zod";

export const printLayoutSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(40),
  format: z.enum(["58", "80", "a4"]).default("80"),
  options: z.record(z.string(), z.boolean()).default({}),
  qrType: z.enum(["none", "whatsapp", "website"]).default("whatsapp"),
  isDefault: z.boolean().optional(),
});

export const printLayoutUpdateSchema = printLayoutSchema.partial();

export const printLayoutImportSchema = z.object({
  layouts: z.array(printLayoutSchema).min(1, "Provide at least one layout"),
});

export type PrintLayoutInput = z.infer<typeof printLayoutSchema>;
export type PrintLayoutUpdateInput = z.infer<typeof printLayoutUpdateSchema>;
export type PrintLayoutImportInput = z.infer<typeof printLayoutImportSchema>;
