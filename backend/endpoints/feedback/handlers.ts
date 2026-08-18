import type { Request, Response } from "express";
import { env } from "../../core/config/env";
import { ApiError } from "../../core/middleware/error";
import { submitCrashReport } from "./service";
import type { CrashReportInput } from "./schemas";

export async function crashReportHandler(req: Request, res: Response) {
  const secret = (env.FIG_FEEDBACK_SECRET || "").trim();
  const provided = req.headers["x-feedback-secret"];
  if (secret && provided !== secret) {
    throw new ApiError(403, "feedback.forbidden", "Invalid feedback secret.");
  }

  const report = await submitCrashReport(req.body as CrashReportInput);
  res.json({ data: { sent: true, id: report.id, url: report.url } });
}

export async function feedbackStatusHandler(_req: Request, res: Response) {
  res.json({ data: { enabled: true } });
}