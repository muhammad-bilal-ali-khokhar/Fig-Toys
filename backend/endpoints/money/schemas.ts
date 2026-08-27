import { z } from "zod";

const accountEnum = z.enum(["cash", "bank"]);

export const settleCardSchema = z.object({
  amount: z.coerce.number().positive("Amount must be more than 0"),
  target: accountEnum.default("bank"),
  bankAccountId: z.string().trim().min(1).optional(),
  cashDrawerId: z.string().trim().min(1).optional(),
  date: z.string().trim().optional().nullable().or(z.literal("")),
  note: z.string().trim().optional().nullable().or(z.literal("")),
});

export const transferSchema = z.object({
  amount: z.coerce.number().positive("Amount must be more than 0"),
  from: accountEnum,
  fromBankId: z.string().trim().min(1).optional(),
  fromCashDrawerId: z.string().trim().min(1).optional(),
  to: accountEnum,
  toBankId: z.string().trim().min(1).optional(),
  toCashDrawerId: z.string().trim().min(1).optional(),
  date: z.string().trim().optional().nullable().or(z.literal("")),
  note: z.string().trim().optional().nullable().or(z.literal("")),
});

export const adjustSchema = z.object({
  account: accountEnum,
  bankAccountId: z.string().trim().min(1).optional(),
  cashDrawerId: z.string().trim().min(1).optional(),
  amount: z.coerce.number().refine((n) => n !== 0, "Amount cannot be 0"),
  date: z.string().trim().optional().nullable().or(z.literal("")),
  note: z.string().trim().optional().nullable().or(z.literal("")),
});

export type SettleCardInput = z.infer<typeof settleCardSchema>;
export type TransferInput = z.infer<typeof transferSchema>;
export type AdjustInput = z.infer<typeof adjustSchema>;
