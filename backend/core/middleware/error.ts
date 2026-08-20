import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { logger } from "../lib/logger";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly meta?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    error: {
      code: "not_found",
      message: `Route ${req.method} ${req.originalUrl} not found`,
    },
  });
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        code: "validation_error",
        message: err.issues.map((issue) => issue.message).join("; "),
      },
    });
    return;
  }

  if (err instanceof ApiError) {
    res.status(err.status).json({
      error: { code: err.code, message: err.message, ...(err.meta ?? {}) },
    });
    return;
  }

  const httpError = err as { status?: number; type?: string; message?: string };
  if (httpError.status && httpError.status >= 400 && httpError.status < 500) {
    const tooLarge = httpError.type === "entity.too.large";
    res.status(httpError.status).json({
      error: {
        code: tooLarge ? "payload_too_large" : "bad_request",
        message: tooLarge ? "Request body too large" : (httpError.message ?? "Invalid request"),
      },
    });
    return;
  }

  logger.error("Unhandled error", err, {
    method: _req.method,
    url: _req.originalUrl,
    userId: (_req as Request & { user?: { id?: string } }).user?.id,
  });
  res.status(500).json({
    error: { code: "internal_error", message: "Internal server error" },
  });
}
