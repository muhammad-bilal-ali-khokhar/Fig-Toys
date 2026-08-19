import { prisma } from "../../core/lib/prisma";
import { quantitySign } from "../../core/lib/stock";
import { listUnits } from "../unit/service";

const n = (v: unknown) => Number(v ?? 0);
const round = (v: number) => Math.round(v * 100) / 100;

export async function listInventory(canViewCosts = false) {
  const [units, items] = await Promise.all([
    listUnits({}),
    prisma.transactionItem.findMany({
      where: { unitId: null },
      select: {
        productId: true,
        quantity: true,
        transaction: {
          select: {
            type: true,
            createdAt: true,
            contact: { select: { name: true } },
          },
        },
      },
    }),
  ]);

  const byProduct = new Map<string, { qty: number; lastPurchase: { at: Date; vendor: string } | null }>();

  for (const item of items) {
    const type = item.transaction.type;
    const sign = quantitySign(type);
    let agg = byProduct.get(item.productId);
    if (!agg) {
      agg = { qty: 0, lastPurchase: null };
      byProduct.set(item.productId, agg);
    }
    agg.qty += sign * item.quantity;
    if (type === "PURCHASE") {
      const at = new Date(item.transaction.createdAt);
      if (!agg.lastPurchase || at > agg.lastPurchase.at) {
        agg.lastPurchase = { at, vendor: item.transaction.contact.name };
      }
    }
  }

  const ids = [...byProduct.keys()];
  const products =
    ids.length > 0
      ? await prisma.product.findMany({
          where: { id: { in: ids } },
          select: {
            id: true,
            model: true,
            storage: true,
            barcode: true,
            sellPrice: true,
            retailPrice: true,
            costPrice: true,
            brand: { select: { name: true } },
            color: { select: { name: true } },
            category: { select: { name: true } },
          },
        })
      : [];

  const quantityProducts = products
    .map((p) => {
      const agg = byProduct.get(p.id)!;
      return {
        id: p.id,
        brand: p.brand.name,
        model: p.model,
        storage: p.storage,
        color: p.color?.name ?? null,
        category: p.category.name,
        barcode: p.barcode,
        sellPrice: p.sellPrice,
        retailPrice: p.retailPrice,
        costPrice: p.costPrice,
        qty: agg.qty,
        lastPurchasedAt: agg.lastPurchase?.at.toISOString() ?? null,
        lastVendor: agg.lastPurchase?.vendor ?? null,
      };
    })
    .filter((p) => p.qty > 0);

  const inStockByProduct = new Map<string, number>();
  for (const u of units) {
    if (u.status !== "IN_STOCK") continue;
    inStockByProduct.set(u.product.id, (inStockByProduct.get(u.product.id) ?? 0) + 1);
  }
  for (const p of quantityProducts) {
    inStockByProduct.set(p.id, (inStockByProduct.get(p.id) ?? 0) + p.qty);
  }

  const productIds = [...inStockByProduct.keys()];
  const thresholds =
    productIds.length > 0
      ? await prisma.product.findMany({
          where: { id: { in: productIds } },
          select: {
            id: true,
            lowStockThreshold: true,
            model: true,
            storage: true,
            brand: { select: { name: true } },
          },
        })
      : [];
  const thresholdMap = new Map(thresholds.map((t) => [t.id, t]));

  const lowStock = [...inStockByProduct.entries()]
    .map(([id, inStock]) => {
      const t = thresholdMap.get(id);
      if (!t || inStock > t.lowStockThreshold) return null;
      return {
        id,
        brand: t.brand.name,
        model: t.model,
        storage: t.storage,
        inStock,
        threshold: t.lowStockThreshold,
      };
    })
    .filter((x): x is NonNullable<typeof x> => !!x)
    .sort((a, b) => a.inStock - b.inStock);

  let costValue = 0;
  let retailValue = 0;
  const condMap = new Map<string, { condition: string; units: number; costValue: number; retailValue: number }>();
  for (const u of units) {
    if (u.status !== "IN_STOCK") continue;
    const cost = n(u.costPrice);
    const retail = n(u.product.sellPrice);
    costValue += cost;
    retailValue += retail;
    const cur = condMap.get(u.condition) ?? { condition: u.condition, units: 0, costValue: 0, retailValue: 0 };
    cur.units += 1;
    cur.costValue += cost;
    cur.retailValue += retail;
    condMap.set(u.condition, cur);
  }
  for (const p of quantityProducts) {
    costValue += n(p.costPrice) * p.qty;
    retailValue += n(p.sellPrice) * p.qty;
  }

  return {
    units,
    products: quantityProducts,
    lowStock,
    valuation: {
      costValue: canViewCosts ? round(costValue) : null,
      retailValue: round(retailValue),
      potentialProfit: canViewCosts ? round(retailValue - costValue) : null,
    },
    byCondition: [...condMap.values()]
      .map((c) => ({ ...c, costValue: canViewCosts ? round(c.costValue) : null, retailValue: round(c.retailValue) }))
      .sort((a, b) => b.units - a.units),
  };
}
