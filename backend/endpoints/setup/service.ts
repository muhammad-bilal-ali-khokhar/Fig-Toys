import bcrypt from "bcryptjs";
import { prisma } from "../../core/lib/prisma";
import { ApiError } from "../../core/middleware/error";
import { env } from "../../core/config/env";
import { COMPANY_ID } from "../../core/lib/company";
import { ROLE_PERMISSIONS } from "../../core/lib/permissions";
import { ensureBank } from "../bank/service";
import type { Role } from "../../generated/prisma/enums";
import type { SetupInput } from "./schemas";

export async function getSetupStatus() {
  const adminCount = await prisma.user.count({
    where: { role: "ADMIN", active: true },
  });
  return { needsSetup: adminCount === 0 };
}

export async function runSetup(input: SetupInput) {
  const { needsSetup } = await getSetupStatus();
  if (!needsSetup) {
    throw new ApiError(
      409,
      "setup.already_done",
      "This store is already set up. Sign in instead.",
    );
  }

  const username = input.admin.username.toUpperCase();
  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) {
    throw new ApiError(
      409,
      "setup.username_taken",
      `The username "${username}" is already in use. Pick another.`,
    );
  }

  const admin = await prisma.user.create({
    data: {
      username,
      name: input.admin.name,
      email: input.admin.email
        ? input.admin.email.toLowerCase()
        : `${username.toLowerCase()}@local`,
      pinHash: await bcrypt.hash(input.admin.pin, env.BCRYPT_ROUNDS),
      role: "ADMIN" as Role,
      active: true,
      permissions: [...ROLE_PERMISSIONS.ADMIN],
    },
  });

  await prisma.companyProfile.upsert({
    where: { id: COMPANY_ID },
    update: {
      name: input.company.name,
      tagline: input.company.tagline ?? null,
      address: input.company.address ?? null,
      phone: input.company.phone ?? null,
      email: input.company.email ?? null,
      footerText: input.company.footerText ?? null,
      currency: input.company.currency,
      timezone: input.company.timezone,
    },
    create: {
      id: COMPANY_ID,
      name: input.company.name,
      tagline: input.company.tagline ?? null,
      address: input.company.address ?? null,
      phone: input.company.phone ?? null,
      email: input.company.email ?? null,
      footerText: input.company.footerText ?? null,
      currency: input.company.currency,
      timezone: input.company.timezone,
    },
  });

  const bankAccounts = [];
  for (const [index, account] of (input.bankAccounts ?? []).entries()) {
    await ensureBank(account.bankName);
    bankAccounts.push(
      await prisma.bankAccount.create({
        data: {
          companyId: COMPANY_ID,
          name: account.name,
          bankName: account.bankName,
          accountNo: account.accountNo,
          holderName: account.holderName || null,
          iban: account.iban || null,
          active: true,
          isDefault: index === 0,
        },
      }),
    );
  }

  return {
    user: {
      id: admin.id,
      username: admin.username,
      name: admin.name,
      email: admin.email,
      role: admin.role,
      active: admin.active,
    },
    bankAccounts,
  };
}