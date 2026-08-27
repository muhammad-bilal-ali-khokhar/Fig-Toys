import { prisma } from "../../core/lib/prisma";
import { ApiError } from "../../core/middleware/error";
import { writeAudit } from "../../core/lib/audit";
import { nextNumber } from "../../core/lib/numbering";
import { COMPANY_ID } from "../../core/lib/company";
import { moneyIn, moneyOut, reverseMoney } from "../../core/lib/ledger";
import type { Prisma } from "../../generated/prisma/client";
import type { VoucherInput, VoucherUpdateInput, VoucherType } from "./schemas";

const PREFIX: Record<VoucherType, string> = {
  RECEIVING: "CRV",
  PAYMENT: "CPV",
};

const include = {
  contact: { select: { id: true, name: true, phone: true } },
  bankAccount: { select: { id: true, name: true, bankName: true, accountNo: true } },
  user: { select: { id: true, name: true } },
  reversedBy: { select: { id: true, name: true } },
};

type Db = Prisma.TransactionClient | typeof prisma;

async function nextVoucherNumber(type: VoucherType) {
  const prefix = PREFIX[type];
  return nextNumber(
    () => prisma.voucher.findMany({ where: { number: { startsWith: `${prefix}-` } }, select: { number: true } }),
    prefix,
  );
}

async function assertBank(input: { bankAccountId?: string | null; method?: string }) {
  if (input.method === "BANK_TRANSFER" && !input.bankAccountId) {
    throw new ApiError(400, "voucher.bank_required", "Pick which bank the money went to/from");
  }
  if (input.bankAccountId) {
    const bank = await prisma.bankAccount.findFirst({
      where: { id: input.bankAccountId, companyId: COMPANY_ID },
    });
    if (!bank) throw new ApiError(400, "voucher.bank_invalid", "Unknown bank account");
  }
}

async function assertContact(contactId?: string | null) {
  if (!contactId) return;
  const contact = await prisma.contact.findUnique({ where: { id: contactId } });
  if (!contact) throw new ApiError(400, "voucher.contact_invalid", "Unknown contact");
}

// CRV (cash in from a contact) reduces what they owe us; CPV (cash out to them) increases it.
// sign: 1 = apply the voucher, -1 = undo it (reverse / modify).
function deltaFor(type: VoucherType, amount: number, sign: 1 | -1) {
  const base = type === "RECEIVING" ? -1 : 1;
  return amount * base * sign;
}

async function applyBalance(db: Db, contactId: string, delta: number) {
  await db.creditAccount.upsert({
    where: { contactId },
    create: { contactId, limit: 0, balance: delta },
    update: { balance: { increment: delta } },
  });
}

// A CARD-method voucher records card money settling into a bank account (or cash).
function moneySourceType(method: string) {
  return method === "CARD" ? "CARD_SETTLEMENT" : "VOUCHER";
}

async function applyVoucherMoney(
  db: Db,
  v: {
    id: string;
    type: VoucherType;
    method: string;
    amount: number;
    bankAccountId?: string | null;
    cashDrawerId?: string | null;
    date: Date;
    narration?: string | null;
    userId: string;
  },
) {
  const isIn = v.type === "RECEIVING";
  const bankAccountId =
    v.method === "BANK_TRANSFER" || (v.method === "CARD" && v.bankAccountId)
      ? v.bankAccountId ?? undefined
      : undefined;
  const opts = {
    account: (bankAccountId ? "bank" : "cash") as "bank" | "cash",
    amount: v.amount,
    bankAccountId,
    cashDrawerId: v.cashDrawerId ?? undefined,
    sourceType: moneySourceType(v.method),
    sourceId: v.id,
    note: v.narration || undefined,
    date: v.date,
    userId: v.userId,
  };
  if (isIn) await moneyIn(db, opts);
  else await moneyOut(db, opts);
}

export async function listVouchers(filters: { type?: string; status?: string }) {
  return prisma.voucher.findMany({
    where: {
      ...(filters.type ? { type: filters.type as VoucherType } : {}),
      ...(filters.status ? { status: filters.status as "ACTIVE" | "REVERSED" } : {}),
    },
    include,
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });
}

export async function getVoucher(id: string) {
  const voucher = await prisma.voucher.findUnique({ where: { id }, include });
  if (!voucher) throw new ApiError(404, "voucher.not_found", "Voucher not found");
  return voucher;
}

export async function createVoucher(input: VoucherInput, userId: string) {
  await assertBank(input);
  await assertContact(input.contactId);

  if (input.clientRef) {
    const existing = await prisma.voucher.findUnique({ where: { clientRef: input.clientRef } });
    if (existing) return existing;
  }

  const number = await nextVoucherNumber(input.type);
  const voucher = await prisma.$transaction(async (tx) => {
    const created = await tx.voucher.create({
      data: {
        type: input.type,
        number,
        amount: input.amount,
        method: input.method,
        bankAccountId: input.bankAccountId || null,
        cashDrawerId: input.cashDrawerId || null,
        contactId: input.contactId,
        ...(input.clientRef ? { clientRef: input.clientRef } : {}),
        narration: input.narration || null,
        date: input.date ? new Date(input.date) : new Date(),
        userId,
      },
      include,
    });
    await applyBalance(tx, input.contactId, deltaFor(input.type, input.amount, 1));
    await applyVoucherMoney(tx, {
      id: created.id,
      type: created.type,
      method: created.method,
      amount: Number(created.amount),
      bankAccountId: created.bankAccountId,
      cashDrawerId: created.cashDrawerId,
      date: created.date,
      narration: created.narration,
      userId,
    });
    return created;
  });
  await writeAudit({
    userId,
    action: "VOUCHER.CREATE",
    entity: "Voucher",
    entityId: voucher.id,
    details: JSON.stringify({ number, type: voucher.type, amount: String(voucher.amount) }),
  });
  return voucher;
}

