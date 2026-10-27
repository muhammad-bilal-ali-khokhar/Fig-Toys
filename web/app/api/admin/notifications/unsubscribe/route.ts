import { NextResponse } from "next/server";
import { convexAdmin } from "@/lib/server/convex";
import { readAdminSession } from "@/lib/server/session";

export async function POST(request: Request) {
  const session = await readAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as {
    endpoint?: unknown;
  } | null;
  const endpoint = typeof body?.endpoint === "string" ? body.endpoint : "";
  if (!endpoint) {
    return NextResponse.json({ error: "Endpoint is required." }, { status: 400 });
  }
  try {
    await convexAdmin("/admin/mutate", {
      type: "removePushSubscription",
      payload: { email: session.email, endpoint },
      actor: session.email,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not remove subscription." },
      { status: 400 },
    );
  }
}
