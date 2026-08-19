import { prisma } from "./prisma";
import { ApiError } from "../middleware/error";
import { dateAtZone, DEFAULT_TIMEZONE } from "./time";
import { randomUUID } from "node:crypto";
import type { Prisma } from "../../generated/prisma/client";

type Db = Prisma.TransactionClient | typeof prisma;

export type MoneyAccount = "cash" | "bank";

export const CASH_ACCOUNT_ID = "main";

// Applies a balance delta to cash or a bank account and records a movement row.
async function adjust(
  db: Db,
  opts: {
    delta: number;
    kind: "IN" | "OUT";
    account: MoneyAccount;
    bankAccountId?: string | null;
    sourceType: string;
    sourceId?: string | null;
    note?: string | null;
    date?: Date | null;
    userId?: string | null;
  },
) {
  if (opts.account === "bank") {
    if (!opts.bankAccountId) {
      throw new ApiError(400, "money.bank_required", "Pick which bank account");
    }
    await db.bankAccount.update({
      where: { id: opts.bankAccountId },
      data: { balance: { increment: opts.delta } },
    });
  } else {
    await db.cashAccount.upsert({
      where: { id: CASH_ACCOUNT_ID },
      create: { id: CASH_ACCOUNT_ID, name: "Cash in hand", balance: opts.delta },
      update: { balance: { increment: opts.delta } },
    });
  }
  await db.moneyMovement.create({
    data: {
      date: opts.date ?? new Date(),
      kind: opts.kind,
      amount: Math.abs(opts.delta),
      account: opts.account,
      bankAccountId: opts.account === "bank" ? opts.bankAccountId ?? null : null,
      sourceType: opts.sourceType,
      sourceId: opts.sourceId ?? null,
      note: opts.note ?? null,
      createdById: opts.userId ?? null,
    },
  });
}

export async function moneyIn(
  db: Db,
  opts: {
    account: MoneyAccount;
    amount: number;
    bankAccountId?: string | null;
    sourceType: string;
    sourceId?: string | null;
    note?: string | null;
    date?: Date | null;
    userId?: string | null;
  },
) {
  if (opts.amount <= 0) return;
  await adjust(db, { ...opts, delta: opts.amount, kind: "IN" });
}

export async function moneyOut(
  db: Db,
  opts: {
    account: MoneyAccount;
    amount: number;
    bankAccountId?: string | null;
    sourceType: string;
    sourceId?: string | null;
    note?: string | null;
    date?: Date | null;
    userId?: string | null;
  },
) {
  if (opts.amount <= 0) return;
  await adjust(db, { ...opts, delta: -opts.amount, kind: "OUT" });
}

export async function moneyTransfer(
  db: Db,
  opts: {
    from: MoneyAccount;
    fromBankId?: string | null;
    to: MoneyAccount;
    toBankId?: string | null;
    amount: number;
    note?: string | null;
    date?: Date | null;
    userId?: string | null;
  },
) {
  if (opts.amount <= 0) return;
  const sourceId = randomUUID();
  await adjust(db, {
    delta: -opts.amount,
    kind: "OUT",
    account: opts.from,
    bankAccountId: opts.fromBankId,
    sourceType: "TRANSFER",
    sourceId,
    note: opts.note ?? null,
    date: opts.date,
    userId: opts.userId,
  });
  await adjust(db, {
    delta: opts.amount,
    kind: "IN",
    account: opts.to,
    bankAccountId: opts.toBankId,
    sourceType: "TRANSFER",
    sourceId,
    note: opts.note ?? null,
    date: opts.date,
    userId: opts.userId,
  });
}

// Reverses every movement recorded for a source (voided return, reversed voucher,
// edited/deleted expense), undoing the balance effect.
export async function reverseMoney(db: Db, sourceType: string, sourceId: string) {
  const movements = await db.moneyMovement.findMany({ where: { sourceType, sourceId } });
  for (const m of movements) {
    const delta = m.kind === "IN" ? -Number(m.amount) : Number(m.amount);
    if (m.account === "bank" && m.bankAccountId) {
      await db.bankAccount.update({
        where: { id: m.bankAccountId },
        data: { balance: { increment: delta } },
      });
    } else {
      await db.cashAccount.upsert({
        where: { id: CASH_ACCOUNT_ID },
        create: { id: CASH_ACCOUNT_ID, name: "Cash in hand", balance: delta },
        update: { balance: { increment: delta } },
      });
    }
    await db.moneyMovement.delete({ where: { id: m.id } });
  }
}

export type PaymentInput = {
  method: "CASH" | "CARD" | "BANK_TRANSFER" | "CREDIT";
  amount: number;
  tendered?: number;
  reference?: string;
  bankAccountId?: string;
};

const MONEY_NOTES: Record<string, { cash: string; bank: string }> = {
  SALE: { cash: "Sale (cash)", bank: "Sale (bank)" },
  PURCHASE: { cash: "Purchase (cash)", bank: "Purchase (bank)" },
  SALE_RETURN: { cash: "Sale return refund", bank: "Sale return refund" },
  PURCHASE_RETURN: { cash: "Purchase return received", bank: "Purchase return received" },
};

export type ApplyPaymentsOptions = {
  transactionId: string;
  contactId: string;
  payments: PaymentInput[];
  moneySign?: 1 | -1;
  balanceSign?: 1 | -1;
  sourceType: string;
  creditCreate?: boolean;
};

