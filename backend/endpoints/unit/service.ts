import { prisma } from "../../core/lib/prisma";
import { ApiError } from "../../core/middleware/error";
import { writeAudit } from "../../core/lib/audit";
import { dateAtZone, DEFAULT_TIMEZONE } from "../../core/lib/time";
import type { Prisma, UnitCondition, UnitStatus } from "../../generated/prisma/client";
import type { AdjustInput, ImportUnitInput, UnitInput, UnitUpdateInput } from "./schemas";

const IN_STOCK = "IN_STOCK";

export async function listUnits({
  condition,
  status,
  q,
}: {
  condition?: string;
  status?: string;
  q?: string;
}) {
  const where: Prisma.UnitWhereInput = {
    ...(condition ? { condition: condition as UnitCondition } : {}),
    ...(status ? { status: status as UnitStatus } : {}),
    ...(q
      ? {
          OR: [
            { imei: { contains: q } },
            { product: { brand: { name: { contains: q } } } },
            { product: { model: { contains: q } } },
          ],
        }
      : {}),
  };

  const units = await prisma.unit.findMany({
    where,
    orderBy: [{ status: "asc" }, { acquiredAt: "desc" }],
    include: {
      product: { select: { id: true, brand: { select: { name: true } }, model: true, storage: true, screenSize: true, color: { select: { name: true } }, category: { select: { id: true, name: true, parent: { select: { name: true } } } }, sellPrice: true, retailPrice: true } },
      items: {
        select: {
          transactionId: true,
          transaction: {
            select: {
              id: true,
              number: true,
              type: true,
              createdAt: true,
              contact: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { id: "asc" },
      },
    },
  });

  return units.map((u) => {
    const purchaseItem = u.items.find((it) => it.transaction.type === "PURCHASE");
    const saleItem = u.items.find((it) => it.transaction.type === "SALE");
    return {
      id: u.id,
      imei: u.imei,
      condition: u.condition,
      status: u.status,
      source: u.source,
      carrier: u.carrier,
      batteryHealth: u.batteryHealth,
      grade: u.grade,
      costPrice: u.costPrice,
      acquiredAt: u.acquiredAt,
      product: {
        ...u.product,
        brand: u.product.brand.name,
        color: u.product.color?.name ?? null,
        category: u.product.category?.name ?? null,
        parentCategory: u.product.category?.parent?.name ?? null,
      },
      purchase: purchaseItem
        ? {
            id: purchaseItem.transaction.id,
            invoice: purchaseItem.transaction.number,
            date: purchaseItem.transaction.createdAt,
            vendor: purchaseItem.transaction.contact.name,
          }
        : null,
      lastSoldIn: saleItem?.transactionId ?? null,
    };
  });
}

export async function getUnitByImei(imei: string) {
  const unit = await prisma.unit.findUnique({
    where: { imei },
    include: {
      product: { include: { brand: true, color: true } },
      movements: { orderBy: { createdAt: "desc" } },
      items: { include: { transaction: { include: { contact: true, user: true } } }, orderBy: { id: "asc" } },
    },
  });
  if (!unit) throw new ApiError(404, "unit.not_found", "No unit found with that IMEI");
  return {
    ...unit,
    product: {
      ...unit.product,
      brand: unit.product.brand.name,
      color: unit.product.color?.name ?? null,
    },
  };
}

export async function getReturnEligibility(imei: string, contactId?: string) {
  const unit = await prisma.unit.findUnique({
    where: { imei },
    include: {
      product: { select: { id: true, brand: { select: { name: true } }, model: true, storage: true, ram: true, screenSize: true, color: { select: { name: true } } } },
      items: {
        where: { transaction: { type: "PURCHASE" } },
        select: { transaction: { select: { id: true, number: true, contactId: true, contact: { select: { id: true, name: true } } } } },
        orderBy: { id: "asc" },
        take: 1,
      },
    },
  });
  if (!unit) {
    return { eligible: false, code: "unit.not_found", reason: "No unit found with that IMEI" };
  }
  const purchase = unit.items[0]?.transaction;
  if (contactId && (!purchase || purchase.contactId !== contactId)) {
    return { eligible: false, code: "unit.not_from_contact", reason: "This unit wasn't bought from this contact" };
  }
  if (!purchase) {
    return { eligible: false, code: "unit.no_purchase", reason: "No purchase record found for this unit" };
  }
  if (unit.status !== "IN_STOCK") {
    return { eligible: false, code: "unit.not_in_stock", reason: "This unit is not in stock" };
  }
  return {
    eligible: true,
    unit: {
      id: unit.id,
      imei: unit.imei,
      condition: unit.condition,
      status: unit.status,
      source: unit.source,
      carrier: unit.carrier,
      batteryHealth: unit.batteryHealth,
      grade: unit.grade,
      costPrice: unit.costPrice,
      acquiredAt: unit.acquiredAt,
      product: {
        ...unit.product,
        brand: unit.product.brand.name,
        color: unit.product.color?.name ?? null,
      },
    },
    purchaseId: purchase.id,
    purchaseNumber: purchase.number,
    contact: purchase.contact,
  };
}

export async function getSaleReturnEligibility(imei: string) {
  const unit = await prisma.unit.findUnique({
    where: { imei },
    include: {
      product: { select: { id: true, brand: { select: { name: true } }, model: true, storage: true, ram: true, screenSize: true, color: { select: { name: true } } } },
      items: {
        where: { transaction: { type: "SALE" } },
        select: {
          unitPrice: true,
          discount: true,
          transaction: { select: { id: true, number: true, contactId: true, contact: { select: { id: true, name: true } } } },
        },
        orderBy: { id: "asc" },
        take: 1,
      },
    },
  });
  if (!unit) {
    return { eligible: false, code: "unit.not_found", reason: "No unit found with that IMEI" };
  }
  if (unit.status !== "SOLD") {
    return { eligible: false, code: "unit.not_sold", reason: "This unit is not sold" };
  }
  const sale = unit.items[0]?.transaction;
  const saleItem = unit.items[0];
  if (!sale) {
    return { eligible: false, code: "unit.no_sale", reason: "No sale record found for this unit" };
  }
  return {
    eligible: true,
    refund: saleItem ? Number(saleItem.unitPrice) - Number(saleItem.discount) : 0,
    unit: {
      id: unit.id,
      imei: unit.imei,
      condition: unit.condition,
      status: unit.status,
      source: unit.source,
      carrier: unit.carrier,
      batteryHealth: unit.batteryHealth,
      grade: unit.grade,
      acquiredAt: unit.acquiredAt,
      product: {
        ...unit.product,
        brand: unit.product.brand.name,
        color: unit.product.color?.name ?? null,
      },
    },
    saleId: sale.id,
    saleNumber: sale.number,
    contact: sale.contact,
  };
}

export async function listMovements({
  limit,
  from,
  to,
  tz,
}: {
  limit?: number;
  from?: string;
  to?: string;
  tz?: string;
}) {
  const timezone = tz ?? DEFAULT_TIMEZONE;
  const dateFilter: { gte?: Date; lte?: Date } = {};
  if (from) dateFilter.gte = dateAtZone(from, "00:00:00", timezone);
  if (to) dateFilter.lte = dateAtZone(to, "23:59:59", timezone);
  const movements = await prisma.stockMovement.findMany({
    where: dateFilter.gte || dateFilter.lte ? { createdAt: dateFilter } : undefined,
    orderBy: { createdAt: "desc" },
    take: limit ?? 100,
    include: {
      unit: { select: { id: true, imei: true, condition: true, status: true } },
      product: { select: { id: true, brand: { select: { name: true } }, model: true, storage: true } },
    },
  });
  return movements.map((m) => ({
    ...m,
    product: m.product ? { ...m.product, brand: m.product.brand.name } : null,
  }));
}

export async function getUnit(id: string) {
  const unit = await prisma.unit.findUnique({
    where: { id },
    include: {
      product: { include: { brand: true, color: true } },
      movements: { orderBy: { createdAt: "desc" } },
      items: { include: { transaction: { include: { contact: true, user: true } } }, orderBy: { id: "asc" } },
    },
  });
  if (!unit) throw new ApiError(404, "unit.not_found", "Unit not found");
  return {
    ...unit,
    product: {
      ...unit.product,
      brand: unit.product.brand.name,
      color: unit.product.color?.name ?? null,
    },
  };
}

export async function adjustUnit(input: AdjustInput, userId: string) {
  const unit = await prisma.unit.findUnique({ where: { id: input.unitId } });
  if (!unit) throw new ApiError(404, "unit.not_found", "Unit not found");
  if (unit.status === "SOLD") {
    throw new ApiError(400, "unit.sold", "Sold units cannot be adjusted");
  }

  const updated = await prisma.unit.update({
    where: { id: unit.id },
    data: { status: input.status },
  });

  await prisma.stockMovement.create({
    data: {
      unitId: unit.id,
      productId: unit.productId,
      type: input.status === IN_STOCK ? "RELEASED" : "ADJUST",
      qty: 1,
      note: input.note ?? `Status changed to ${input.status}`,
    },
  });

  await writeAudit({
    userId,
    action: "UNIT.ADJUST",
    entity: "Unit",
    entityId: unit.id,
    details: JSON.stringify({ from: unit.status, to: input.status, note: input.note }),
  });

  return updated;
}

export async function createUnit(input: UnitInput, userId: string) {
  const existing = await prisma.unit.findUnique({ where: { imei: input.imei } });
  if (existing) throw new ApiError(409, "unit.imei_exists", "A unit with that IMEI already exists");

  const product = await prisma.product.findUnique({ where: { id: input.productId } });
  if (!product) throw new ApiError(404, "product.not_found", "Product not found");

  const unit = await prisma.unit.create({
    data: {
      productId: input.productId,
      imei: input.imei,
      condition: input.condition,
      status: input.status,
      source: input.source,
      carrier: input.carrier,
      batteryHealth: input.batteryHealth ?? null,
      grade: input.grade || null,
      costPrice: input.costPrice,
      acquiredAt: input.acquiredAt ? new Date(input.acquiredAt) : undefined,
    },
  });

  await prisma.stockMovement.create({
    data: { unitId: unit.id, productId: unit.productId, type: "IN", note: "Added manually" },
  });

  await writeAudit({
    userId,
    action: "UNIT.CREATE",
    entity: "Unit",
    entityId: unit.id,
    details: JSON.stringify({ imei: unit.imei }),
  });

  return unit;
}

export async function updateUnit(id: string, input: UnitUpdateInput, userId: string) {
  const existing = await prisma.unit.findUnique({ where: { id } });
  if (!existing) throw new ApiError(404, "unit.not_found", "Unit not found");

  if (input.imei && input.imei !== existing.imei) {
    const dup = await prisma.unit.findUnique({ where: { imei: input.imei } });
    if (dup) throw new ApiError(409, "unit.imei_exists", "A unit with that IMEI already exists");
  }

  const unit = await prisma.unit.update({
    where: { id },
    data: {
      imei: input.imei,
      condition: input.condition,
      carrier: input.carrier,
      batteryHealth: input.batteryHealth,
      grade: input.grade,
      costPrice: input.costPrice,
      acquiredAt: input.acquiredAt ? new Date(input.acquiredAt) : undefined,
    },
  });

  await writeAudit({
    userId,
    action: "UNIT.UPDATE",
    entity: "Unit",
    entityId: unit.id,
    details: JSON.stringify({ from: existing.status, to: unit.status }),
  });

  return unit;
}

export async function bulkDeleteUnits(ids: string[], userId: string) {
  const units = await prisma.unit.findMany({
    where: { id: { in: ids } },
    include: { _count: { select: { items: true } } },
  });

  const deletable = units
    .filter((u) => u._count.items === 0)
    .map((u) => u.id);
  const blocked = units
    .filter((u) => u._count.items > 0)
    .map((u) => ({ id: u.id, imei: u.imei }));

  if (deletable.length > 0) {
    await prisma.unit.deleteMany({ where: { id: { in: deletable } } });
  }

  await writeAudit({
    userId,
    action: "UNIT.DELETE",
    entity: "Unit",
    entityId: deletable.join(","),
    details: JSON.stringify({ deleted: deletable.length, blocked: blocked.length }),
  });

  return { deleted: deletable.length, blocked };
}

export async function importUnits(rows: ImportUnitInput[], userId: string) {
  const created: { imei: string; product: string }[] = [];
  const skipped: { imei: string; reason: string }[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    try {
      const brand = await prisma.brand.findFirst({ where: { name: row.brand } });
      if (!brand) {
        skipped.push({ imei: row.imei, reason: `brand not found: ${row.brand}` });
        continue;
      }
      const product = await prisma.product.findFirst({
        where: {
          brandId: brand.id,
          model: row.model,
          storage: row.storage ?? null,
          ...(row.color ? { color: { name: row.color } } : {}),
        },
        include: { brand: { select: { name: true } }, color: { select: { name: true } } },
      });
      if (!product) {
        skipped.push({ imei: row.imei, reason: "product not found" });
        continue;
      }
      if (seen.has(row.imei)) {
        skipped.push({ imei: row.imei, reason: "duplicate in file" });
        continue;
      }
      const existing = await prisma.unit.findUnique({ where: { imei: row.imei } });
      if (existing) {
        skipped.push({ imei: row.imei, reason: "IMEI already exists" });
        continue;
      }
      seen.add(row.imei);

      const unit = await prisma.unit.create({
        data: {
          productId: product.id,
          imei: row.imei,
          condition: row.condition,
          carrier: row.carrier,
          grade: row.grade || null,
          batteryHealth: row.batteryHealth ?? null,
          costPrice: row.costPrice,
          acquiredAt: row.acquiredAt ? new Date(row.acquiredAt) : undefined,
        },
      });
      await prisma.stockMovement.create({
        data: { unitId: unit.id, productId: product.id, type: "IN", note: "Imported" },
      });
      created.push({ imei: row.imei, product: `${product.brand.name} ${product.model}` });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Invalid row";
      skipped.push({ imei: row.imei, reason: message });
    }
  }

  await writeAudit({
    userId,
    action: "UNIT.IMPORT",
    entity: "Unit",
    entityId: created.map((c) => c.imei).join(","),
    details: JSON.stringify({ created: created.length, skipped: skipped.length }),
  });

  return { created, skipped };
}
