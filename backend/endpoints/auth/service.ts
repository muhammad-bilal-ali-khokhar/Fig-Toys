import bcrypt from "bcryptjs";
import type { Role } from "../../generated/prisma/enums";
import { signToken } from "../../core/lib/jwt";
import { prisma } from "../../core/lib/prisma";
import { effectivePermissions } from "../../core/lib/permissions";
import { ApiError } from "../../core/middleware/error";
import { writeAudit } from "../../core/lib/audit";
import { env } from "../../core/config/env";
import { buildLoginKeys, registerLoginFailure, registerLoginSuccess } from "../../core/lib/loginThrottle";
import type { LoginInput } from "./schemas";

type UserRecord = {
  id: string;
  username: string;
  name: string;
  email: string;
  role: Role;
  avatar: string | null;
  permissions: string[];
};

function toUserPayload(user: UserRecord) {
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    email: user.email,
    role: user.role,
    avatar: user.avatar,
    permissions: effectivePermissions(user),
  };
}

export async function loginUser({ username, pin, ip }: LoginInput & { ip: string }) {
  const keys = buildLoginKeys(username, ip);

  const user = await prisma.user.findUnique({
    where: { username: username.toUpperCase() },
  });

  if (user && !user.active) {
    await registerLoginFailure(keys, username);
    throw new ApiError(
      401,
      "auth.user_inactive",
      "This account is inactive. Ask an admin to reactivate it.",
    );
  }

  const pinValid = user ? await bcrypt.compare(pin, user.pinHash) : false;

  if (!user || !pinValid) {
    await registerLoginFailure(keys, username);
    throw new ApiError(
      401,
      "auth.invalid_credentials",
      "Invalid username or PIN.",
    );
  }

  await registerLoginSuccess(keys);

  const token = signToken({
    sub: user.id,
    username: user.username,
    role: user.role,
  });

  return {
    token,
    user: toUserPayload(user as UserRecord),
  };
}

export async function getUser(id: string) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user || !user.active) {
    throw new ApiError(401, "auth.unauthorized", "Not authorized");
  }
  return toUserPayload(user as UserRecord);
}

export async function changePin(userId: string, currentPin: string, newPin: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new ApiError(404, "user.not_found", "User not found");

  const pinValid = await bcrypt.compare(currentPin, user.pinHash);
  if (!pinValid) {
    throw new ApiError(400, "auth.pin_incorrect", "Current PIN is incorrect");
  }

  await prisma.user.update({
    where: { id: userId },
    data: { pinHash: await bcrypt.hash(newPin, env.BCRYPT_ROUNDS) },
  });

  await writeAudit({
    userId,
    action: "USER.CHANGE_PIN",
    entity: "User",
    entityId: userId,
  });

  return { ok: true };
}
