import { prisma } from "../../core/lib/prisma";
import { ApiError } from "../../core/middleware/error";
import { writeAudit } from "../../core/lib/audit";
import type { BankInput } from "./schemas";

export async function listBanks() {
  return prisma.bank.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
}

export async function ensureBank(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const existing = await prisma.bank.findFirst({
    where: { name: { contains: trimmed } },
  });
  if (existing && existing.name.trim().toLowerCase() === trimmed.toLowerCase()) {
    return existing;
  }
  const max = await prisma.bank.aggregate({ _max: { sortOrder: true } });
  return prisma.bank.create({
    data: { name: trimmed, sortOrder: (max._max.sortOrder ?? 0) + 1 },
  });
}

export async function createBank(input: BankInput, userId: string) {
  const existing = await prisma.bank.findFirst({
    where: { name: { contains: input.name.trim() } },
  });
  if (
    existing &&
    existing.name.trim().toLowerCase() === input.name.trim().toLowerCase()
  )
    throw new ApiError(409, "bank.duplicate", "Bank already exists");

  const max = await prisma.bank.aggregate({ _max: { sortOrder: true } });
  const bank = await prisma.bank.create({
    data: { name: input.name, sortOrder: (max._max.sortOrder ?? 0) + 1 },
  });
  await writeAudit({
    userId,
    action: "BANK.CREATE",
    entity: "Bank",
    entityId: bank.id,
    details: JSON.stringify({ name: bank.name }),
  });
  return bank;
}

export async function updateBank(id: string, input: BankInput, userId: string) {
  const existing = await prisma.bank.findUnique({ where: { id } });
  if (!existing) throw new ApiError(404, "bank.not_found", "Bank not found");

  const dup = await prisma.bank.findFirst({
    where: { name: { contains: input.name.trim() }, id: { not: id } },
  });
  if (
    dup &&
    dup.name.trim().toLowerCase() === input.name.trim().toLowerCase()
  )
    throw new ApiError(409, "bank.duplicate", "Bank already exists");

  const bank = await prisma.bank.update({ where: { id }, data: { name: input.name } });
  await writeAudit({
    userId,
    action: "BANK.UPDATE",
    entity: "Bank",
    entityId: bank.id,
    details: JSON.stringify({ name: bank.name }),
  });
  return bank;
}

export async function deleteBank(id: string, userId: string) {
  const existing = await prisma.bank.findUnique({ where: { id } });
  if (!existing) throw new ApiError(404, "bank.not_found", "Bank not found");

  await prisma.bank.delete({ where: { id } });
  await writeAudit({
    userId,
    action: "BANK.DELETE",
    entity: "Bank",
    entityId: id,
    details: JSON.stringify({ name: existing.name }),
  });
  return { id, deleted: true };
}
