import type { NextFunction, Request, Response } from "express";
import { createWriteStream, mkdirSync, type WriteStream } from "node:fs";
import { join, resolve } from "node:path";
import { env } from "../config/env";

type Level = "debug" | "info" | "warn" | "error";

const LEVEL_ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

const DEFAULT_LEVEL: Level = env.NODE_ENV === "test" ? "error" : "debug";

let currentLevel: Level = DEFAULT_LEVEL;
let stream: WriteStream | null = null;

function resolveLevel(): Level {
  const raw = process.env.LOG_LEVEL;
  if (raw && raw in LEVEL_ORDER) return raw as Level;
  return currentLevel;
}

function fileStream(): WriteStream | null {
  if (stream) return stream;
  try {
    const dir = resolve(process.cwd(), "logs");
    mkdirSync(dir, { recursive: true });
    stream = createWriteStream(join(dir, "fig-backend.log"), { flags: "a" });
    stream.on("error", () => {
      stream = null;
    });
    return stream;
  } catch {
    return null;
  }
}

function write(level: Level, msg: string, fields?: Record<string, unknown>) {
  try {
    if (LEVEL_ORDER[level] < LEVEL_ORDER[resolveLevel()]) return;
    const line = JSON.stringify({ ts: new Date().toISOString(), level, msg, ...fields });
    if (level === "error" || level === "warn") console.error(line);
    else console.log(line);
    const s = fileStream();
    if (s) s.write(line + "\n");
  } catch {
    // logging must never crash the app
  }
}

function sanitizeError(err: unknown): Record<string, unknown> {
  if (err instanceof Error) {
    return { error: err.message, stack: err.stack, name: err.name };
  }
  return { error: String(err) };
}

export const logger = {
  setLevel(level: Level) {
    currentLevel = level;
  },
  debug(msg: string, fields?: Record<string, unknown>) {
    write("debug", msg, fields);
  },
  info(msg: string, fields?: Record<string, unknown>) {
    write("info", msg, fields);
  },
  warn(msg: string, fields?: Record<string, unknown>) {
    write("warn", msg, fields);
  },
  error(msg: string, err?: unknown, fields?: Record<string, unknown>) {
    write("error", msg, { ...(err ? sanitizeError(err) : {}), ...fields });
  },
  event(type: string, data?: Record<string, unknown>) {
    write("info", `event:${type}`, { event: type, ...data });
  },
};

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = process.hrtime.bigint();
  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    const user = (req as Request & { user?: { id?: string; username?: string } }).user;
    write("info", `${req.method} ${req.originalUrl}`, {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      durationMs: Math.round(durationMs * 10) / 10,
      userId: user?.id,
      username: user?.username,
      ip: req.ip,
    });
  });
  next();
}