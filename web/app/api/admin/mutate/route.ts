import { NextResponse } from "next/server";
import { convexAdmin } from "@/lib/server/convex";
import { readAdminSession } from "@/lib/server/session";

export async function POST(request: Request) {
  const session = await readAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as {
    type?: unknown;
    payload?: unknown;
  } | null;
  const type = typeof body?.type === "string" ? body.type : "";
  if (!type) {
    return NextResponse.json({ error: "Action type is required." }, { status: 400 });
  }
  try {
    const data = await convexAdmin("/admin/mutate", {
      type,
      payload: body?.payload ?? {},
      actor: session.email,
    });
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Action failed." },
      { status: 400 },
    );
  }
}
