import { z } from "zod";

const docTypes = [
  "SALE",
  "PURCHASE",
  "SALE_RETURN",
  "PURCHASE_RETURN",
  "VOUCHER",
  "EXPENSE",
  "RESERVATION",
  "CONSIGNMENT",
  "EXPENSE_SHEET",
  "INVENTORY",
  "CONTACTS",
  "SALES_REPORT",
  "PURCHASES_REPORT",
  "PROFIT_REPORT",
  "EXPENSES_REPORT",
  "PAYABLES",
  "RECEIVABLES",
  "SALES_LIST",
  "SALE_RETURNS",
  "PURCHASE_LIST",
  "PURCHASE_RETURNS",
  "LABEL",
] as const;

export const printConfigSchema = z.object({
  fontSize: z.number().min(8).max(16).default(11),
  lineHeight: z.number().min(1).max(2).default(1.35),
  paddingMm: z.number().min(0).max(10).default(3),
  marginMm: z.number().min(0).max(10).default(0),
  density: z.enum(["light", "normal", "bold"]).default("normal"),
  compact: z.boolean().default(false),
  headerScale: z.number().min(0.8).max(1.6).default(1),
  showLogo: z.boolean().default(true),
  qrSize: z.number().min(48).max(128).default(72),
  barcodeHeight: z.number().min(24).max(80).default(48),
  preset: z.enum(["50x30", "40x30", "38x25", "58x40", "100x50", "custom"]).optional(),
  widthMm: z.number().min(10).max(300).optional(),
  heightMm: z.number().min(10).max(300).optional(),
  gapMm: z.number().min(0).max(20).optional(),
  columns: z.number().int().min(1).max(6).optional(),
  copies: z.number().int().min(1).max(200).optional(),
  matchPrinter: z.boolean().optional(),
  showShop: z.boolean().optional(),
  showBrand: z.boolean().optional(),
  showModel: z.boolean().optional(),
  showPrice: z.boolean().optional(),
  showBarcode: z.boolean().optional(),
  showSku: z.boolean().optional(),
  showCategory: z.boolean().optional(),
  showAge: z.boolean().optional(),
}).partial().default({});

export const printSettingSchema = z.object({
  docType: z.enum(docTypes),
  format: z.enum(["58", "80", "a4"]).default("80"),
  options: z.record(z.string(), z.boolean()).default({}),
  qrType: z.enum(["none", "whatsapp", "website"]).default("whatsapp"),
  config: printConfigSchema.optional(),
});

export type PrintSettingInput = z.infer<typeof printSettingSchema>;
