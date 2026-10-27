import { NextResponse } from "next/server";
import { convexAdmin } from "@/lib/server/convex";
import { hashPassword } from "@/lib/server/password";
import { readAdminSession } from "@/lib/server/session";

type Role = "owner" | "admin" | "support";

type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  disabled: boolean;
};

function isRole(value: unknown): value is Role {
  return value === "owner" || value === "admin" || value === "support";
}

export async function GET() {
  const session = await readAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  try {
    const data = await convexAdmin<{ users: AdminUser[] }>("/admin/mutate", {
      type: "listAdminUsers",
      payload: {},
      actor: session.email,
    });
    return NextResponse.json({
      users: data.users,
      currentEmail: session.email,
      currentRole: session.role,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not load users." },
      { status: 502 },
    );
  }
}

export async function POST(request: Request) {
  const session = await readAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (session.role === "support") {
    return NextResponse.json({ error: "You cannot create users." }, { status: 403 });
  }
  const body = (await request.json().catch(() => null)) as {
    name?: unknown;
    email?: unknown;
    role?: unknown;
    password?: unknown;
  } | null;
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const email =
    typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const role = body?.role;
  const password = typeof body?.password === "string" ? body.password : "";
  if (!name || !email || !isRole(role) || password.length < 8) {
    return NextResponse.json(
      { error: "Name, email, role and a password of at least 8 characters are required." },
      { status: 400 },
    );
  }
  try {
    const passwordHash = await hashPassword(password);
    const data = await convexAdmin<{ user: AdminUser }>("/admin/mutate", {
      type: "createAdminUser",
      payload: { name, email, role, passwordHash, actorRole: session.role },
      actor: session.email,
    });
    return NextResponse.json({ user: data.user });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not create the user." },
      { status: 400 },
    );
  }
}
