import { prisma } from "../../core/lib/prisma";
import { writeAudit } from "../../core/lib/audit";
import type { ResetSection } from "./schemas";

// Sections that must be wiped alongside the selected one so foreign keys hold
// and no orphaned money/stock rows survive a reset.
const DEPENDENCIES: Record<ResetSection, ResetSection[]> = {
  sales: ["reservations", "money"],
  inventory: ["sales", "reservations", "purchaseOrders"],
  contacts: ["sales", "reservations", "purchaseOrders", "money"],
  reservations: [],
  purchaseOrders: [],
  money: [],
  logs: [],
};

export function expandSections(sections: ResetSection[]): ResetSection[] {
  const set = new Set<ResetSection>(sections);
  let changed = true;
  while (changed) {
    changed = false;
    for (const section of [...set]) {
      for (const dep of DEPENDENCIES[section]) {
        if (!set.has(dep)) {
          set.add(dep);
          changed = true;
        }
      }
    }
  }
  return [...set];
}

export async function resetData(sections: ResetSection[], userId: string) {
  const selected = new Set(expandSections(sections));

  const removed = await prisma.$transaction(async (tx) => {
    const counts: Record<string, number> = {};
    const tally = (key: string, n: number) => {
      counts[key] = (counts[key] ?? 0) + n;
    };

    if (selected.has("reservations")) {
      tally("reservationItems", (await tx.reservationItem.deleteMany()).count);
      tally("reservations", (await tx.reservation.deleteMany()).count);
      if (!selected.has("inventory")) {
        await tx.unit.updateMany({
          where: { status: "RESERVED" },
          data: { status: "IN_STOCK" },
        });
      }
    }
    if (selected.has("sales")) {
      tally("transactionItems", (await tx.transactionItem.deleteMany()).count);
      tally("payments", (await tx.payment.deleteMany()).count);
      tally("transactions", (await tx.transaction.deleteMany()).count);
      if (!selected.has("contacts")) {
        await tx.creditAccount.updateMany({ data: { balance: 0 } });
      }
      if (!selected.has("inventory")) {
        await tx.unit.updateMany({
          where: { status: { in: ["SOLD", "OUT"] } },
          data: { status: "IN_STOCK" },
        });
      }
    }
    if (selected.has("purchaseOrders")) {
      tally("purchaseOrderItems", (await tx.purchaseOrderItem.deleteMany()).count);
      tally("purchaseOrders", (await tx.purchaseOrder.deleteMany()).count);
    }
    if (selected.has("money")) {
      tally("moneyMovements", (await tx.moneyMovement.deleteMany()).count);
      tally("vouchers", (await tx.voucher.deleteMany()).count);
      tally("expenses", (await tx.expense.deleteMany()).count);
      tally("cashSessions", (await tx.cashSession.deleteMany()).count);
    }
    if (selected.has("inventory")) {
      tally("stockMovements", (await tx.stockMovement.deleteMany()).count);
      tally("units", (await tx.unit.deleteMany()).count);
      tally("priceHistory", (await tx.productPriceHistory.deleteMany()).count);
      tally("products", (await tx.product.deleteMany()).count);
    }
    if (selected.has("contacts")) {
      tally("creditPayments", (await tx.creditPayment.deleteMany()).count);
      tally("creditAccounts", (await tx.creditAccount.deleteMany()).count);
      tally("contacts", (await tx.contact.deleteMany()).count);
    }
    if (selected.has("logs")) {
      tally("auditLogs", (await tx.auditLog.deleteMany()).count);
      tally("eventLogs", (await tx.eventLog.deleteMany()).count);
      tally("crashReports", (await tx.crashReport.deleteMany()).count);
    }
    if (selected.has("money")) {
      await tx.cashAccount.updateMany({ data: { balance: 0 } });
      await tx.cashDrawer.updateMany({ data: { balance: 0 } });
      await tx.bankAccount.updateMany({ data: { balance: 0 } });
    }

    return counts;
  });

  await writeAudit({
    userId,
    action: "DATA.RESET",
    entity: "Database",
    entityId: "store",
    details: JSON.stringify({ sections: [...selected], removed }),
  });

  return { sections: [...selected], removed };
}
