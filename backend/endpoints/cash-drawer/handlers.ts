import type { Request, Response } from "express";
import {
  createCashDrawer,
  deleteCashDrawer,
  listCashDrawers,
  setDefaultCashDrawer,
  updateCashDrawer,
} from "./service";
import type { CashDrawerInput, CashDrawerUpdateInput } from "./schemas";

export async function listHandler(_req: Request, res: Response) {
  res.json({ data: await listCashDrawers() });
}

export async function createHandler(req: Request, res: Response) {
  const drawer = await createCashDrawer(req.body as CashDrawerInput, req.user!.id);
  res.status(201).json({ data: drawer });
}

export async function updateHandler(req: Request, res: Response) {
  const drawer = await updateCashDrawer(req.params.id, req.body as CashDrawerUpdateInput, req.user!.id);
  res.json({ data: drawer });
}

export async function setDefaultHandler(req: Request, res: Response) {
  const drawer = await setDefaultCashDrawer(req.params.id, req.user!.id);
  res.json({ data: drawer });
}

export async function deleteHandler(req: Request, res: Response) {
  const result = await deleteCashDrawer(req.params.id, req.user!.id);
  res.json({ data: result });
}
