import type { Request, Response } from "express";
import { listPrintSettings, upsertPrintSetting } from "./service";
import type { PrintSettingInput } from "./schemas";

export async function listHandler(req: Request, res: Response) {
  res.json({ data: await listPrintSettings() });
}

export async function upsertHandler(req: Request, res: Response) {
  const input = req.body as PrintSettingInput;
  res.json({ data: await upsertPrintSetting(input.docType, input) });
}
