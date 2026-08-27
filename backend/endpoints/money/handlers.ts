import type { Request, Response } from "express";
import { adjust, movements, overview, settleCard, transfer } from "./service";
import type { AdjustInput, SettleCardInput, TransferInput } from "./schemas";

export async function overviewHandler(_req: Request, res: Response) {
  res.json({ data: await overview() });
}

export async function movementsHandler(req: Request, res: Response) {
  const { account, drawerId, from, to, tz } = req.query;
  res.json({
    data: await movements({
      account: typeof account === "string" ? account : undefined,
      drawerId: typeof drawerId === "string" ? drawerId : undefined,
      from: typeof from === "string" ? from : undefined,
      to: typeof to === "string" ? to : undefined,
      tz: typeof tz === "string" ? tz : undefined,
    }),
  });
}

export async function settleCardHandler(req: Request, res: Response) {
  res.json({ data: await settleCard(req.body as SettleCardInput, req.user!.id) });
}

export async function transferHandler(req: Request, res: Response) {
  res.json({ data: await transfer(req.body as TransferInput, req.user!.id) });
}

export async function adjustHandler(req: Request, res: Response) {
  res.json({ data: await adjust(req.body as AdjustInput, req.user!.id) });
}
