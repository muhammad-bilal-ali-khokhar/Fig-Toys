import { API_BASE, AUTH } from "@/lib/constants";
import { enqueueQueuedRequest } from "@/lib/offline-queue";
import { logger } from "@/lib/logger";

export class ApiClientError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  signal?: AbortSignal;
};

export async function apiRequest<T>(
  path: string,
  { method = "GET", body, signal }: RequestOptions = {},
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (err) {
    const isWrite = method !== "GET";
    if (isWrite) {
      enqueueQueuedRequest({ path, method: method as "POST" | "PUT" | "PATCH" | "DELETE", body });
      throw new ApiClientError(0, "offline_queued", "You're offline. This change is saved and will sync when you're back online.");
    }
    logger.warn("api.network", `Network error ${method} ${path}`, { error: String(err) });
    throw err;
  }

  if (!res.ok) {
    if (res.status === 401 && typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(AUTH.unauthorizedEvent));
    }
    const payload = (await res.json().catch(() => null)) as {
      error?: { code?: string; message?: string };
    } | null;
    if (res.status >= 500) {
      logger.error("api.error", `${method} ${path} failed (${res.status})`, payload?.error);
    }
    throw new ApiClientError(
      res.status,
      payload?.error?.code ?? "unknown",
      payload?.error?.message ?? `Request failed (${res.status})`,
    );
  }

  const payload = (await res.json()) as { data?: T };
  return payload.data as T;
}
