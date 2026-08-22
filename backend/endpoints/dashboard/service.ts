import { prisma } from "../../core/lib/prisma";
import { dayKeyInTz, dateAtZone } from "../../core/lib/time";
import { hasPermissionList, PERMISSIONS, type Permission } from "../../core/lib/permissions";
import { quantitySign } from "../../core/lib/stock";

const startOfDay = (timeZone: string) => {
  const now = new Date();
  return dateAtZone(dayKeyInTz(now, timeZone), "00:00:00", timeZone);
};
async function loadCategoryMap() {
  const cats = await prisma.category.findMany({ select: { id: true, name: true, parentId: true, type: true } });
  return new Map(cats.map((c) => [c.id, c] as const));
}
function categoryPath(id: string | null, map: Map<string, { id: string; name: string; parentId: string | null; type: string }>): string[] {
  if (!id || !map.has(id)) return [];
  const path: string[] = [];
  let cur: string | null = id;
  const seen = new Set<string>();
  while (cur && map.has(cur) && !seen.has(cur)) {
    seen.add(cur);
    path.unshift(map.get(cur)!.name);
    cur = map.get(cur)!.parentId;
  }
  return path;
}

export type DashboardRange = { from?: string; to?: string };

function rangeWhere(range: DashboardRange, timeZone: string, field: "createdAt" | "date" = "createdAt") {
  const cond: { gte?: Date; lte?: Date } = {};
  if (range.from) cond.gte = dateAtZone(range.from, "00:00:00", timeZone);
  if (range.to) cond.lte = dateAtZone(range.to, "23:59:59", timeZone);
  if (!cond.gte && !cond.lte) return {};
  return { [field]: cond };
}

