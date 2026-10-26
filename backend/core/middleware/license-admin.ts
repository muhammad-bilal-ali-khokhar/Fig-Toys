import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env";

export function requireLicenseAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const expected = env.LICENSE_LOCAL_ADMIN_TOKEN?.trim();
  if (!expected) {
    res.status(503).json({
      error: { code: "license.admin_not_configured", message: "License admin is not configured." },
    });
    return;
  }

  const provided = (req.header("x-license-admin") ?? "").trim();
  if (provided !== expected) {
    res.status(401).json({
      error: { code: "license.admin_unauthorized", message: "Unauthorized." },
    });
    return;
  }

  next();
}
