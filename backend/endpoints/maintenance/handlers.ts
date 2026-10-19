import type { Request, Response } from "express";
import { resetData } from "./service";
import type { ResetInput } from "./schemas";

export async function resetHandler(req: Request, res: Response) {
  const { sections } = req.body as ResetInput;
  res.json({ data: await resetData(sections, req.user!.id) });
}
