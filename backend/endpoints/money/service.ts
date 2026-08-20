import { prisma } from "../../core/lib/prisma";
import { ApiError } from "../../core/middleware/error";
import { writeAudit } from "../../core/lib/audit";
import {
  getMoneyOverview,
  getPendingCardAmount,
  listMoneyMovements,
  moneyIn,
  moneyOut,
  moneyTransfer,
} from "../../core/lib/ledger";
import { COMPANY_ID } from "../../core/lib/company";
import type { AdjustInput, SettleCardInput, TransferInput } from "./schemas";

async function assertBank(id?: string) {
  if (!id) return;
  const bank = await prisma.bankAccount.findFirst({ where: { id, companyId: COMPANY_ID } });
  if (!bank) throw new ApiError(400, "money.bank_invalid", "Unknown bank account");
}

export async function overview() {
  return getMoneyOverview();
}

export async function movements(opts: { account?: string; from?: string; to?: string; tz?: string }) {
  return listMoneyMovements(opts);
}

export async function settleCard(input: SettleCardInput, userId: string) {
  await assertBank(input.target === "bank" ? input.bankAccountId : undefined);
  if (input.target === "bank" && !input.bankAccountId) {
    throw new ApiError(400, "money.bank_required", "Pick which bank account received the card money");
  }
  const pending = await getPendingCardAmount();
  if (input.amount > pending + 0.001) {
    throw new ApiError(
      400,
      "money.settle_exceeds_pending",
      `Cannot settle more than the pending card amount (Rs ${pending.toLocaleString()})`,
    );
  }
  await moneyIn(prisma, {
    account: input.target,
    amount: input.amount,
    bankAccountId: input.target === "bank" ? input.bankAccountId : null,
    sourceType: "CARD_SETTLEMENT",
    note: input.note || "Card money received",
    date: input.date ? new Date(input.date) : new Date(),
    userId,
  });
  await writeAudit({
    userId,
    action: "MONEY.SETTLE_CARD",
    entity: "Money",
    entityId: userId,
    details: JSON.stringify({ amount: input.amount, target: input.target, bank: input.bankAccountId ?? null }),
  });
  return getMoneyOverview();
}

export async function transfer(input: TransferInput, userId: string) {
  await assertBank(input.from === "bank" ? input.fromBankId : undefined);
  await assertBank(input.to === "bank" ? input.toBankId : undefined);
  if (input.from === "bank" && !input.fromBankId) {
    throw new ApiError(400, "money.bank_required", "Pick the bank account to move money from");
  }
  if (input.to === "bank" && !input.toBankId) {
    throw new ApiError(400, "money.bank_required", "Pick the bank account to move money into");
  }
  await moneyTransfer(prisma, {
    from: input.from,
    fromBankId: input.from === "bank" ? input.fromBankId : null,
    to: input.to,
    toBankId: input.to === "bank" ? input.toBankId : null,
    amount: input.amount,
    note: input.note || "Transfer",
    date: input.date ? new Date(input.date) : new Date(),
    userId,
  });
  await writeAudit({
    userId,
    action: "MONEY.TRANSFER",
    entity: "Money",
    entityId: userId,
    details: JSON.stringify({ amount: input.amount, from: input.from, to: input.to }),
  });
  return getMoneyOverview();
}

export async function adjust(input: AdjustInput, userId: string) {
  await assertBank(input.account === "bank" ? input.bankAccountId : undefined);
  if (input.account === "bank" && !input.bankAccountId) {
    throw new ApiError(400, "money.bank_required", "Pick the bank account to adjust");
  }
  const fn = input.amount > 0 ? moneyIn : moneyOut;
  await fn(prisma, {
    account: input.account,
    amount: Math.abs(input.amount),
    bankAccountId: input.account === "bank" ? input.bankAccountId : null,
    sourceType: "ADJUSTMENT",
    note: input.note || "Balance adjustment",
    date: input.date ? new Date(input.date) : new Date(),
    userId,
  });
  await writeAudit({
    userId,
    action: "MONEY.ADJUST",
    entity: "Money",
    entityId: userId,
    details: JSON.stringify({ account: input.account, amount: input.amount }),
  });
  return getMoneyOverview();
}
