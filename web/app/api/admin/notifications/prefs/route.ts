import { NextResponse } from "next/server";
import { convexAdmin } from "@/lib/server/convex";
import { readAdminSession } from "@/lib/server/session";

export async function POST(request: Request) {
  const session = await readAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as {
    prefs?: Record<string, unknown>;
  } | null;
  const prefs = body?.prefs ?? {};
  try {
    await convexAdmin("/admin/mutate", {
      type: "saveNotificationPrefs",
      payload: {
        email: session.email,
        prefs: {
          payments: Boolean(prefs.payments),
          clients: Boolean(prefs.clients),
          crashes: Boolean(prefs.crashes),
          releases: Boolean(prefs.releases),
          expiry: prefs.expiry !== false,
        },
      },
      actor: session.email,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not save preferences." },
      { status: 400 },
    );
  }
}
