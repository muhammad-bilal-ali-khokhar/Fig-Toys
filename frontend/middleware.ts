import { NextRequest, NextResponse } from "next/server";

// Desktop-only gate. When the Electron desktop app runs in local mode it sets a
// per-launch secret cookie ("fig.desktop") on the local server's origin before
// loading the window, and passes the same value to this server as
// FIG_DESKTOP_SECRET. Only requests carrying that cookie are allowed through,
// so a plain browser hitting http://localhost:<port> gets a 403.
//
// The variable is only set by the desktop shell. In web/hosted deployments
// (no FIG_DESKTOP_SECRET) this middleware is a no-op and the app serves
// normally.
const DESKTOP_COOKIE = "fig.desktop";

export function middleware(req: NextRequest) {
  const secret = process.env.FIG_DESKTOP_SECRET;
  if (!secret) return NextResponse.next();

  if (req.cookies.get(DESKTOP_COOKIE)?.value === secret) {
    return NextResponse.next();
  }
  return new NextResponse("Forbidden", { status: 403 });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico|api/health).*)"],
};