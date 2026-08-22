import jwt from "jsonwebtoken";
import type { Role } from "../../generated/prisma/enums";
import { env } from "../config/env";

export type JwtPayload = {
  sub: string;
  username: string;
  role: Role;
  tenant?: string;
};

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  } as jwt.SignOptions);
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, env.JWT_SECRET) as JwtPayload;
}
