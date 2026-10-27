type ConvexConfig = { siteUrl: string; token: string };

function config(): ConvexConfig {
  const siteUrl = (process.env.CONVEX_SITE_URL ?? "").replace(/\/+$/, "");
  const token = (process.env.LICENSE_ADMIN_TOKEN ?? "").trim();
  if (!siteUrl) throw new Error("CONVEX_SITE_URL is not configured.");
  return { siteUrl, token };
}

async function call(path: string, body: unknown, admin: boolean) {
  const cfg = config();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (admin) {
    if (!cfg.token) throw new Error("LICENSE_ADMIN_TOKEN is not configured.");
    headers.Authorization = `Bearer ${cfg.token}`;
  }
  const response = await fetch(`${cfg.siteUrl}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body ?? {}),
    signal: AbortSignal.timeout(20_000),
    cache: "no-store",
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      data && typeof data.message === "string"
        ? data.message
        : "The license server rejected the request.";
    throw new Error(message);
  }
  return data;
}

export function convexAdmin<T>(path: string, body: unknown = {}): Promise<T> {
  return call(path, body, true) as Promise<T>;
}

export function convexPublic<T>(path: string, body: unknown = {}): Promise<T> {
  return call(path, body, false) as Promise<T>;
}

export function sessionSecret(): string {
  return (
    process.env.ADMIN_SESSION_SECRET ??
    process.env.LICENSE_ADMIN_TOKEN ??
    ""
  ).trim();
}

export function adminCredentials() {
  return {
    email: (process.env.ADMIN_EMAIL ?? "fig@dev.com").trim().toLowerCase(),
    password: process.env.ADMIN_PASSWORD ?? "",
  };
}
