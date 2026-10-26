import { NextResponse } from "next/server";
import { posAdminHeaders, posApiBase } from "@/lib/server/pos-admin";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const base = posApiBase();
  if (!base) {
    return NextResponse.json({ error: "Live POS data is not configured." }, { status: 503 });
  }

  const body = (await request.json().catch(() => null)) as {
    action?: string;
    subscription?: unknown;
    endpoint?: string;
  } | null;

  const action = body?.action;
  const path =
    action === "subscribe"
      ? "/license/admin/push/subscribe"
      : action === "unsubscribe"
        ? "/license/admin/push/unsubscribe"
        : action === "test"
          ? "/license/admin/push/test"
          : null;
  if (!path) {
    return NextResponse.json({ error: "Unknown push action." }, { status: 400 });
  }

  const payload =
    action === "subscribe"
      ? body?.subscription
      : action === "unsubscribe"
        ? { endpoint: body?.endpoint }
        : {};

  try {
    const response = await fetch(`${base}${path}`, {
      method: "POST",
      headers: posAdminHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload ?? {}),
      signal: AbortSignal.timeout(15_000),
    });
    const data = (await response.json().catch(() => null)) as
      | { data?: unknown; error?: { message?: string } }
      | null;
    if (!response.ok || data?.data === undefined) {
      return NextResponse.json(
        { error: data?.error?.message ?? "Push request failed." },
        { status: response.status || 502 },
      );
    }
    return NextResponse.json({ data: data.data });
  } catch {
    return NextResponse.json({ error: "Could not reach the local POS." }, { status: 502 });
  }
}
