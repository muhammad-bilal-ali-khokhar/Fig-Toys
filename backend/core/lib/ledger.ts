import { prisma } from "./prisma";
import { ApiError } from "../middleware/error";
import { dateAtZone, DEFAULT_TIMEZONE } from "./time";
import { randomUUID } from "node:crypto";
import type { Prisma } from "../../generated/prisma/client";

type Db = Prisma.TransactionClient | typeof prisma;

export type MoneyAccount = "cash" | "bank";

export const CASH_ACCOUNT_ID = "main";

async function getDefaultDrawerId(db: Db): Promise<string | null> {
  const d = await (db as any).cashDrawer.findFirst({ where: { isDefault: true }, select: { id: true } });
  if (d) return d.id;
  const any = await (db as any).cashDrawer.findFirst({ select: { id: true }, orderBy: { createdAt: "asc" } });
  return any?.id ?? null;
}

// Applies a balance delta to cash or a bank account and records a movement row.
async function adjust(
  db: Db,
  opts: {
    delta: number;
    kind: "IN" | "OUT";
    account: MoneyAccount;
    bankAccountId?: string | null;
    cashDrawerId?: string | null;
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
    let drawerId = opts.cashDrawerId ?? null;
    if (!drawerId) drawerId = await getDefaultDrawerId(db);
    if (drawerId) {
      await (db as any).cashDrawer.update({
        where: { id: drawerId },
        data: { balance: { increment: opts.delta } },
      });
    } else {
      await db.cashAccount.upsert({
        where: { id: CASH_ACCOUNT_ID },
        create: { id: CASH_ACCOUNT_ID, name: "Cash in hand", balance: opts.delta },
        update: { balance: { increment: opts.delta } },
      });
    }
    opts.cashDrawerId = drawerId;
  }
  await db.moneyMovement.create({
    data: {
      date: opts.date ?? new Date(),
      kind: opts.kind,
      amount: Math.abs(opts.delta),
      account: opts.account,
      bankAccountId: opts.account === "bank" ? opts.bankAccountId ?? null : null,
      cashDrawerId: opts.account === "cash" ? (opts.cashDrawerId ?? null) : null,
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
    cashDrawerId?: string | null;
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
    cashDrawerId?: string | null;
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
    fromCashDrawerId?: string | null;
    to: MoneyAccount;
    toBankId?: string | null;
    toCashDrawerId?: string | null;
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
    cashDrawerId: opts.fromCashDrawerId,
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
    cashDrawerId: opts.toCashDrawerId,
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
    if (m.account === "bank" && (m as any).bankAccountId) {
      await db.bankAccount.update({
        where: { id: (m as any).bankAccountId },
        data: { balance: { increment: delta } },
      });
    } else if ((m as any).cashDrawerId) {
      await (db as any).cashDrawer.update({
        where: { id: (m as any).cashDrawerId },
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
  cashDrawerId?: string;
};

type LineItem = { productId: string; total: number };

export async function splitCashByDrawer(
  db: Db,
  payments: PaymentInput[],
  lineItems: LineItem[],
): Promise<void> {
  const cashPayments = payments.filter((p) => p.method === "CASH" && !p.cashDrawerId);
  if (cashPayments.length === 0) return;

  const productIds = [...new Set(lineItems.map((i) => i.productId))];
  if (productIds.length === 0) return;

  const products = await db.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, category: { select: { defaultCashDrawerId: true, parent: { select: { defaultCashDrawerId: true } } } } },
  });
  const productDrawer = new Map(products.map((p) => [p.id, p.category?.defaultCashDrawerId ?? p.category?.parent?.defaultCashDrawerId ?? null]));
  const defaultDrawer = await getDefaultDrawerId(db);

  const drawerAmounts = new Map<string, number>();
  let unassignedTotal = 0;

  for (const item of lineItems) {
    const drawerId = productDrawer.get(item.productId) ?? defaultDrawer;
    if (drawerId) {
      drawerAmounts.set(drawerId, (drawerAmounts.get(drawerId) ?? 0) + item.total);
    } else {
      unassignedTotal += item.total;
    }
  }

  const totalCash = cashPayments.reduce((s, p) => s + p.amount, 0);
  const totalLine = lineItems.reduce((s, i) => s + i.total, 0);

  if (totalLine <= 0) {
    if (defaultDrawer && cashPayments.length > 0) {
      cashPayments[0].cashDrawerId = defaultDrawer;
    }
    return;
  }

  const assigned = [...drawerAmounts.entries()];
  assigned.sort((a, b) => b[1] - a[1]);

  const splitAmounts: { drawerId: string; amount: number }[] = [];
  let accounted = 0;
  for (const [drawerId, drawerTotal] of assigned) {
    const amount = Math.round((drawerTotal / totalLine) * totalCash * 100) / 100;
    splitAmounts.push({ drawerId, amount });
    accounted += amount;
  }

  if (unassignedTotal > 0 && defaultDrawer) {
    const unassignedAmount = Math.round((unassignedTotal / totalLine) * totalCash * 100) / 100;
    const existing = splitAmounts.find((s) => s.drawerId === defaultDrawer);
    if (existing) {
      existing.amount += unassignedAmount;
    } else {
      splitAmounts.push({ drawerId: defaultDrawer, amount: unassignedAmount });
    }
    accounted += unassignedAmount;
  }

  if (splitAmounts.length === 0) {
    return;
  }

  const diff = Math.round((totalCash - accounted) * 100) / 100;
  if (diff !== 0) {
    splitAmounts[0].amount = Math.round((splitAmounts[0].amount + diff) * 100) / 100;
  }

  if (splitAmounts.length === 1) {
    for (const p of cashPayments) {
      p.cashDrawerId = splitAmounts[0].drawerId;
    }
    return;
  }

  const remainder = Math.round(totalCash * 100) / 100;
  let assigned_ = 0;
  for (let i = 0; i < splitAmounts.length; i++) {
    const s = splitAmounts[i];
    if (i === splitAmounts.length - 1) {
      s.amount = Math.round((remainder - assigned_) * 100) / 100;
    }
    assigned_ += s.amount;
  }

  payments.splice(
    payments.indexOf(cashPayments[0]),
    cashPayments.length,
    ...splitAmounts
      .filter((s) => s.amount > 0)
      .map((s) => ({
        method: "CASH" as const,
        amount: s.amount,
        cashDrawerId: s.drawerId,
        reference: cashPayments[0].reference,
        tendered: cashPayments[0].tendered,
      })),
  );
}

const MONEY_NOTES: Record<string, { cash: string; bank: string }> = {
  SALE: { cash: "Sale (cash)", bank: "Sale (bank)" },
  PURCHASE: { cash: "Purchase (cash)", bank: "Purchase (bank)" },
  SALE_RETURN: { cash: "Sale return refund", bank: "Sale return refund" },
  PURCHASE_RETURN: { cash: "Purchase return received", bank: "Purchase return received" },
  REBATE: { cash: "Rebate received", bank: "Rebate received" },
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
        cashDrawerId: (p as any).cashDrawerId ?? null,
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
        await moneyIn(db, { account: "cash", amount: p.amount, cashDrawerId: (p as any).cashDrawerId ?? null, sourceType, sourceId: transactionId, note: notes.cash });
      } else {
        await moneyOut(db, { account: "cash", amount: p.amount, cashDrawerId: (p as any).cashDrawerId ?? null, sourceType, sourceId: transactionId, note: notes.cash });
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

export async function getPendingCardAmount() {
  const [cardReceived, cardReturned, cardSettled] = await Promise.all([
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
  ]);
  const received = Number(cardReceived._sum.amount ?? 0);
  const returned = Number(cardReturned._sum.amount ?? 0);
  const settled = Number(cardSettled._sum.amount ?? 0);
  return Math.max(0, received - returned - settled);
}

export async function getMoneyOverview() {
  const [drawers, cash, banks, pendingCard, credit] = await Promise.all([
    (prisma as any).cashDrawer.findMany({
      where: { active: true },
      select: { id: true, name: true, isDefault: true, balance: true, sortOrder: true },
      orderBy: [{ isDefault: "desc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
    }),
    prisma.cashAccount.findUnique({ where: { id: CASH_ACCOUNT_ID } }),
    prisma.bankAccount.findMany({
      where: { active: true },
      select: { id: true, name: true, bankName: true, accountNo: true, balance: true },
      orderBy: { createdAt: "asc" },
    }),
    getPendingCardAmount(),
    prisma.creditAccount.aggregate({ _sum: { balance: true } }),
  ]);

  const netCredit = Number(credit._sum.balance ?? 0);
  const drawerBalances = drawers.map((d: any) => ({ ...d, balance: Number(d.balance) }));
  const totalDrawer = drawerBalances.reduce((s: number, d: any) => s + d.balance, 0);
  const fallbackCash = Number(cash?.balance ?? 0);
  const cashTotal = drawerBalances.length > 0 ? totalDrawer : fallbackCash;

  return {
    cashBalance: cashTotal,
    cashDrawers: drawerBalances,
    drawers: drawerBalances,
    totalCash: cashTotal,
    totalDrawerBalance: totalDrawer,
    banks: banks.map((b) => ({ ...b, balance: Number(b.balance) })),
    totalBankBalance: banks.reduce((s, b) => s + Number(b.balance), 0),
    pendingCard,
    receivables: Math.max(0, netCredit),
    payables: Math.max(0, -netCredit),
    summary: {
      cash: cashTotal,
      bank: banks.reduce((s, b) => s + Number(b.balance), 0),
      cardPending: pendingCard,
      credit: netCredit,
    },
  };
}

export async function listMoneyMovements({
  account,
  drawerId,
  from,
  to,
  tz,
}: {
  account?: string;
  drawerId?: string;
  from?: string;
  to?: string;
  tz?: string;
}) {
  const timezone = tz ?? DEFAULT_TIMEZONE;
  return prisma.moneyMovement.findMany({
    where: {
      ...(account === "cash" ? { account: "cash" } : account === "bank" ? { account: "bank" } : {}),
      ...(drawerId ? { cashDrawerId: drawerId } : {}),
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
      cashDrawer: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
    },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: 200,
  });
}
