import { z } from "zod";

export const devLoginSchema = z.object({
  password: z.string().min(1),
});

const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;

export const identifierSchema = z
  .string()
  .regex(IDENT, "Invalid identifier");

export const rowsQuerySchema = z.object({
  table: identifierSchema,
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
  q: z.string().optional(),
});

export const updateRowSchema = z.object({
  table: identifierSchema,
  pkColumn: identifierSchema,
  pkValue: z.union([z.string(), z.number()]),
  data: z.record(z.string().regex(IDENT), z.unknown()),
});

export const deleteRowSchema = z.object({
  table: identifierSchema,
  pkColumn: identifierSchema,
  pkValue: z.union([z.string(), z.number()]),
});

export const insertRowSchema = z.object({
  table: identifierSchema,
  data: z.record(z.string().regex(IDENT), z.unknown()).refine(
    (d) => Object.keys(d).length > 0,
    "At least one column is required",
  ),
});

export type RowsQueryInput = z.infer<typeof rowsQuerySchema>;
export type UpdateRowInput = z.infer<typeof updateRowSchema>;
export type DeleteRowInput = z.infer<typeof deleteRowSchema>;
export type InsertRowInput = z.infer<typeof insertRowSchema>;
export type PurgeRowInput = DeleteRowInput;

export const runTemplatesSchema = z.object({
  ids: z.array(z.string().min(1)).min(1, "Select at least one template"),
});
