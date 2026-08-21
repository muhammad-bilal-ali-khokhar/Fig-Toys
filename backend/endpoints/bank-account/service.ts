import { prisma } from "../../core/lib/prisma";
import { ApiError } from "../../core/middleware/error";
import { writeAudit } from "../../core/lib/audit";
import { COMPANY_ID } from "../../core/lib/company";
import { ensureBank } from "../bank/service";
import type { BankAccountInput, BankAccountUpdateInput } from "./schemas";

export async function listBankAccounts() {
  return prisma.bankAccount.findMany({
    where: { companyId: COMPANY_ID },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
  });
}

export async function createBankAccount(input: BankAccountInput, userId: string) {
  await ensureBank(input.bankName);
  const makeDefault = input.isDefault === true;
  if (makeDefault) {
    await prisma.bankAccount.updateMany({
      where: { companyId: COMPANY_ID },
      data: { isDefault: false },
    });
  }
  const account = await prisma.bankAccount.create({
    data: {
      companyId: COMPANY_ID,
      name: input.name,
      bankName: input.bankName,
      accountNo: input.accountNo,
      holderName: input.holderName || null,
      iban: input.iban || null,
      active: input.active ?? true,
      isDefault: makeDefault,
    },
  });
  await writeAudit({
    userId,
    action: "BANK_ACCOUNT.CREATE",
    entity: "BankAccount",
    entityId: account.id,
    details: JSON.stringify({ bankName: account.bankName, accountNo: account.accountNo }),
  });
  return account;
}

export async function updateBankAccount(id: string, input: BankAccountUpdateInput, userId: string) {
  const existing = await prisma.bankAccount.findFirst({ where: { id, companyId: COMPANY_ID } });
  if (!existing) throw new ApiError(404, "bank_account.not_found", "Bank account not found");

  if (input.isDefault === true) {
    await prisma.bankAccount.updateMany({
      where: { companyId: COMPANY_ID },
      data: { isDefault: false },
    });
  }
  if (input.isDefault === false && existing.isDefault) {
    const others = await prisma.bankAccount.count({ where: { companyId: COMPANY_ID, id: { not: id } } });
    if (others === 0) {
      throw new ApiError(409, "bank_account.need_default", "At least one default account is required");
    }
  }
  if (input.bankName !== undefined) {
    await ensureBank(input.bankName);
  }

  const account = await prisma.bankAccount.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.bankName !== undefined ? { bankName: input.bankName } : {}),
      ...(input.accountNo !== undefined ? { accountNo: input.accountNo } : {}),
      ...(input.holderName !== undefined ? { holderName: input.holderName || null } : {}),
      ...(input.iban !== undefined ? { iban: input.iban || null } : {}),
      ...(input.active !== undefined ? { active: input.active } : {}),
      ...(input.isDefault !== undefined ? { isDefault: input.isDefault } : {}),
    },
  });
  await writeAudit({
    userId,
    action: "BANK_ACCOUNT.UPDATE",
    entity: "BankAccount",
    entityId: account.id,
    details: JSON.stringify({ bankName: account.bankName, active: account.active }),
  });
  return account;
}

export async function setDefaultBankAccount(id: string, userId: string) {
  const existing = await prisma.bankAccount.findFirst({ where: { id, companyId: COMPANY_ID } });
  if (!existing) throw new ApiError(404, "bank_account.not_found", "Bank account not found");

  await prisma.bankAccount.updateMany({
    where: { companyId: COMPANY_ID },
    data: { isDefault: false },
  });
  const account = await prisma.bankAccount.update({ where: { id }, data: { isDefault: true } });
  await writeAudit({
    userId,
    action: "BANK_ACCOUNT.SET_DEFAULT",
    entity: "BankAccount",
    entityId: account.id,
  });
  return account;
}

export async function deleteBankAccount(id: string, userId: string) {
  const existing = await prisma.bankAccount.findFirst({ where: { id, companyId: COMPANY_ID } });
  if (!existing) throw new ApiError(404, "bank_account.not_found", "Bank account not found");

  await prisma.bankAccount.delete({ where: { id } });
  await writeAudit({
    userId,
    action: "BANK_ACCOUNT.DELETE",
    entity: "BankAccount",
    entityId: id,
    details: JSON.stringify({ bankName: existing.bankName, accountNo: existing.accountNo }),
  });
  return { id, deleted: true };
}
