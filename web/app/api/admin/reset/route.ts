import { NextResponse } from "next/server";
import { convexAdmin } from "@/lib/server/convex";
import { readAdminSession } from "@/lib/server/session";

export async function POST() {
  const session = await readAdminSession();
  if (!session || session.role !== "owner") {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  try {
    const data = await convexAdmin<{ deleted: Record<string, number> }>(
      "/admin/mutate",
      {
        type: "resetBusinessData",
        payload: {},
        actor: session.email,
      },
    );
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not reset data." },
      { status: 502 },
    );
  }
}
