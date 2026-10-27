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
    p256dh?: unknown;
    auth?: unknown;
  } | null;
  const endpoint = typeof body?.endpoint === "string" ? body.endpoint : "";
  const p256dh = typeof body?.p256dh === "string" ? body.p256dh : "";
  const auth = typeof body?.auth === "string" ? body.auth : "";
  if (!endpoint.startsWith("https://") || !p256dh || !auth) {
    return NextResponse.json({ error: "Invalid subscription." }, { status: 400 });
  }
  try {
    await convexAdmin("/admin/mutate", {
      type: "savePushSubscription",
      payload: { email: session.email, endpoint, p256dh, auth },
      actor: session.email,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not save subscription." },
      { status: 400 },
    );
  }
}
