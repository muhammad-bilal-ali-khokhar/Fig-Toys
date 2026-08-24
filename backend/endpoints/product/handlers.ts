import type { Request, Response } from "express";
import { hasPermissionList, PERMISSIONS } from "../../core/lib/permissions";
import {
  bulkDeleteProducts,
  createProduct,
  getProduct,
  getProductLedger,
  importProducts,
  listProducts,
  searchProducts,
  updateProduct,
} from "./service";
import type { ImportProductInput, ProductInput } from "./schemas";

function stripCosts<T extends { costPrice?: unknown }>(item: T, canView: boolean) {
  if (!canView) delete item.costPrice;
  return item;
}

export async function listHandler(req: Request, res: Response) {
  const { q, categoryId } = req.query;
  const items = await listProducts({
    q: typeof q === "string" ? q : undefined,
    categoryId: typeof categoryId === "string" ? categoryId : undefined,
  });
  const canView = hasPermissionList(req.user?.permissions, PERMISSIONS.reportProfit);
  res.json({ data: items.map((p) => stripCosts(p, canView)) });
}

export async function getHandler(req: Request, res: Response) {
  const product = await getProduct(req.params.id);
  res.json({ data: stripCosts(product, hasPermissionList(req.user?.permissions, PERMISSIONS.reportProfit)) });
}

export async function ledgerHandler(req: Request, res: Response) {
  res.json({ data: await getProductLedger(req.params.id) });
}

export async function createHandler(req: Request, res: Response) {
    const input = req.body as ProductInput;
  const product = await createProduct(input, req.user!.id);
  res.status(201).json({ data: product });
}

export async function updateHandler(req: Request, res: Response) {
    const product = await updateProduct(req.params.id, req.body as ProductInput, req.user!.id);
  res.json({ data: product });
}

export async function searchHandler(req: Request, res: Response) {
  const q = typeof req.query.q === "string" ? req.query.q : "";
  const statuses = typeof req.query.statuses === "string"
    ? req.query.statuses.split(",").filter(Boolean)
    : ["IN_STOCK"];
  res.json({ data: await searchProducts(q, statuses) });
}

export async function bulkDeleteHandler(req: Request, res: Response) {
    const ids = (req.body?.ids ?? []) as string[];
  const result = await bulkDeleteProducts(ids, req.user!.id);
  res.json({ data: result });
}

export async function importHandler(req: Request, res: Response) {
    const rows = req.body.products as ImportProductInput[];
  const result = await importProducts(rows, req.user!.id);
  res.json({ data: result });
}
