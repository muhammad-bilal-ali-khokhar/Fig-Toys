import { z } from "zod";

export const searchSchema = z.object({
  q: z.string().trim().min(1, "Search term is required").max(80),
});

export type SearchInput = z.infer<typeof searchSchema>;