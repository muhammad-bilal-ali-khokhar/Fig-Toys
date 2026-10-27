import { NextResponse } from "next/server";
import { readAdminSession } from "@/lib/server/session";

export async function GET() {
  const session = await readAdminSession();
  return NextResponse.json({
    signedIn: Boolean(session),
    email: session?.email ?? null,
    role: session?.role ?? null,
  });
}
