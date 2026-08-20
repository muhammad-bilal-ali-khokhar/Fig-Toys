import type { NextFunction, Request, Response } from "express";
import { recordEvent } from "./service";
import { eventSchema } from "./schemas";
import { logger } from "../../core/lib/logger";

export async function recordHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const input = eventSchema.parse(req.body);
    await recordEvent(input);
    res.status(201).json({ data: { stored: true } });
  } catch (err) {
    logger.warn("Rejected event record", err instanceof Error ? { error: err.message } : { error: String(err) });
    next(err);
  }
}