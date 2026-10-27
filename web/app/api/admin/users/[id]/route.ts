import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { convexAdmin } from "@/lib/server/convex";
import { hashPassword } from "@/lib/server/password";
import {
  createSessionValue,
  readAdminSession,
  sessionCookie,
} from "@/lib/server/session";

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

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await readAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (session.role === "support") {
    return NextResponse.json({ error: "You cannot edit users." }, { status: 403 });
  }
  const { id } = await context.params;
  const body = (await request.json().catch(() => null)) as {
    name?: unknown;
    email?: unknown;
    role?: unknown;
    disabled?: unknown;
    password?: unknown;
  } | null;
  const patch: Record<string, unknown> = {
    id,
    actorEmail: session.email,
    actorRole: session.role,
  };
  if (typeof body?.name === "string") patch.name = body.name.trim();
  if (typeof body?.email === "string") patch.email = body.email.trim().toLowerCase();
  if (body?.role !== undefined) {
    if (!isRole(body.role)) {
      return NextResponse.json({ error: "Invalid role." }, { status: 400 });
    }
    patch.role = body.role;
  }
  if (typeof body?.disabled === "boolean") patch.disabled = body.disabled;
  const password = typeof body?.password === "string" ? body.password : "";
  if (password && password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters." },
      { status: 400 },
    );
  }
  try {
    if (password) {
      const passwordHash = await hashPassword(password);
      await convexAdmin("/admin/mutate", {
        type: "setAdminUserPassword",
        payload: { id, passwordHash, actorRole: session.role },
        actor: session.email,
      });
    }
    if (Object.keys(patch).length > 3) {
      const data = await convexAdmin<{ user: AdminUser }>("/admin/mutate", {
        type: "updateAdminUser",
        payload: patch,
        actor: session.email,
      });
      if (data.user.email !== session.email || data.user.role !== session.role) {
        const store = await cookies();
        store.set(
          sessionCookie(
            await createSessionValue(data.user.email, data.user.role),
          ),
        );
      }
      return NextResponse.json({ user: data.user });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not update the user." },
      { status: 400 },
    );
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await readAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (session.role === "support") {
    return NextResponse.json({ error: "You cannot delete users." }, { status: 403 });
  }
  const { id } = await context.params;
  try {
    await convexAdmin("/admin/mutate", {
      type: "deleteAdminUser",
      payload: { id, actorEmail: session.email, actorRole: session.role },
      actor: session.email,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not delete the user." },
      { status: 400 },
    );
  }
}
