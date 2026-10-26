import { NextResponse } from "next/server";
import { posAdminHeaders, posApiBase } from "@/lib/server/pos-admin";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const base = posApiBase();
  if (!base) {
    return NextResponse.json({ error: "Live POS data is not configured." }, { status: 503 });
  }

  const body = (await request.json().catch(() => null)) as {
    minutes?: unknown;
  } | null;
  const minutes = typeof body?.minutes === "number" ? Math.round(body.minutes) : 0;
  if (minutes < 1 || minutes > 43_200) {
    return NextResponse.json(
      { error: "Trial minutes must be between 1 and 43200." },
      { status: 400 },
    );
  }

  try {
    const response = await fetch(`${base}/license/admin/trial`, {
      method: "POST",
      headers: posAdminHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ minutes }),
      signal: AbortSignal.timeout(15_000),
    });
    const payload = (await response.json().catch(() => null)) as
      | { data?: unknown; error?: { message?: string } }
      | null;
    if (!response.ok || payload?.data === undefined) {
      return NextResponse.json(
        { error: payload?.error?.message ?? "Could not update the trial." },
        { status: response.status || 502 },
      );
    }
    return NextResponse.json({ data: payload.data });
  } catch {
    return NextResponse.json({ error: "Could not reach the local POS." }, { status: 502 });
  }
}
