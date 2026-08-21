import type { Request, Response } from "express";
import { createBank, deleteBank, listBanks, updateBank } from "./service";
import type { BankInput } from "./schemas";

export async function listHandler(_req: Request, res: Response) {
  res.json({ data: await listBanks() });
}

export async function createHandler(req: Request, res: Response) {
  const bank = await createBank(req.body as BankInput, req.user!.id);
  res.status(201).json({ data: bank });
}

export async function updateHandler(req: Request, res: Response) {
  const bank = await updateBank(req.params.id, req.body as BankInput, req.user!.id);
  res.json({ data: bank });
}

export async function deleteHandler(req: Request, res: Response) {
  const result = await deleteBank(req.params.id, req.user!.id);
  res.json({ data: result });
}
