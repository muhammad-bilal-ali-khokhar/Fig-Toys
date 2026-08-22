import { API_BASE } from "@/lib/constants";

export type LogLevel = "debug" | "info" | "warn" | "error";

const QUEUE: Record<string, { count: number; first: number }> = {};
const WINDOW_MS = 60_000;
const MAX_PER_KEY = 20;

function key(level: LogLevel, type: string, message: string) {
  return `${level}:${type}:${message}`;
}

function shouldSend(level: LogLevel, type: string, message: string) {
  const k = key(level, type, message);
  const now = Date.now();
  const entry = QUEUE[k];
  if (!entry) {
    QUEUE[k] = { count: 1, first: now };
    return true;
  }
  if (now - entry.first > WINDOW_MS) {
    QUEUE[k] = { count: 1, first: now };
    return true;
  }
  entry.count += 1;
  return entry.count <= MAX_PER_KEY;
}

function send(level: LogLevel, type: string, message: string, detail?: unknown) {
  if (!shouldSend(level, type, message)) return;
  const payload = { source: "frontend", level, type, message };
  try {
    void fetch(`${API_BASE}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, detail }),
    }).catch(() => undefined);
  } catch {
    // silent
  }
}

function emit(level: LogLevel, type: string, message: string, detail?: unknown) {
  const suffix = detail === undefined ? "" : ` ${JSON.stringify(detail)}`;
  const line = `[frontend:${type}] ${message}${suffix}`;
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);

  if (level === "error" || level === "warn") send(level, type, message, detail);
}

function describeError(err: unknown): { message: string; detail?: unknown } {
  if (err instanceof Error) {
    return { message: err.message, detail: { name: err.name, stack: err.stack } };
  }
  return { message: String(err) };
}

export const logger = {
  debug(type: string, message: string, detail?: unknown) {
    emit("debug", type, message, detail);
  },
  info(type: string, message: string, detail?: unknown) {
    emit("info", type, message, detail);
  },
  warn(type: string, message: string, detail?: unknown) {
    emit("warn", type, message, detail);
  },
  error(type: string, message: string, detail?: unknown) {
    emit("error", type, message, detail);
  },
  errorObject(type: string, err: unknown) {
    const { message, detail } = describeError(err);
    emit("error", type, message, detail);
  },
};

export function setupGlobalErrorCapture() {
  if (typeof window === "undefined") return;

  window.addEventListener("error", (event) => {
    const err = event.error ?? event.message;
    logger.errorObject("window.error", err instanceof Error ? err : new Error(String(event.message)));
  });

  window.addEventListener("unhandledrejection", (event) => {
    logger.errorObject("unhandledrejection", event.reason);
  });
}