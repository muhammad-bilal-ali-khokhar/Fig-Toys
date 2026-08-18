import type { Request, Response } from "express";
import { ApiError } from "../../core/middleware/error";
import { searchSchema } from "./schemas";
import * as search from "./service";

export async function searchHandler(req: Request, res: Response) {
  const parsed = searchSchema.safeParse({ q: req.query.q });
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw new ApiError(400, "validation_error", first?.message ?? "Invalid search term");
  }
  res.json({ data: await search.globalSearch(parsed.data.q) });
}