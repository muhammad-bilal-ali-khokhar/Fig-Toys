import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminCredentials, convexAdmin } from "@/lib/server/convex";
import { hashPassword, verifyPassword } from "@/lib/server/password";
import { createSessionValue, sessionCookie, type AdminRole } from "@/lib/server/session";

type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
  disabled: boolean;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    email?: unknown;
    password?: unknown;
  } | null;
  const email =
    typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  if (!email || !password) {
    return NextResponse.json(
      { error: "Enter your email and password." },
      { status: 400 },
    );
  }

  let user: AdminUser | null = null;

  try {
    const lookup = await convexAdmin<{
      user: (AdminUser & { passwordHash: string }) | null;
    }>("/admin/mutate", {
      type: "lookupAdminUser",
      payload: { email },
      actor: "login",
    });

    if (lookup.user) {
      if (lookup.user.disabled) {
        return NextResponse.json(
          { error: "This account is disabled." },
          { status: 403 },
        );
      }
      const valid = await verifyPassword(password, lookup.user.passwordHash);
      if (!valid) {
        return NextResponse.json(
          { error: "Wrong email or password." },
          { status: 401 },
        );
      }
      user = lookup.user;
    } else {
      const list = await convexAdmin<{ users: AdminUser[] }>("/admin/mutate", {
        type: "listAdminUsers",
        payload: {},
        actor: "login",
      });
      const expected = adminCredentials();
      if (
        list.users.length === 0 &&
        email === expected.email &&
        password === expected.password &&
        expected.password
      ) {
        const passwordHash = await hashPassword(password);
        const created = await convexAdmin<{ user: AdminUser }>(
          "/admin/mutate",
          {
            type: "createAdminUser",
            payload: {
              name: process.env.ADMIN_NAME?.trim() || "Owner",
              email,
              role: "owner",
              actorRole: "owner",
              passwordHash,
            },
            actor: "bootstrap",
          },
        );
        user = created.user;
      }
    }
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not sign in right now.",
      },
      { status: 502 },
    );
  }

  if (!user) {
    return NextResponse.json(
      { error: "Wrong email or password." },
      { status: 401 },
    );
  }

  try {
    await convexAdmin("/admin/mutate", {
      type: "touchAdminUser",
      payload: { id: user.id },
      actor: user.email,
    });
  } catch {
    // login should still succeed if the timestamp update fails
  }

  const store = await cookies();
  store.set(sessionCookie(await createSessionValue(user.email, user.role)));
  return NextResponse.json({
    email: user.email,
    name: user.name,
    role: user.role,
  });
}
