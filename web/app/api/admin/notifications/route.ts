import { NextResponse } from "next/server";
import { convexAdmin } from "@/lib/server/convex";
import { readAdminSession } from "@/lib/server/session";

export async function GET() {
  const session = await readAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  try {
    const data = await convexAdmin<Record<string, unknown>>("/admin/mutate", {
      type: "notificationsState",
      payload: { email: session.email },
      actor: session.email,
    });
    return NextResponse.json({
      ...data,
      publicKey: process.env.VAPID_PUBLIC_KEY ?? "",
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not load notifications." },
      { status: 502 },
    );
  }
}
