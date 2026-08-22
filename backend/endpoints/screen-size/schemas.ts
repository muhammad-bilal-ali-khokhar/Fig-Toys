import { z } from "zod";
export const screenSizeSchema = z.object({ name: z.string().min(1).max(20), sortOrder: z.number().int().optional() });
export const screenSizeUpdateSchema = z.object({ name: z.string().min(1).max(20).optional(), sortOrder: z.number().int().optional(), active: z.boolean().optional() });
export type ScreenSizeInput = z.infer<typeof screenSizeSchema>;
export type ScreenSizeUpdateInput = z.infer<typeof screenSizeUpdateSchema>;
