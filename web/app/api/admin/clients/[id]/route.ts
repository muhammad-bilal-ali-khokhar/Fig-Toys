import { NextResponse } from "next/server";
import { convexAdmin } from "@/lib/server/convex";
import { readAdminSession } from "@/lib/server/session";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await readAdminSession();
  if (!session || session.role === "support") {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const { id } = await context.params;
  try {
    await convexAdmin("/admin/mutate", {
      type: "deleteClient",
      payload: { id },
      actor: session.email,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not delete the client." },
      { status: 400 },
    );
  }
}
