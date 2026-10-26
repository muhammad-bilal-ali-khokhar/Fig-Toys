import { NextResponse } from "next/server";
import { posAdminHeaders, posApiBase } from "@/lib/server/pos-admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const base = posApiBase();
  if (!base) {
    return NextResponse.json({ live: false });
  }

  try {
    const response = await fetch(`${base}/license/admin/shop`, {
      headers: posAdminHeaders(),
      cache: "no-store",
      signal: AbortSignal.timeout(3500),
    });
    if (!response.ok) {
      return NextResponse.json({ live: false });
    }
    const payload = (await response.json()) as { data?: unknown };
    if (!payload.data) {
      return NextResponse.json({ live: false });
    }
    return NextResponse.json({ live: true, data: payload.data });
  } catch {
    return NextResponse.json({ live: false });
  }
}
