import { z } from "zod";

const docTypes = [
  "SALE",
  "PURCHASE",
  "SALE_RETURN",
  "PURCHASE_RETURN",
  "VOUCHER",
  "EXPENSE",
  "EXPENSE_SHEET",
  "INVENTORY",
  "CONTACTS",
] as const;

export const printSettingSchema = z.object({
  docType: z.enum(docTypes),
  format: z.enum(["58", "80", "a4"]).default("80"),
  options: z.record(z.string(), z.boolean()).default({}),
  qrType: z.enum(["none", "whatsapp", "website"]).default("whatsapp"),
});

export type PrintSettingInput = z.infer<typeof printSettingSchema>;
