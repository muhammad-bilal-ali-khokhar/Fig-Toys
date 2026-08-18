import { z } from "zod";

const timezone = z
  .string()
  .trim()
  .regex(/^[A-Za-z]+\/[A-Za-z_+-]+$/, "Use an IANA timezone like Asia/Karachi")
  .optional();

export const companyProfileSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  tagline: z.string().trim().optional(),
  address: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  email: z.string().trim().email("Invalid email").optional().or(z.literal("")),
  footerText: z.string().trim().optional(),
  logoUrl: z.string().trim().optional().or(z.literal("")),
  currency: z.string().trim().min(1).default("PKR"),
  taxRate: z.coerce.number().min(0).max(100).default(0),
  cardFee: z.coerce.number().min(0).max(100).default(0),
  compactPrices: z.boolean().optional(),
  timezone: timezone,
  raastId: z.string().trim().optional().or(z.literal("")),
  whatsapp: z.string().trim().optional().or(z.literal("")),
  website: z.string().trim().optional().or(z.literal("")),
});

export type CompanyProfileInput = z.infer<typeof companyProfileSchema>;

export const soundPrefsSchema = z.object({
  click: z.boolean().default(true),
  success: z.boolean().default(true),
  error: z.boolean().default(true),
  pop: z.boolean().default(true),
});

export type SoundPrefsInput = z.infer<typeof soundPrefsSchema>;
