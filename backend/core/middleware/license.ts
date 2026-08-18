import type { NextFunction, Request, RequestHandler, Response } from "express";
import { prisma } from "../lib/prisma";
import { ApiError } from "./error";

const LICENSE_ID = "store";

const ALLOWED_PREFIXES = [
  "/health",
  "/license",
  "/auth",
  "/setup",
];

export function requireLicense(): RequestHandler {
  return async (req: Request, _res: Response, next: NextFunction) => {
    const path = req.path;
    if (ALLOWED_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`) || path.startsWith(p))) {
      next();
      return;
    }

    try {
      const license = await prisma.license.findUnique({ where: { id: LICENSE_ID } });
      const active =
        license &&
        license.status === "ACTIVE" &&
        (!license.expiresAt || license.expiresAt.getTime() >= Date.now());

      if (!active) {
        next(new ApiError(403, "license.required", "A valid license is required to use Fig POS."));
        return;
      }
      next();
    } catch (e) {
      next(e);
    }
  };
}