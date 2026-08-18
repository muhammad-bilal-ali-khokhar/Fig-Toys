import type { Request, Response } from "express";
import { activateLicense, getLicenseStatus } from "./service";
import type { ActivateInput } from "./schemas";

export async function statusHandler(_req: Request, res: Response) {
  res.json({ data: await getLicenseStatus() });
}

export async function activateHandler(req: Request, res: Response) {
  res.status(200).json({ data: await activateLicense(req.body as ActivateInput) });
}