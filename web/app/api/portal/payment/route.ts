import { NextResponse } from "next/server";
import { convexPublic } from "@/lib/server/convex";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  try {
    const data = await convexPublic("/portal/payment", body ?? {});
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Payment failed." },
      { status: 400 },
    );
  }
}
