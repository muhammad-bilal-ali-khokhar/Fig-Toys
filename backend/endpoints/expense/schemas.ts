import { z } from "zod";

export const expenseSchema = z.object({
  category: z.string().trim().min(1, "Pick a category"),
  amount: z.coerce.number().positive("Amount must be more than 0"),
  note: z.string().trim().optional().nullable().or(z.literal("")),
  contactId: z.string().trim().optional().nullable().or(z.literal("")),
  date: z.string().trim().optional().nullable().or(z.literal("")),
  clientRef: z.string().trim().max(120).optional(),
  cashDrawerId: z.string().trim().optional().nullable().or(z.literal("")),
});

export const expenseUpdateSchema = expenseSchema.partial();

export type ExpenseInput = z.infer<typeof expenseSchema>;
export type ExpenseUpdateInput = z.infer<typeof expenseUpdateSchema>;
