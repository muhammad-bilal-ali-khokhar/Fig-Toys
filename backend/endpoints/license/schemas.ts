import { z } from "zod";

export const activateSchema = z.object({
  key: z.string().trim().min(1, "License key is required"),
});

export type ActivateInput = z.infer<typeof activateSchema>;

export const redeemSchema = z.object({
  code: z.string().trim().regex(/^\d{10}$/, "Enter the 10-digit code"),
});

export type RedeemInput = z.infer<typeof redeemSchema>;

export const licenseStatusSchema = z.object({
  status: z.enum(["UNLICENSED", "TRIAL", "ACTIVE", "EXPIRED"]),
  customerName: z.string().nullable(),
  edition: z.string(),
  expiresAt: z.string().nullable(),
  maxDevices: z.number(),
  deviceId: z.string().nullable(),
  pricePkr: z.number(),
  trialStartedAt: z.string().nullable(),
  trialEndsAt: z.string().nullable(),
  purchasedAt: z.string().nullable(),
  lastPaymentAt: z.string().nullable(),
  hasPurchased: z.boolean(),
  trialDays: z.number(),
  periodDays: z.number(),
  jazzcashName: z.string(),
  jazzcashNumber: z.string(),
  qrUrl: z.string(),
  whatsapp: z.string(),
  paymentMode: z.enum(["sandbox", "live", "manual"]),
  payments: z.array(
    z.object({
      id: z.string(),
      amountPkr: z.number(),
      method: z.string(),
      txnId: z.string(),
      note: z.string().nullable(),
      paidAt: z.string(),
    }),
  ),
});

export type LicenseStatus = z.infer<typeof licenseStatusSchema>;

export const paymentSchema = z.object({
  txnId: z.string().trim().min(4, "Enter the payment transaction ID").max(80),
  note: z.string().trim().max(200).optional(),
});

export type PaymentInput = z.infer<typeof paymentSchema>;
