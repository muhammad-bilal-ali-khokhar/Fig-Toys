import { z } from "zod";

const paymentSchema = z.object({
  method: z.enum(["CASH", "CARD", "BANK_TRANSFER", "CREDIT"]),
  amount: z.coerce.number().positive("Payment amount must be positive"),
  tendered: z.coerce.number().min(0).optional(),
  reference: z.string().trim().optional(),
  bankAccountId: z.string().optional(),
});

export const saleItemSchema = z.object({
  productId: z.string().min(1, "productId is required"),
  unitId: z.string().optional(),
  quantity: z.coerce.number().int().min(1).default(1),
  unitPrice: z.coerce.number().min(0, "Price must be 0 or more"),
  discount: z.coerce.number().min(0).default(0),
});

export const createSaleSchema = z.object({
  contactId: z.string().min(1, "contactId is required"),
  items: z.array(saleItemSchema).min(1, "At least one item is required"),
  payments: z.array(paymentSchema).optional().default([]),
  discount: z.coerce.number().min(0).default(0),
  note: z.string().trim().optional(),
  number: z.string().trim().optional(),
  clientRef: z.string().trim().max(120).optional(),
  date: z.string().trim().optional(),
});

export const purchaseItemSchema = z.object({
  productId: z.string().min(1, "productId is required"),
  imei: z.string().trim().optional(),
  barcode: z.string().trim().optional(),
  costPrice: z.coerce.number().min(0, "Cost must be 0 or more"),
  quantity: z.coerce.number().int().min(1).default(1),
  condition: z.enum(["NEW", "USED"]).default("NEW"),
  grade: z.string().trim().optional(),
  carrier: z.enum(["NON_PTA", "PTA", "SIM_LOCKED"]).optional(),
  batteryHealth: z.coerce.number().int().min(0).max(100).optional(),
  colorId: z.string().optional(),
});

export const createPurchaseSchema = z.object({
  contactId: z.string().min(1, "contactId is required"),
  items: z.array(purchaseItemSchema).min(1, "At least one item is required"),
  payments: z.array(paymentSchema).optional().default([]),
  discount: z.coerce.number().min(0).default(0),
  note: z.string().trim().optional(),
  number: z.string().trim().optional(),
  date: z.string().trim().optional(),
  clientRef: z.string().trim().max(120).optional(),
});

export const saleReturnItemSchema = z.object({
  unitId: z.string().optional(),
  productId: z.string().min(1, "productId is required"),
  quantity: z.coerce.number().int().min(1).default(1),
  refund: z.coerce.number().min(0).optional(),
});

export const saleReturnSchema = z.object({
  saleId: z.string().min(1, "saleId is required"),
  items: z.array(saleReturnItemSchema).min(1, "At least one item is required"),
  payments: z.array(paymentSchema).optional().default([]),
  refundMethod: z.enum(["CASH", "CREDIT"]).default("CASH"),
  note: z.string().trim().optional(),
  number: z.string().trim().optional(),
  date: z.string().trim().optional(),
  clientRef: z.string().trim().max(120).optional(),
});

export const purchaseReturnSchema = z.object({
  purchaseId: z.string().trim().optional().default(""),
  contactId: z.string().trim().optional(),
  unitIds: z.array(z.string()).optional().default([]),
  items: z
    .array(
      z.object({
        productId: z.string().min(1, "productId is required"),
        quantity: z.coerce.number().int().min(1).default(1),
        refund: z.coerce.number().min(0).optional(),
      }),
    )
    .optional()
    .default([]),
  payments: z.array(paymentSchema).optional().default([]),
  refundMethod: z.enum(["CASH", "CREDIT"]).default("CASH"),
  note: z.string().trim().optional(),
  number: z.string().trim().optional(),
  date: z.string().trim().optional(),
  clientRef: z.string().trim().max(120).optional(),
}).refine((d) => d.unitIds.length > 0 || d.items.length > 0, { message: "At least one unit or item is required", path: ["unitIds"] });

export type CreateSaleInput = z.infer<typeof createSaleSchema>;
export type CreatePurchaseInput = z.infer<typeof createPurchaseSchema>;
export type SaleReturnInput = z.infer<typeof saleReturnSchema>;
export type PurchaseReturnInput = z.infer<typeof purchaseReturnSchema>;
