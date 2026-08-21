import type { Request, Response } from "express";
import {
  cancelPurchaseOrder,
  createPurchaseOrder,
  fulfillPurchaseOrder,
  getPurchaseOrder,
  listPurchaseOrders,
  receivePurchaseOrder,
} from "./service";
import type { CreatePurchaseOrderInput, FulfillPurchaseOrderInput, ReceivePurchaseOrderInput } from "./schemas";

export async function listHandler(req: Request, res: Response) {
  res.json({ data: await listPurchaseOrders() });
}

export async function getHandler(req: Request, res: Response) {
  res.json({ data: await getPurchaseOrder(req.params.id) });
}

export async function createHandler(req: Request, res: Response) {
  const order = await createPurchaseOrder(req.body as CreatePurchaseOrderInput, req.user!.id);
  res.status(201).json({ data: order });
}

export async function receiveHandler(req: Request, res: Response) {
  const order = await receivePurchaseOrder(req.params.id, req.body as ReceivePurchaseOrderInput, req.user!.id);
  res.json({ data: order });
}

export async function fulfillHandler(req: Request, res: Response) {
  const order = await fulfillPurchaseOrder(req.params.id, req.body as FulfillPurchaseOrderInput, req.user!.id);
  res.json({ data: order });
}

export async function cancelHandler(req: Request, res: Response) {
  const order = await cancelPurchaseOrder(req.params.id, req.user!.id);
  res.json({ data: order });
}
