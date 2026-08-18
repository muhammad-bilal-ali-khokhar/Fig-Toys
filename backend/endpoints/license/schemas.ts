import { z } from "zod";

export const activateSchema = z.object({
  key: z.string().trim().min(1, "License key is required"),
});

export type ActivateInput = z.infer<typeof activateSchema>;

export const licenseStatusSchema = z.object({
  status: z.enum(["UNLICENSED", "ACTIVE", "EXPIRED"]),
  customerName: z.string().nullable(),
  edition: z.string(),
  expiresAt: z.string().nullable(),
  maxDevices: z.number(),
  deviceId: z.string().nullable(),
});

export type LicenseStatus = z.infer<typeof licenseStatusSchema>;
