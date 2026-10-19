import { z } from "zod";

export const productSchema = z.object({
  brandId: z.string().min(1, "Brand is required"),
  model: z.string().trim().min(1, "Model is required"),
  storage: z.string().trim().optional(),
  ram: z.string().trim().optional(),
  screenSize: z.string().trim().optional(),
  colorId: z.string().trim().optional(),
  categoryId: z.string().min(1, "Category is required"),
  carrier: z.enum(["PTA", "NON_PTA", "SIM_LOCKED"]).optional().nullable(),
  sku: z.string().trim().optional(),
  barcode: z.string().trim().optional(),
  image: z.string().trim().optional(),
  specs: z.string().optional(),
  sellPrice: z.coerce.number().min(0, "Sell price must be 0 or more"),
  costPrice: z.coerce.number().min(0, "Cost price must be 0 or more"),
  retailPrice: z.coerce.number().min(0, "Retail price must be 0 or more").optional(),
  lowStockThreshold: z.coerce.number().int().min(0).optional(),
});

export type ProductInput = z.infer<typeof productSchema>;

export const importProductSchema = z.object({
  brand: z.string().trim().min(1, "Brand is required"),
  model: z.string().trim().min(1, "Model is required"),
  storage: z.string().trim().optional(),
  ram: z.string().trim().optional(),
  screenSize: z.string().trim().optional(),
  color: z.string().trim().optional(),
  category: z.string().trim().min(1, "Category is required"),
  subcategory: z.string().trim().optional(),
  carrier: z.enum(["PTA", "NON_PTA", "SIM_LOCKED"]).optional().nullable(),
  sku: z.string().trim().optional(),
  barcode: z.string().trim().optional(),
  image: z.string().trim().optional(),
  specs: z.string().optional(),
  sellPrice: z.coerce.number().min(0, "Sell price must be 0 or more"),
  costPrice: z.coerce.number().min(0, "Cost price must be 0 or more"),
  retailPrice: z.coerce.number().min(0, "Retail price must be 0 or more").optional(),
  lowStockThreshold: z.coerce.number().int().min(0).optional(),
});

export const importProductsSchema = z.object({
  products: z.array(importProductSchema).min(1, "No products to import"),
});

export type ImportProductInput = z.infer<typeof importProductSchema>;