// Records each payment on a transaction and applies its effect: credit moves the
// customer's CreditAccount balance, cash/bank move the money ledger. Movements are
// always keyed to the transaction (sourceType + sourceId) so reverseMoney can undo
// them on edit/void.
export async function applyPayments(db: Db, opts: ApplyPaymentsOptions): Promise<number> {
  const {
    transactionId,
    contactId,
    payments,
    moneySign = 1,
    balanceSign = 1,
    sourceType,
    creditCreate = false,
  } = opts;
  const notes = MONEY_NOTES[sourceType] ?? { cash: sourceType, bank: sourceType };
  let paid = 0;
  for (const p of payments) {
    let tendered: number | undefined;
    let change: number | undefined;
    if (p.method === "CASH" && p.tendered !== undefined) {
      if (p.tendered < p.amount - 0.001) {
        throw new ApiError(400, "payment.tender_short", "Cash received is less than the payment amount");
      }
      tendered = p.tendered;
      change = Math.round((tendered - p.amount) * 100) / 100;
    }
    await db.payment.create({
      data: {
        transactionId,
        method: p.method,
        amount: p.amount,
        ...(tendered !== undefined ? { tendered } : {}),
        ...(change !== undefined ? { change } : {}),
        reference: p.reference,
        bankAccountId: p.bankAccountId,
      },
    });
    paid += p.amount;
    if (p.method === "CREDIT") {
      const balance = { increment: p.amount * balanceSign };
      if (creditCreate) {
        await db.creditAccount.upsert({
          where: { contactId },
          create: { contactId, limit: 0, balance: p.amount * balanceSign },
          update: { balance },
        });
      } else {
        await db.creditAccount.update({ where: { contactId }, data: { balance } });
      }
    } else if (p.method === "CASH") {
      if (moneySign === 1) {
        await moneyIn(db, { account: "cash", amount: p.amount, sourceType, sourceId: transactionId, note: notes.cash });
      } else {
        await moneyOut(db, { account: "cash", amount: p.amount, sourceType, sourceId: transactionId, note: notes.cash });
      }
    } else if (p.method === "BANK_TRANSFER") {
      const bankAccountId = p.bankAccountId ?? undefined;
      if (moneySign === 1) {
        await moneyIn(db, { account: "bank", amount: p.amount, bankAccountId, sourceType, sourceId: transactionId, note: notes.bank });
      } else {
        await moneyOut(db, { account: "bank", amount: p.amount, bankAccountId, sourceType, sourceId: transactionId, note: notes.bank });
      }
    }
  }
  return paid;
}

export async function getMoneyOverview() {
  const [cash, banks, cardReceived, cardReturned, cardSettled, credit] = await Promise.all([
    prisma.cashAccount.findUnique({ where: { id: CASH_ACCOUNT_ID } }),
    prisma.bankAccount.findMany({
      where: { active: true },
      select: { id: true, name: true, bankName: true, accountNo: true, balance: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.payment.aggregate({
      where: { method: "CARD", transaction: { type: "SALE" } },
      _sum: { amount: true },
    }),
    prisma.payment.aggregate({
      where: { method: "CARD", transaction: { type: "SALE_RETURN" } },
      _sum: { amount: true },
    }),
    prisma.moneyMovement.aggregate({
      where: { sourceType: "CARD_SETTLEMENT", kind: "IN" },
      _sum: { amount: true },
    }),
    prisma.creditAccount.aggregate({ _sum: { balance: true } }),
  ]);

  const received = Number(cardReceived._sum.amount ?? 0);
  const returned = Number(cardReturned._sum.amount ?? 0);
  const settled = Number(cardSettled._sum.amount ?? 0);
  const netCredit = Number(credit._sum.balance ?? 0);

  return {
    cashBalance: Number(cash?.balance ?? 0),
    banks: banks.map((b) => ({ ...b, balance: Number(b.balance) })),
    totalBankBalance: banks.reduce((s, b) => s + Number(b.balance), 0),
    pendingCard: Math.max(0, received - returned - settled),
    receivables: Math.max(0, netCredit),
    payables: Math.max(0, -netCredit),
    summary: {
      cash: Number(cash?.balance ?? 0),
      bank: banks.reduce((s, b) => s + Number(b.balance), 0),
      cardPending: Math.max(0, received - returned - settled),
      credit: netCredit,
    },
  };
}

export async function listMoneyMovements({
  account,
  from,
  to,
  tz,
}: {
  account?: string;
  from?: string;
  to?: string;
  tz?: string;
}) {
  const timezone = tz ?? DEFAULT_TIMEZONE;
  return prisma.moneyMovement.findMany({
    where: {
      ...(account === "cash" ? { account: "cash" } : account === "bank" ? { account: "bank" } : {}),
      ...(from || to
        ? {
            date: {
              ...(from ? { gte: dateAtZone(from, "00:00:00", timezone) } : {}),
              ...(to ? { lte: dateAtZone(to, "23:59:59", timezone) } : {}),
            },
          }
        : {}),
    },
    include: {
      bankAccount: { select: { id: true, name: true, bankName: true } },
      createdBy: { select: { id: true, name: true } },
    },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: 200,
  });
}
