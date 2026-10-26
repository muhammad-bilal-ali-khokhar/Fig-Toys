import { NextResponse } from "next/server";
import { posAdminHeaders, posApiBase } from "@/lib/server/pos-admin";

export const dynamic = "force-dynamic";

async function forwarded(path: string, init?: RequestInit) {
  const base = posApiBase();
  if (!base) {
    return NextResponse.json({ error: "Live POS data is not configured." }, { status: 503 });
  }
  try {
    const response = await fetch(`${base}${path}`, {
      ...init,
      headers: posAdminHeaders(init?.headers),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    const payload = (await response.json().catch(() => null)) as
      | { data?: unknown; error?: { message?: string } }
      | null;
    if (!response.ok || payload?.data === undefined) {
      return NextResponse.json(
        { error: payload?.error?.message ?? "The local POS rejected the request." },
        { status: response.status || 502 },
      );
    }
    return NextResponse.json({ data: payload.data });
  } catch {
    return NextResponse.json({ error: "Could not reach the local POS." }, { status: 502 });
  }
}

export async function GET() {
  return forwarded("/license/admin/payment-config");
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  return forwarded("/license/admin/payment-config", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
}