function buildDayList(from: string, to: string, timeZone: string) {
  const days: { key: string; date: Date }[] = [];
  const cursor = dateAtZone(from, "00:00:00", timeZone);
  const end = dateAtZone(to, "23:59:59", timeZone);
  while (cursor.getTime() <= end.getTime()) {
    days.push({ key: dayKeyInTz(cursor, timeZone), date: new Date(cursor) });
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

export async function overview(
  permissions: readonly Permission[],
  timeZone: string,
  range: DashboardRange = {},
) {
  const today = startOfDay(timeZone);
  const canViewCosts = hasPermissionList(permissions, PERMISSIONS.reportProfit);

  const [
    todaySales,
    allSales,
    todayPurchases,
    allPurchases,
    inStockUnits,
    recentSales,
    todayExpenses,
    rangeExpenses,
    todayCashGroups,
    returnGroups,
    reservationAgg,
    consignmentCount,
    creditAccounts,
    carrierGroups,
    stockUnits,
    salesByUser,
    users,
    rangeSales,
    rangePurchases,
    rangeCashGroups,
    cashAccount,
    bankAccounts,
    cardReceivedAgg,
    cardReturnedAgg,
    cardSettledAgg,
  ] = await Promise.all([
    prisma.transaction.aggregate({
      where: { type: "SALE", createdAt: { gte: today } },
      _count: true,
      _sum: { total: true },
    }),
    prisma.transaction.aggregate({
      where: { type: "SALE" },
      _count: true,
      _sum: { total: true },
    }),
    prisma.transaction.aggregate({
      where: { type: "PURCHASE", createdAt: { gte: today } },
      _count: true,
      _sum: { total: true },
    }),
    prisma.transaction.aggregate({
      where: { type: "PURCHASE" },
      _count: true,
      _sum: { total: true },
    }),
    prisma.unit.groupBy({
      by: ["condition"],
      where: { status: "IN_STOCK" },
      _count: true,
    }),
    prisma.transaction.findMany({
      where: { type: "SALE", ...rangeWhere(range, timeZone) },
      select: {
        createdAt: true,
        total: true,
        items: {
          include: {
            unit: { select: { condition: true, costPrice: true } },
            product: {
              select: {
                brand: { select: { name: true } },
                model: true,
                storage: true,
                category: { select: { id: true, type: true, name: true, parentId: true } },
              },
            },
          },
        },
        payments: { select: { method: true, amount: true } },
      },
    }),
    prisma.expense.aggregate({
      where: { date: { gte: today } },
      _count: true,
      _sum: { amount: true },
    }),
    prisma.expense.findMany({
      where: { ...rangeWhere(range, timeZone, "date") },
      select: { date: true, amount: true },
    }),
    prisma.moneyMovement.groupBy({
      by: ["kind"],
      where: { account: "cash", date: { gte: today } },
      _sum: { amount: true },
    }),
    prisma.transaction.groupBy({
      by: ["type"],
      where: {
        type: { in: ["SALE_RETURN", "PURCHASE_RETURN"] },
        createdAt: { gte: today },
      },
      _count: true,
    }),
    prisma.reservation.aggregate({
      where: { status: "ACTIVE" },
      _count: true,
      _sum: { total: true, advance: true },
    }),
    prisma.reservation.count({ where: { status: "ACTIVE", type: "CONSIGNMENT" } }),
    prisma.creditAccount.findMany({ select: { balance: true } }),
    prisma.unit.groupBy({
      by: ["carrier"],
      where: { status: "IN_STOCK" },
      _count: true,
    }),
    prisma.unit.findMany({
      where: { status: "IN_STOCK" },
      select: { costPrice: true, productId: true, product: { select: { sellPrice: true } } },
    }),
    prisma.transaction.groupBy({
      by: ["userId"],
      where: { type: "SALE", ...rangeWhere(range, timeZone) },
      _count: true,
      _sum: { total: true },
    }),
    prisma.user.findMany({ select: { id: true, name: true } }),
    prisma.transaction.aggregate({
      where: { type: "SALE", ...rangeWhere(range, timeZone) },
      _count: true,
      _sum: { total: true },
    }),
    prisma.transaction.aggregate({
      where: { type: "PURCHASE", ...rangeWhere(range, timeZone) },
      _count: true,
      _sum: { total: true },
    }),
    prisma.moneyMovement.groupBy({
      by: ["kind"],
      where: { account: "cash", ...rangeWhere(range, timeZone, "date") },
      _sum: { amount: true },
    }),
    prisma.cashAccount.findUnique({ where: { id: "main" } }),
    prisma.bankAccount.findMany({
      where: { active: true },
      select: { id: true, name: true, bankName: true, accountNo: true, balance: true },
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
  ]);

  const stockByCondition = inStockUnits.reduce(
    (acc, g) => ({ ...acc, [g.condition]: g._count }),
    { NEW: 0, USED: 0 },
  );

  const expensesAmount = Number(todayExpenses._sum.amount ?? 0);

  let cashIn = 0;
  let cashOut = 0;
  for (const g of todayCashGroups) {
    if (g.kind === "IN") cashIn += Number(g._sum.amount ?? 0);
    else if (g.kind === "OUT") cashOut += Number(g._sum.amount ?? 0);
  }

  const returns = { sale: 0, purchase: 0 };
  for (const g of returnGroups) {
    if (g.type === "SALE_RETURN") returns.sale = g._count;
    else returns.purchase = g._count;
  }

  let rangeCashIn = 0;
  let rangeCashOut = 0;
  for (const g of rangeCashGroups) {
    if (g.kind === "IN") rangeCashIn += Number(g._sum.amount ?? 0);
    else if (g.kind === "OUT") rangeCashOut += Number(g._sum.amount ?? 0);
  }

  const cashOnHand = Number(cashAccount?.balance ?? 0);
  const totalBankBalance = bankAccounts.reduce((s, b) => s + Number(b.balance), 0);
  const bankBalances = bankAccounts.map((b) => ({ ...b, balance: Number(b.balance) }));
  const pendingCard = Math.max(
    0,
    Number(cardReceivedAgg._sum.amount ?? 0) - Number(cardReturnedAgg._sum.amount ?? 0) - Number(cardSettledAgg._sum.amount ?? 0),
  );

  let receivables = 0;
  let payables = 0;
  for (const ca of creditAccounts) {
    const balance = Number(ca.balance);
    if (balance > 0) receivables += balance;
    else payables += -balance;
  }

  const carrierSplit = carrierGroups.reduce(
    (acc, g) => ({ ...acc, [g.carrier]: g._count }),
    { PTA: 0, NON_PTA: 0, SIM_LOCKED: 0 },
  );

  let costValue = stockUnits.reduce((sum, u) => sum + Number(u.costPrice), 0);
  let retailValue = stockUnits.reduce((sum, u) => sum + Number(u.product.sellPrice), 0);

  const accessoryItems = await prisma.transactionItem.findMany({
    where: { unitId: null },
    select: {
      productId: true,
      quantity: true,
      total: true,
      transaction: { select: { type: true } },
    },
  });
  const accessoryByProduct = new Map<string, { qty: number; costTotal: number }>();
  for (const item of accessoryItems) {
    const sign = quantitySign(item.transaction.type);
    let agg = accessoryByProduct.get(item.productId);
    if (!agg) {
      agg = { qty: 0, costTotal: 0 };
      accessoryByProduct.set(item.productId, agg);
    }
    agg.qty += sign * item.quantity;
    agg.costTotal += sign * Number(item.total);
  }
  for (const [pid, agg] of [...accessoryByProduct.entries()]) {
    if (agg.qty <= 0) accessoryByProduct.delete(pid);
  }
  let accessoryQty = 0;
  let accessoryCostTotal = 0;
  let accessoryRetailValue = 0;
  if (accessoryByProduct.size > 0) {
    const accessoryProducts = await prisma.product.findMany({
      where: { id: { in: [...accessoryByProduct.keys()] } },
      select: { id: true, sellPrice: true },
    });
    const sellMap = new Map(accessoryProducts.map((p) => [p.id, Number(p.sellPrice)]));
    for (const [pid, agg] of accessoryByProduct) {
      accessoryQty += agg.qty;
      accessoryCostTotal += agg.costTotal;
      accessoryRetailValue += (sellMap.get(pid) ?? 0) * agg.qty;
    }
    costValue += accessoryCostTotal;
    retailValue += accessoryRetailValue;
  }

  const userMap = new Map(users.map((u) => [u.id, u.name]));
  const topSellers = salesByUser
    .map((g) => ({
      id: g.userId,
      name: userMap.get(g.userId) ?? "—",
      count: g._count,
      revenue: Number(g._sum.total ?? 0),
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 4);

  let profitToday = null;
  let profitRange = null;
  if (canViewCosts) {
    const items = await prisma.transactionItem.findMany({
      where: {
        transaction: { type: "SALE", createdAt: { gte: today } },
        unit: { isNot: null },
      },
      include: { unit: true },
    });
    profitToday = items.reduce((sum, i) => sum + (Number(i.total) - Number(i.unit?.costPrice ?? 0)), 0);
    profitToday -= Number(todayExpenses._sum.amount ?? 0);
    const rangeItems = await prisma.transactionItem.findMany({
      where: {
        transaction: { type: "SALE", ...rangeWhere(range, timeZone) },
        unit: { isNot: null },
      },
      include: { unit: true },
    });
    profitRange = rangeItems.reduce((sum, i) => sum + (Number(i.total) - Number(i.unit?.costPrice ?? 0)), 0);
    profitRange -= rangeExpenses.reduce((sum, e) => sum + Number(e.amount), 0);
  }

  const inStockByProduct = new Map<string, number>();
  for (const u of stockUnits) {
    inStockByProduct.set(u.productId, (inStockByProduct.get(u.productId) ?? 0) + 1);
  }
  for (const [pid, agg] of accessoryByProduct) {
    inStockByProduct.set(pid, (inStockByProduct.get(pid) ?? 0) + agg.qty);
  }
  const lowStockIds = [...inStockByProduct.keys()];
  const thresholds =
    lowStockIds.length > 0
      ? await prisma.product.findMany({
          where: { id: { in: lowStockIds } },
          select: { id: true, lowStockThreshold: true, model: true, storage: true, brand: { select: { name: true } } },
        })
      : [];
  const thresholdMap = new Map(thresholds.map((t) => [t.id, t]));
  const lowStockProducts = [...inStockByProduct.entries()]
    .map(([id, inStock]) => {
      const t = thresholdMap.get(id);
      if (!t || inStock > t.lowStockThreshold) return null;
      return { id, brand: t.brand.name, model: t.model, storage: t.storage, inStock, threshold: t.lowStockThreshold };
    })
    .filter((x): x is NonNullable<typeof x> => !!x)
    .sort((a, b) => a.inStock - b.inStock)
    .slice(0, 5);

  let dayList: { key: string; date: Date }[];
  if (range.from && range.to) {
    dayList = buildDayList(range.from, range.to, timeZone);
  } else if (recentSales.length > 0) {
    let min = new Date(recentSales[0].createdAt);
    let max = new Date(recentSales[0].createdAt);
    for (const s of recentSales) {
      const t = new Date(s.createdAt).getTime();
      if (t < min.getTime()) min = new Date(s.createdAt);
      if (t > max.getTime()) max = new Date(s.createdAt);
    }
    dayList = buildDayList(dayKeyInTz(min, timeZone), dayKeyInTz(max, timeZone), timeZone);
  } else {
    dayList = buildDayList(dayKeyInTz(new Date(), timeZone), dayKeyInTz(new Date(), timeZone), timeZone);
  }

  const dayIndex = new Map(dayList.map((d, i) => [d.key, i]));
  const days = dayList.map((d) => ({
    key: d.key,
    label: d.date.toLocaleDateString("en-PK", { weekday: "short" }),
    revenue: 0,
    count: 0,
  }));

  const expenseByDay = new Map<string, number>();
  for (const e of rangeExpenses) {
    const key = dayKeyInTz(e.date, timeZone);
    expenseByDay.set(key, (expenseByDay.get(key) ?? 0) + Number(e.amount));
  }

  const productMap = new Map<string, { name: string; qty: number; revenue: number }>();
  const paymentSplit: Record<string, number> = { CASH: 0, CARD: 0, BANK_TRANSFER: 0, CREDIT: 0 };
  const profitByDay = new Map<string, number>();
  let newSold = 0;
  let usedSold = 0;
  let phoneSold = 0;
  let accessorySold = 0;
  const soldByRootCategory = new Map<string, number>();
  const soldBySubCategory = new Map<string, number>();
  const catMapForSold = await loadCategoryMap();

  for (const s of recentSales) {
    const idx = dayIndex.get(dayKeyInTz(s.createdAt, timeZone));
    if (idx !== undefined) {
      days[idx].revenue += Number(s.total);
      days[idx].count += 1;
    }
    for (const p of s.payments) {
      paymentSplit[p.method] = (paymentSplit[p.method] ?? 0) + Number(p.amount);
    }
    for (const it of s.items) {
      const path = categoryPath(it.product.category.id, catMapForSold);
      const rootName = path[0] ?? it.product.category.name;
      const leafCat = catMapForSold.get(it.product.category.id);
      const catType = leafCat?.type ?? it.product.category.type;
      soldByRootCategory.set(rootName, (soldByRootCategory.get(rootName) ?? 0) + it.quantity);
      const fullKey = path.join(" › ") || rootName;
      soldBySubCategory.set(fullKey, (soldBySubCategory.get(fullKey) ?? 0) + it.quantity);
      if (catType === "PHONE") phoneSold += it.quantity;
      else accessorySold += it.quantity;
      const name = `${it.product.brand.name} ${it.product.model} ${it.product.storage ?? ""}`.trim();
      const cur = productMap.get(name) ?? { name, qty: 0, revenue: 0 };
      cur.qty += it.quantity;
      cur.revenue += Number(it.total);
      productMap.set(name, cur);
      if (it.unit) {
        if (it.unit.condition === "NEW") newSold += 1;
        else usedSold += 1;
      }
      if (canViewCosts) {
        const key = dayKeyInTz(s.createdAt, timeZone);
        const profit = Number(it.total) - Number(it.unit?.costPrice ?? 0);
        profitByDay.set(key, (profitByDay.get(key) ?? 0) + profit);
      }
    }
  }

  const topProducts = [...productMap.values()].sort((a, b) => b.qty - a.qty).slice(0, 5);

  const profitTrend: (number | null)[] | null = canViewCosts
    ? days.map((day) => {
        const dayProfit = profitByDay.get(day.key) ?? 0;
        return Math.round(dayProfit - (expenseByDay.get(day.key) ?? 0));
      })
    : null;

  const recent = await prisma.transaction.findMany({
    orderBy: { createdAt: "desc" },
    take: 8,
    include: {
      contact: { select: { name: true } },
      user: { select: { name: true } },
    },
  });

  return {
    today: {
      salesCount: todaySales._count,
      revenue: todaySales._sum.total ?? 0,
      profit: profitToday,
      purchasesCount: todayPurchases._count,
      purchasesAmount: todayPurchases._sum.total ?? 0,
      expensesAmount,
      expensesCount: todayExpenses._count,
      cashIn,
      cashOut,
      returns,
    },
    all: {
      salesCount: allSales._count,
      revenue: allSales._sum.total ?? 0,
      purchasesCount: allPurchases._count,
      purchasesAmount: allPurchases._sum.total ?? 0,
    },
    range: {
      salesCount: rangeSales._count,
      revenue: rangeSales._sum.total ?? 0,
      profit: profitRange,
      purchasesCount: rangePurchases._count,
      purchasesAmount: rangePurchases._sum.total ?? 0,
      expensesAmount: rangeExpenses.reduce((sum, e) => sum + Number(e.amount), 0),
      expensesCount: rangeExpenses.length,
      cashIn: rangeCashIn,
      cashOut: rangeCashOut,
    },
    cashOnHand,
    money: {
      cashBalance: cashOnHand,
      totalBankBalance,
      pendingCard,
      banks: bankBalances,
    },
    stock: (() => {
      const phones = stockByCondition.NEW + stockByCondition.USED;
      return { ...stockByCondition, accessories: accessoryQty, phones, total: phones + accessoryQty };
    })(),
    stockValue: {
      cost: canViewCosts ? Math.round(costValue) : null,
      retail: Math.round(retailValue),
    },
    carrierSplit,
    reservations: {
      active: reservationAgg._count,
      total: Number(reservationAgg._sum.total ?? 0),
      advance: Number(reservationAgg._sum.advance ?? 0),
      consignments: consignmentCount,
    },
    credit: { receivables, payables },
    topSellers,
    soldByCategory: { PHONE: phoneSold, ACCESSORY: accessorySold },
    soldByRootCategory: Object.fromEntries(soldByRootCategory),
    soldBySubCategory: Object.fromEntries(soldBySubCategory),
    lowStock: lowStockProducts,
    salesTrend: days,
    topProducts,
    paymentSplit,
    newUsedSold: { NEW: newSold, USED: usedSold },
    profitTrend,
    recent,
  };
}

export async function activityLog(limit: number) {
  return prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { user: { select: { name: true, username: true } } },
  });
}

export async function widgets(userId: string) {
  return prisma.dashboardWidget.findMany({
    where: { userId },
    orderBy: { order: "asc" },
    select: { id: true, key: true, layout: true, settings: true, order: true },
  });
}

export async function saveWidgets(
  userId: string,
  list: { key: string; order: number; layout?: string; settings?: string }[],
) {
  await prisma.$transaction(async (tx) => {
    await tx.dashboardWidget.deleteMany({ where: { userId } });
    if (list.length > 0) {
      await tx.dashboardWidget.createMany({
        data: list.map((w) => ({
          userId,
          key: w.key,
          order: w.order,
          layout: w.layout ?? "",
          settings: w.settings ?? "{}",
        })),
      });
    }
  });
  return widgets(userId);
}
