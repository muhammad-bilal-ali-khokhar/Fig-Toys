import bcrypt from "bcryptjs";
import { prisma } from "../../core/lib/prisma";
import { ApiError } from "../../core/middleware/error";
import { writeAudit } from "../../core/lib/audit";
import { env } from "../../core/config/env";
import { ROLE_PERMISSIONS, storedPermissions } from "../../core/lib/permissions";
import type { Role } from "../../generated/prisma/enums";
import type { CreateUserInput, UpdateUserInput } from "./schemas";

const select = {
  id: true,
  username: true,
  name: true,
  email: true,
  role: true,
  avatar: true,
  active: true,
  permissions: true,
  createdAt: true,
} as const;

export async function listUsers() {
  const users = await prisma.user.findMany({ select, orderBy: { createdAt: "asc" } });
  return users.map((u) => ({ ...u, system: u.username === "SYSTEM" }));
}

export async function createUser(input: CreateUserInput, actorId: string) {
  const username = input.username.toUpperCase();
  const email = input.email ? input.email.toLowerCase() : `${username.toLowerCase()}@local`;
  const permissions =
    input.permissions !== undefined
      ? storedPermissions(input.permissions)
      : [...ROLE_PERMISSIONS[input.role]];

  const user = await prisma.user.create({
    data: {
      username,
      name: input.name,
      email,
      avatar: input.avatar ?? null,
      pinHash: await bcrypt.hash(input.pin, env.BCRYPT_ROUNDS),
      role: input.role as Role,
      active: input.active ?? true,
      permissions,
    },
    select,
  });
  await writeAudit({
    userId: actorId,
    action: "USER.CREATE",
    entity: "User",
    entityId: user.id,
    details: JSON.stringify({ username, role: user.role }),
  });
  return user;
}

export async function updateUser(
  id: string,
  input: UpdateUserInput,
  actorId: string,
  actorRole: Role,
) {
  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) throw new ApiError(404, "user.not_found", "User not found");

  if (existing.username === "SYSTEM" && (input.role !== undefined || input.permissions !== undefined || input.active === false || input.username !== undefined || input.pin !== undefined)) {
    throw new ApiError(400, "user.cannot_edit_system", "The SYSTEM account cannot be edited");
  }

  if (id === actorId && input.role !== undefined) {
    throw new ApiError(400, "user.cannot_change_own_role", "You cannot change your own role");
  }
  if (id === actorId && input.permissions !== undefined) {
    throw new ApiError(400, "user.cannot_change_own_permissions", "You cannot change your own permissions");
  }
  if (id === actorId && input.active === false) {
    throw new ApiError(400, "user.cannot_deactivate_self", "You cannot deactivate your own account");
  }
  if (id === actorId && input.pin !== undefined) {
    throw new ApiError(400, "user.cannot_change_own_pin", "Change your PIN from Settings instead");
  }
  if (input.pin !== undefined && actorRole !== "ADMIN") {
    throw new ApiError(403, "user.pin_admin_only", "Only an admin can change a user's PIN");
  }

  const data: Record<string, unknown> = {};
  if (input.username !== undefined) data.username = input.username.toUpperCase();
  if (input.name !== undefined) data.name = input.name;
  if (input.email !== undefined) data.email = input.email.toLowerCase();
  if (input.pin !== undefined) data.pinHash = await bcrypt.hash(input.pin, env.BCRYPT_ROUNDS);
  if (input.role !== undefined) data.role = input.role as Role;
  if (input.avatar !== undefined) data.avatar = input.avatar;
  if (input.active !== undefined) data.active = input.active;
  if (input.permissions !== undefined) data.permissions = storedPermissions(input.permissions);

  const removingAdmin =
    existing.role === "ADMIN" &&
    (data.role !== undefined && data.role !== "ADMIN");
  const removingOwnAccess =
    existing.role === "ADMIN" &&
    data.permissions !== undefined &&
    !(data.permissions as string[]).includes("user.manage");
  if (removingAdmin || removingOwnAccess) {
    const adminCount = await prisma.user.count({ where: { role: "ADMIN", active: true } });
    if (adminCount <= 1) {
      throw new ApiError(400, "user.last_admin", "You cannot remove the only admin");
    }
  }

  const user = await prisma.user.update({ where: { id }, data, select });
  await writeAudit({
    userId: actorId,
    action: "USER.UPDATE",
    entity: "User",
    entityId: id,
    details: JSON.stringify({ username: user.username, role: user.role, active: user.active }),
  });
  return user;
}

export async function deleteUser(id: string, actorId: string, actorRole: Role) {
  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) throw new ApiError(404, "user.not_found", "User not found");
  if (existing.username === "SYSTEM") {
    throw new ApiError(400, "user.cannot_delete_system", "The SYSTEM account cannot be deleted");
  }
  if (id === actorId) {
    throw new ApiError(400, "user.cannot_delete_self", "You cannot delete your own account");
  }
  if (existing.role === "ADMIN" && actorRole !== "ADMIN") {
    throw new ApiError(403, "user.admin_delete_only", "Only an admin can delete an admin");
  }
  if (existing.role === "ADMIN") {
    const adminCount = await prisma.user.count({ where: { role: "ADMIN", active: true } });
    if (adminCount <= 1) {
      throw new ApiError(400, "user.last_admin", "You cannot delete the only admin");
    }
  }

  await prisma.$transaction([
    prisma.dashboardWidget.deleteMany({ where: { userId: id } }),
    prisma.user.delete({ where: { id } }),
  ]);

  await writeAudit({
    userId: actorId,
    action: "USER.DELETE",
    entity: "User",
    entityId: id,
    details: JSON.stringify({ username: existing.username, role: existing.role }),
  });
  return { id, username: existing.username };
}
