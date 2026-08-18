import type { Request, Response } from "express";
import { ApiError } from "../../core/middleware/error";
import { hasPermissionList, PERMISSIONS } from "../../core/lib/permissions";
import {
  adjustUnit,
  bulkDeleteUnits,
  createUnit,
  getDeviceLedger,
  getReturnEligibility,
  getSaleReturnEligibility,
  getUnit,
  getUnitByImei,
  importUnits,
  listMovements,
  listUnits,
  updateUnit,
} from "./service";
import type { AdjustInput, ImportUnitInput, UnitInput, UnitUpdateInput } from "./schemas";

export async function listHandler(req: Request, res: Response) {
  const { condition, status, q, productId } = req.query;
  const canView = hasPermissionList(req.user?.permissions, PERMISSIONS.reportProfit);
  const units = await listUnits({
    condition: typeof condition === "string" ? condition : undefined,
    status: typeof status === "string" ? status : undefined,
    q: typeof q === "string" ? q : undefined,
    productId: typeof productId === "string" ? productId : undefined,
  });
  res.json({
    data: units.map((u) => (canView ? u : { ...u, costPrice: undefined })),
  });
}

export async function imeiHandler(req: Request, res: Response) {
  res.json({ data: await getUnitByImei(req.params.imei) });
}

export async function deviceLedgerHandler(req: Request, res: Response) {
  const result = await getDeviceLedger(req.params.imei);
  if (!hasPermissionList(req.user?.permissions, PERMISSIONS.reportProfit)) {
    res.json({ data: { ...result, unit: { ...result.unit, costPrice: undefined } } });
    return;
  }
  res.json({ data: result });
}

export async function returnEligibleHandler(req: Request, res: Response) {
  const imei = typeof req.query.imei === "string" ? req.query.imei : "";
  const contactId = typeof req.query.contactId === "string" ? req.query.contactId : undefined;
  if (!imei) {
    throw new ApiError(400, "unit.eligibility_required", "imei is required");
  }
  const result = await getReturnEligibility(imei, contactId);
  if (!hasPermissionList(req.user!.permissions, PERMISSIONS.reportProfit) && result.eligible) {
    res.json({ data: { ...result, unit: { ...result.unit, costPrice: undefined } } });
    return;
  }
  res.json({ data: result });
}

export async function getHandler(req: Request, res: Response) {
  res.json({ data: await getUnit(req.params.id) });
}

export async function saleReturnEligibleHandler(req: Request, res: Response) {
  const imei = typeof req.query.imei === "string" ? req.query.imei : "";
  if (!imei) {
    throw new ApiError(400, "unit.eligibility_required", "imei is required");
  }
  res.json({ data: await getSaleReturnEligibility(imei) });
}

export async function movementsHandler(req: Request, res: Response) {
  const { limit, from, to, tz } = req.query;
  res.json({
    data: await listMovements({
      limit: typeof limit === "string" ? Number(limit) : undefined,
      from: typeof from === "string" ? from : undefined,
      to: typeof to === "string" ? to : undefined,
      tz: typeof tz === "string" ? tz : undefined,
    }),
  });
}

export async function adjustHandler(req: Request, res: Response) {
  res.json({ data: await adjustUnit(req.body as AdjustInput, req.user!.id) });
}

export async function createHandler(req: Request, res: Response) {
  res.status(201).json({ data: await createUnit(req.body as UnitInput, req.user!.id) });
}

export async function updateHandler(req: Request, res: Response) {
  res.json({ data: await updateUnit(req.params.id, req.body as UnitUpdateInput, req.user!.id) });
}

export async function bulkDeleteHandler(req: Request, res: Response) {
  const ids = (req.body?.ids ?? []) as string[];
  res.json({ data: await bulkDeleteUnits(ids, req.user!.id) });
}

export async function importHandler(req: Request, res: Response) {
  const rows = req.body.units as ImportUnitInput[];
  res.json({ data: await importUnits(rows, req.user!.id) });
}
