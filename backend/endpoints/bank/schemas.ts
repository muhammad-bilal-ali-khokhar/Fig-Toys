import { z } from "zod";

export const bankSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
});

export type BankInput = z.infer<typeof bankSchema>;
