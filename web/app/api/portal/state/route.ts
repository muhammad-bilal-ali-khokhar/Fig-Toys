import { NextResponse } from "next/server";
import { convexPublic } from "@/lib/server/convex";

export async function GET(request: Request) {
  const clientId = new URL(request.url).searchParams.get("client") ?? "";
  try {
    const data = await convexPublic("/portal/state", { clientId });
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not load data." },
      { status: 502 },
    );
  }
}
