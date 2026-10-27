import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { clearSessionCookie } from "@/lib/server/session";

export async function POST() {
  const store = await cookies();
  store.set(clearSessionCookie());
  return NextResponse.json({ ok: true });
}
