import { NextResponse } from "next/server";
import { posAdminHeaders, posApiBase } from "@/lib/server/pos-admin";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const base = posApiBase();
  if (!base) {
    return NextResponse.json({ error: "Live POS data is not configured." }, { status: 503 });
  }
  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as { reason?: string } | null;

  try {
    const response = await fetch(
      `${base}/license/admin/payments/${encodeURIComponent(id)}/reject`,
      {
        method: "POST",
        headers: posAdminHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ reason: body?.reason }),
        signal: AbortSignal.timeout(15_000),
      },
    );
    const payload = (await response.json().catch(() => null)) as
      | { data?: unknown; error?: { message?: string } }
      | null;
    if (!response.ok || payload?.data === undefined) {
      return NextResponse.json(
        { error: payload?.error?.message ?? "Could not reject the payment." },
        { status: response.status || 502 },
      );
    }
    return NextResponse.json({ data: payload.data });
  } catch {
    return NextResponse.json({ error: "Could not reach the local POS." }, { status: 502 });
  }
}
