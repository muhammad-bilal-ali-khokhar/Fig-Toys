import type { Request, Response } from "express";
import {
  createPurchase,
  createPurchaseReturn,
  createSale,
  createSaleReturn,
  getTransaction,
  listTransactions,
  modifyPurchase,
  modifyPurchaseReturn,
  modifySale,
  modifySaleReturn,
  voidReturn,
} from "./service";
import type {
  CreatePurchaseInput,
  CreateSaleInput,
  PurchaseReturnInput,
  SaleReturnInput,
} from "./schemas";

export async function listHandler(req: Request, res: Response) {
  const { type, q, limit, from, to, tz } = req.query;
  res.json({
    data: await listTransactions({
      type: typeof type === "string" ? type : undefined,
      q: typeof q === "string" ? q : undefined,
      limit: typeof limit === "string" ? Number(limit) : undefined,
      from: typeof from === "string" ? from : undefined,
      to: typeof to === "string" ? to : undefined,
      tz: typeof tz === "string" ? tz : undefined,
    }),
  });
}

export async function getHandler(req: Request, res: Response) {
  res.json({ data: await getTransaction(req.params.id) });
}

export async function createSaleHandler(req: Request, res: Response) {
  res.status(201).json({ data: await createSale(req.body as CreateSaleInput, req.user!.id) });
}

export async function createPurchaseHandler(req: Request, res: Response) {
  res.status(201).json({ data: await createPurchase(req.body as CreatePurchaseInput, req.user!.id) });
}

export async function saleReturnHandler(req: Request, res: Response) {
  res.status(201).json({ data: await createSaleReturn(req.body as SaleReturnInput, req.user!.id) });
}

export async function purchaseReturnHandler(req: Request, res: Response) {
  res.status(201).json({ data: await createPurchaseReturn(req.body as PurchaseReturnInput, req.user!.id) });
}

export async function voidReturnHandler(req: Request, res: Response) {
  res.json({ data: await voidReturn(req.params.id, req.user!.id) });
}

export async function modifySaleHandler(req: Request, res: Response) {
  res.json({ data: await modifySale(req.params.id, req.body as CreateSaleInput, req.user!.id) });
}

export async function modifyPurchaseHandler(req: Request, res: Response) {
  res.json({ data: await modifyPurchase(req.params.id, req.body as CreatePurchaseInput, req.user!.id) });
}

export async function modifySaleReturnHandler(req: Request, res: Response) {
  res.json({ data: await modifySaleReturn(req.params.id, req.body as SaleReturnInput, req.user!.id) });
}

export async function modifyPurchaseReturnHandler(req: Request, res: Response) {
  res.json({ data: await modifyPurchaseReturn(req.params.id, req.body as PurchaseReturnInput, req.user!.id) });
}