export async function updateVoucher(id: string, input: VoucherUpdateInput, userId: string) {
  const existing = await prisma.voucher.findUnique({ where: { id } });
  if (!existing) throw new ApiError(404, "voucher.not_found", "Voucher not found");
  if (existing.status !== "ACTIVE") {
    throw new ApiError(409, "voucher.reversed", "Reversed vouchers cannot be modified");
  }

  await assertBank(input);
  const nextContactId = input.contactId ?? existing.contactId;
  await assertContact(nextContactId);

  const nextType = input.type ?? existing.type;
  const nextAmount = input.amount ?? Number(existing.amount);

  const voucher = await prisma.$transaction(async (tx) => {
    await applyBalance(tx, existing.contactId!, deltaFor(existing.type, Number(existing.amount), -1));
    await applyBalance(tx, nextContactId!, deltaFor(nextType, nextAmount, 1));
    await reverseMoney(tx, moneySourceType(existing.method), id);

    const updated = await tx.voucher.update({
      where: { id },
      data: {
        ...(input.type !== undefined ? { type: input.type } : {}),
        ...(input.amount !== undefined ? { amount: input.amount } : {}),
        ...(input.method !== undefined ? { method: input.method } : {}),
        ...(input.bankAccountId !== undefined ? { bankAccountId: input.bankAccountId || null } : {}),
        ...(input.cashDrawerId !== undefined ? { cashDrawerId: input.cashDrawerId || null } : {}),
        ...(input.contactId !== undefined ? { contactId: input.contactId } : {}),
        ...(input.narration !== undefined ? { narration: input.narration || null } : {}),
        ...(input.date !== undefined && input.date ? { date: new Date(input.date) } : {}),
      },
      include,
    });
    await applyVoucherMoney(tx, {
      id: updated.id,
      type: updated.type,
      method: updated.method,
      amount: Number(updated.amount),
      bankAccountId: updated.bankAccountId,
      cashDrawerId: updated.cashDrawerId,
      date: updated.date,
      narration: updated.narration,
      userId,
    });
    return updated;
  });
  await writeAudit({
    userId,
    action: "VOUCHER.UPDATE",
    entity: "Voucher",
    entityId: voucher.id,
    details: JSON.stringify({ number: voucher.number }),
  });
  return voucher;
}

export async function restoreVoucher(id: string, userId: string) {
  const existing = await prisma.voucher.findUnique({ where: { id } });
  if (!existing) throw new ApiError(404, "voucher.not_found", "Voucher not found");
  if (existing.status !== "REVERSED") {
    throw new ApiError(409, "voucher.not_reversed", "This voucher is not reversed");
  }

  const voucher = await prisma.$transaction(async (tx) => {
    const restored = await tx.voucher.update({
      where: { id },
      data: { status: "ACTIVE", reversedById: null, reversedAt: null, reversalNote: null },
      include,
    });
    await applyBalance(tx, existing.contactId!, deltaFor(existing.type, Number(existing.amount), 1));
    await applyVoucherMoney(tx, {
      id: restored.id,
      type: restored.type,
      method: restored.method,
      amount: Number(restored.amount),
      bankAccountId: restored.bankAccountId,
      cashDrawerId: restored.cashDrawerId,
      date: restored.date,
      narration: restored.narration,
      userId,
    });
    return restored;
  });
  await writeAudit({
    userId,
    action: "VOUCHER.RESTORE",
    entity: "Voucher",
    entityId: voucher.id,
    details: JSON.stringify({ number: voucher.number }),
  });
  return voucher;
}

export async function reverseVoucher(id: string, note: string | null | undefined, userId: string) {
  const existing = await prisma.voucher.findUnique({ where: { id } });
  if (!existing) throw new ApiError(404, "voucher.not_found", "Voucher not found");
  if (existing.status !== "ACTIVE") {
    throw new ApiError(409, "voucher.already_reversed", "This voucher is already reversed");
  }

  const voucher = await prisma.$transaction(async (tx) => {
    const reversed = await tx.voucher.update({
      where: { id },
      data: { status: "REVERSED", reversedById: userId, reversedAt: new Date(), reversalNote: note || null },
      include,
    });
    await applyBalance(tx, existing.contactId!, deltaFor(existing.type, Number(existing.amount), -1));
    await reverseMoney(tx, moneySourceType(existing.method), id);
    return reversed;
  });
  await writeAudit({
    userId,
    action: "VOUCHER.REVERSE",
    entity: "Voucher",
    entityId: voucher.id,
    details: JSON.stringify({ number: voucher.number }),
  });
  return voucher;
}
