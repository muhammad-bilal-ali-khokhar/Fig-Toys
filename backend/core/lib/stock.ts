import { prisma } from "./prisma";
import type { Prisma } from "../../generated/prisma/client";
import type { StockMovementType, UnitCondition, UnitStatus, UnitSource } from "../../generated/prisma/enums";

type Db = Prisma.TransactionClient | typeof prisma;

// Direction a transaction type moves available stock: purchases add, sales remove,
// purchase returns remove, sale returns add back.
export function quantitySign(type: string): number {
  switch (type) {
    case "PURCHASE":
      return 1;
    case "SALE":
      return -1;
    case "PURCHASE_RETURN":
      return -1;
    case "SALE_RETURN":
      return 1;
    default:
      return 0;
  }
}

// Net units in stock for a product across all transactions.
export async function availableQuantity(
  db: Db,
  productId: string,
  opts: { units?: boolean } = {},
): Promise<number> {
  const items = await db.transactionItem.findMany({
    where: { productId, ...(opts.units === false ? { unitId: null } : {}) },
    select: { quantity: true, transaction: { select: { type: true } } },
  });
  let available = 0;
  for (const si of items) {
    available += quantitySign(si.transaction.type) * si.quantity;
  }
  return available;
}

export type SetUnitStatusOptions = {
  unitId: string;
  productId?: string;
  status: UnitStatus;
  source?: UnitSource;
  condition?: UnitCondition;
  returnedFromSource?: UnitSource | null;
  movementType?: StockMovementType;
  note?: string;
};

// Updates a unit's status (and optional source/condition) and records the matching
// stock movement in one step.
export async function setUnitStatus(db: Db, opts: SetUnitStatusOptions) {
  const unit = await db.unit.update({
    where: { id: opts.unitId },
    data: {
      status: opts.status,
      ...(opts.source !== undefined ? { source: opts.source } : {}),
      ...(opts.condition !== undefined ? { condition: opts.condition } : {}),
      ...(opts.returnedFromSource !== undefined ? { returnedFromSource: opts.returnedFromSource } : {}),
    },
  });
  if (opts.movementType) {
    await db.stockMovement.create({
      data: {
        unitId: opts.unitId,
        productId: opts.productId ?? unit.productId,
        type: opts.movementType,
        qty: 1,
        note: opts.note ?? null,
      },
    });
  }
  return unit;
}

export type RemoveMovementsOptions = {
  unitId?: string;
  productId?: string;
  type?: StockMovementType;
  note?: string;
  excludeUnits?: boolean;
};

// Deletes stock movements matching the filter. Pass excludeUnits to match only
// quantity-based (unitId null) movements.
export async function removeMovements(db: Db, opts: RemoveMovementsOptions) {
  const where: Prisma.StockMovementWhereInput = {};
  if (opts.unitId) where.unitId = opts.unitId;
  if (opts.productId) where.productId = opts.productId;
  if (opts.type) where.type = opts.type;
  if (opts.note) where.note = opts.note;
  if (opts.excludeUnits) where.unitId = null;
  await db.stockMovement.deleteMany({ where });
}