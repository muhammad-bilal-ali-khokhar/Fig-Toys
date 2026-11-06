import type { Request, Response } from "express";
import { hasPermissionList, PERMISSIONS } from "../../core/lib/permissions";
import { adjustQuantity, listInventory } from "./service";

export async function inventoryHandler(req: Request, res: Response) {
  const canView = hasPermissionList(req.user?.permissions, PERMISSIONS.reportProfit);
  const result = await listInventory(canView);
  res.json({
    data: {
      units: result.units.map((u) => (canView ? u : { ...u, costPrice: undefined })),
      products: result.products.map((p) => (canView ? p : { ...p, costPrice: undefined })),
      lowStock: result.lowStock,
      valuation: result.valuation,
      byCondition: result.byCondition,
    },
  });
}

export async function quantityAdjustmentHandler(req: Request, res: Response) {
  res.json({ data: await adjustQuantity(req.body, req.user!.id) });
}
