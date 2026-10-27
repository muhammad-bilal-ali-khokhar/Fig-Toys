import { NextResponse } from "next/server";
import { convexAdmin } from "@/lib/server/convex";
import { readAdminSession } from "@/lib/server/session";

export async function POST(request: Request) {
  const session = await readAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as {
    id?: unknown;
    all?: unknown;
  } | null;
  const id = typeof body?.id === "string" ? body.id : "";
  try {
    if (id) {
      await convexAdmin("/admin/mutate", {
        type: "markNotificationRead",
        payload: { id, email: session.email },
        actor: session.email,
      });
    } else {
      await convexAdmin("/admin/mutate", {
        type: "markAllNotificationsRead",
        payload: { email: session.email },
        actor: session.email,
      });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not update notifications." },
      { status: 400 },
    );
  }
}
