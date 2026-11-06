import type { Request, Response } from "express";
import { createBundle, deleteBundle, listBundles, updateBundle } from "./service";

export async function listHandler(_req: Request, res: Response) {
  res.json({ data: await listBundles() });
}

export async function createHandler(req: Request, res: Response) {
  res.status(201).json({ data: await createBundle(req.body, req.user!.id) });
}

export async function updateHandler(req: Request, res: Response) {
  res.json({ data: await updateBundle(req.params.id, req.body, req.user!.id) });
}

export async function deleteHandler(req: Request, res: Response) {
  await deleteBundle(req.params.id, req.user!.id);
  res.status(204).send();
}
