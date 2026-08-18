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
  status: z.enum(["UNLICENSED", "ACTIVE", "EXPIRED"]),
  customerName: z.string().nullable(),
  edition: z.string(),
  expiresAt: z.string().nullable(),
  maxDevices: z.number(),
  deviceId: z.string().nullable(),
});

export type LicenseStatus = z.infer<typeof licenseStatusSchema>;
