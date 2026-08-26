import { z } from "zod";

export const contactSchema = z.object({
  type: z.enum(["WALK_IN", "CUSTOMER", "VENDOR", "BOTH", "USED_VENDOR"]).default("WALK_IN"),
  name: z.string().trim().min(1, "Name is required"),
  phone: z.string().trim().optional(),
  email: z.string().trim().email("Invalid email").optional().or(z.literal("")),
  address: z.string().trim().optional(),
  city: z.string().trim().optional(),
  cnic: z.string().trim().optional(),
  photoUrl: z.string().trim().optional(),
  cnicFrontUrl: z.string().trim().optional(),
  cnicBackUrl: z.string().trim().optional(),
  notes: z.string().trim().optional(),
  creditLimit: z.coerce.number().min(0).default(0),
});

export type ContactInput = z.infer<typeof contactSchema>;

export const importContactSchema = z.object({
  type: z.enum(["WALK_IN", "CUSTOMER", "VENDOR", "BOTH", "USED_VENDOR"]).default("WALK_IN"),
  name: z.string().trim().min(1, "Name is required"),
  phone: z.string().trim().optional(),
  email: z.string().trim().optional(),
  address: z.string().trim().optional(),
  city: z.string().trim().optional(),
  cnic: z.string().trim().optional(),
  notes: z.string().trim().optional(),
  creditLimit: z.coerce.number().min(0).default(0),
});

export const importContactsSchema = z.object({
  contacts: z.array(importContactSchema).min(1, "No contacts to import"),
});

export type ImportContactInput = z.infer<typeof importContactSchema>;
