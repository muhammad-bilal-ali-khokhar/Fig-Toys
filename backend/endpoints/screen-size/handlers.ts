import type { Request, Response } from "express";
import * as service from "./service";
export async function listHandler(_req: Request, res: Response) { res.json({ data: await service.listScreenSizes() }); }
export async function createHandler(req: Request, res: Response) { const userId = (req as any).user.id; res.status(201).json({ data: await service.createScreenSize(req.body, userId) }); }
export async function updateHandler(req: Request, res: Response) { const userId = (req as any).user.id; res.json({ data: await service.updateScreenSize(req.params.id, req.body, userId) }); }
export async function deleteHandler(req: Request, res: Response) { const userId = (req as any).user.id; res.json({ data: await service.deleteScreenSize(req.params.id, userId) }); }
export async function deactivateHandler(req: Request, res: Response) { const userId = (req as any).user.id; res.json({ data: await service.deactivateScreenSize(req.params.id, userId) }); }
