import { readFileSync } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type ConvexConfig = {
  siteUrl: string;
  token: string;
};

function readConvexEnv(): Partial<ConvexConfig> {
  try {
    const file = path.join(process.cwd(), "..", "convex", ".env.local");
    const lines = readFileSync(file, "utf8").split("\n");
    const values = new Map<string, string>();
    for (const line of lines) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!match) continue;
      values.set(match[1], match[2].trim().replace(/^["']|["']$/g, ""));
    }
    return {
      siteUrl: values.get("CONVEX_SITE_URL"),
      token: values.get("LICENSE_ADMIN_TOKEN") ?? values.get("CONVEX_ADMIN_KEY"),
    };
  } catch {
    return {};
  }
}

function config(): ConvexConfig | null {
  const local = readConvexEnv();
  const siteUrl = (process.env.CONVEX_SITE_URL ?? local.siteUrl ?? "").replace(/\/+$/, "");
  const token = (process.env.LICENSE_ADMIN_TOKEN ?? local.token ?? "").trim();
  if (!siteUrl || !token) return null;
  return { siteUrl, token };
}

export async function POST(request: Request) {
  const cfg = config();
  if (!cfg) {
    return NextResponse.json(
      { error: "The license server is not configured." },
      { status: 503 },
    );
  }

  const body = (await request.json().catch(() => null)) as {
    customerName?: unknown;
    maxDevices?: unknown;
    pricePkr?: unknown;
    expiresAt?: unknown;
  } | null;

  const customerName =
    typeof body?.customerName === "string" ? body.customerName.trim() : "";
  const maxDevices =
    typeof body?.maxDevices === "number" && body.maxDevices > 0
      ? Math.min(50, Math.round(body.maxDevices))
      : 1;
  const pricePkr =
    typeof body?.pricePkr === "number" && body.pricePkr > 0
      ? Math.round(body.pricePkr)
      : undefined;
  const expiresAt =
    typeof body?.expiresAt === "number" ? Math.round(body.expiresAt) : undefined;

  if (!customerName) {
    return NextResponse.json(
      { error: "Customer name is required." },
      { status: 400 },
    );
  }

  try {
    const response = await fetch(`${cfg.siteUrl}/mint`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cfg.token}`,
      },
      body: JSON.stringify({
        customerName,
        edition: "PRO",
        maxDevices,
        pricePkr,
        expiresAt,
      }),
      signal: AbortSignal.timeout(20_000),
    });
    const data = (await response.json().catch(() => null)) as {
      code?: string;
      message?: string;
    } | null;
    if (!response.ok || !data?.code) {
      return NextResponse.json(
        { error: data?.message ?? "The license server rejected the request." },
        { status: response.status || 502 },
      );
    }
    return NextResponse.json({
      code: data.code,
      customerName,
      maxDevices,
      pricePkr: pricePkr ?? null,
      expiresAt: expiresAt ?? null,
    });
  } catch {
    return NextResponse.json(
      { error: "Could not reach the license server." },
      { status: 502 },
    );
  }
}
