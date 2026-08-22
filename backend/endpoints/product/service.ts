import { prisma } from "../../core/lib/prisma";
import { ApiError } from "../../core/middleware/error";
import { writeAudit } from "../../core/lib/audit";
import { formatSku, nextSkuNumber } from "../../core/lib/sku";
import type { ImportProductInput, ProductInput } from "./schemas";

async function findDuplicate(key: { brandId: string; model: string; storage?: string; colorId?: string; categoryId: string }, excludeId?: string) {
  return prisma.product.findFirst({
    where: {
      brandId: key.brandId,
      model: key.model,
      storage: key.storage ?? null,
      colorId: key.colorId ?? null,
      categoryId: key.categoryId,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    include: { brand: { select: { name: true } } },
  });
}

function throwDuplicate(existing: { brand: { name: string }; model: string }) {
  throw new ApiError(409, "product.duplicate", `A product "${existing.brand.name} ${existing.model}" already exists with the same storage, color and category`);
}

export async function listProducts({ q, categoryId }: { q?: string; categoryId?: string }) {
  const where = {
    ...(categoryId ? { categoryId } : {}),
    ...(q
      ? {
          OR: [
            { brand: { name: { contains: q } } },
            { model: { contains: q } },
            { sku: { contains: q } },
            { storage: { contains: q } },
            { ram: { contains: q } },
            { screenSize: { contains: q } },
            { color: { name: { contains: q } } },
          ],
        }
      : {}),
  };

  const products = await prisma.product.findMany({
    where,
    orderBy: [{ brand: { name: "asc" } }, { model: "asc" }],
    include: {
      brand: { select: { id: true, name: true } },
      color: { select: { id: true, name: true } },
      category: {
        select: {
          id: true,
          name: true,
          type: true,
          parentId: true,
          parent: { select: { id: true, name: true } },
        },
      },
      units: {
        where: { status: "IN_STOCK" },
        select: { id: true, condition: true },
      },
    },
  });

  const accessoryIds = products.filter((p) => p.category.type === "ACCESSORY").map((p) => p.id);
  let qtyByProduct = new Map<string, number>();
  if (accessoryIds.length > 0) {
    const items = await prisma.transactionItem.findMany({
      where: { productId: { in: accessoryIds }, unitId: null },
      select: { productId: true, quantity: true, transaction: { select: { type: true } } },
    });
    for (const it of items) {
      const sign =
        it.transaction.type === "PURCHASE"
          ? 1
          : it.transaction.type === "SALE"
            ? -1
            : it.transaction.type === "PURCHASE_RETURN"
              ? -1
              : it.transaction.type === "SALE_RETURN"
                ? 1
                : 0;
      qtyByProduct.set(it.productId, (qtyByProduct.get(it.productId) ?? 0) + sign * it.quantity);
    }
  }

  return products.map((p) => {
    const isAccessory = p.category.type === "ACCESSORY";
    const qty = isAccessory ? (qtyByProduct.get(p.id) ?? 0) : p.units.length;
    const inStock = isAccessory ? qty : p.units.length;
    return {
      id: p.id,
      brandId: p.brandId,
      brand: p.brand.name,
      model: p.model,
      storage: p.storage,
      ram: p.ram,
      screenSize: p.screenSize,
      colorId: p.colorId,
      color: p.color?.name ?? null,
      categoryId: p.categoryId,
      categoryName: p.category.name,
      categoryType: p.category.type,
      parentCategoryId: p.category.parentId,
      parentCategoryName: p.category.parent?.name ?? null,
      sku: p.sku,
      barcode: (p as any).barcode ?? null,
      image: p.image,
      sellPrice: p.sellPrice,
      costPrice: p.costPrice,
      retailPrice: p.retailPrice,
      lowStockThreshold: p.lowStockThreshold,
      inStock,
      newInStock: p.units.filter((u) => u.condition === "NEW").length,
      usedInStock: p.units.filter((u) => u.condition === "USED").length,
    };
  });
}

async function resolveSku(input: { sku?: string }) {
  if (input.sku && input.sku.trim()) return input.sku.trim();
  const all = await prisma.product.findMany({ select: { sku: true } });
  return formatSku(nextSkuNumber(all.map((p) => p.sku)));
}

export async function getProduct(id: string) {
  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      brand: { select: { id: true, name: true } },
      category: { select: { id: true, name: true, type: true } },
      units: { orderBy: { acquiredAt: "desc" } },
      priceHistory: { orderBy: { fromDate: "desc" } },
    },
  });
  if (!product) throw new ApiError(404, "product.not_found", "Product not found");
  return product;
}

export async function createProduct(input: ProductInput, userId: string) {
  const existing = await findDuplicate({
    brandId: input.brandId,
    model: input.model,
    storage: input.storage,
    colorId: input.colorId,
    categoryId: input.categoryId,
  });
  if (existing) throwDuplicate(existing);

  const sku = await resolveSku(input);
  const product = await prisma.product.create({
    data: {
      brandId: input.brandId,
      model: input.model,
      storage: input.storage,
      ram: input.ram,
      screenSize: input.screenSize,
      colorId: input.colorId ?? null,
      categoryId: input.categoryId,
      sku,
      barcode: input.barcode,
      image: input.image,
      specs: input.specs,
      sellPrice: input.sellPrice,
      costPrice: input.costPrice,
      retailPrice: input.retailPrice ?? null,
      lowStockThreshold: input.lowStockThreshold ?? 2,
      priceHistory: {
        create: { sellPrice: input.sellPrice, costPrice: input.costPrice },
      },
    },
  });
  await writeAudit({
    userId,
    action: "PRODUCT.CREATE",
    entity: "Product",
    entityId: product.id,
    details: JSON.stringify({ sku: product.sku, brandId: product.brandId, model: product.model }),
  });
  return product;
}

export async function updateProduct(id: string, input: ProductInput, userId: string) {
  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) throw new ApiError(404, "product.not_found", "Product not found");

  const dup = await findDuplicate(
    {
      brandId: input.brandId,
      model: input.model,
      storage: input.storage,
      colorId: input.colorId,
      categoryId: input.categoryId,
    },
    id,
  );
  if (dup) throwDuplicate(dup);

  const priceChanged =
    Number(existing.sellPrice) !== input.sellPrice ||
    Number(existing.costPrice) !== input.costPrice;

  const sku = input.sku && input.sku.trim() ? input.sku.trim() : existing.sku;

  const product = await prisma.product.update({
    where: { id },
    data: {
      brandId: input.brandId,
      model: input.model,
      storage: input.storage,
      ram: input.ram,
      screenSize: input.screenSize,
      colorId: input.colorId ?? null,
      categoryId: input.categoryId,
      sku,
      barcode: input.barcode,
      image: input.image,
      specs: input.specs,
      sellPrice: input.sellPrice,
      costPrice: input.costPrice,
      retailPrice: input.retailPrice ?? null,
      lowStockThreshold: input.lowStockThreshold ?? 2,
      ...(priceChanged
        ? {
            priceHistory: {
              create: { sellPrice: input.sellPrice, costPrice: input.costPrice },
            },
          }
        : {}),
    },
  });
  await writeAudit({
    userId,
    action: "PRODUCT.UPDATE",
    entity: "Product",
    entityId: product.id,
  });
  return product;
}

export async function searchProducts(q: string, statuses: string[] = ["IN_STOCK"]) {
  const query = q.trim();
  if (!query || query.length < 2) return [];
  const tokens = query.split(/\s+/).filter(Boolean);
  const products = await prisma.product.findMany({
    where: {
      AND: tokens.map((token) => ({
        OR: [
          { brand: { name: { contains: token } } },
          { model: { contains: token } },
          { sku: { contains: token } },
          { barcode: { contains: token } },
          { units: { some: { imei: { contains: token } } } },
        ],
      })),
    },
    take: 10,
    include: {
      brand: { select: { id: true, name: true } },
      color: { select: { id: true, name: true } },
      category: {
        select: {
          id: true,
          name: true,
          type: true,
          parentId: true,
          parent: { select: { id: true, name: true } },
        },
      },
      units: {
        where: { status: { in: statuses as ("IN_STOCK" | "RESERVED")[] } },
        select: { id: true, condition: true, imei: true, carrier: true, status: true, costPrice: true },
      },
    },
  });
  let mapped = products.map((p) => ({
    id: p.id,
    brandId: p.brandId,
    brand: p.brand.name,
    model: p.model,
    storage: p.storage,
    ram: p.ram,
    screenSize: p.screenSize,
    colorId: p.colorId,
    color: p.color?.name ?? null,
    category: p.category,
    sku: p.sku,
    barcode: (p as any).barcode ?? null,
    sellPrice: p.sellPrice,
    costPrice: (p as any).costPrice ?? null,
    units: p.units,
  }));
  if (/^\d+$/.test(query)) {
    mapped = mapped.map((p) => ({
      ...p,
      units: p.units.filter((u) => u.imei.includes(query)),
    }));
  }
  return mapped.filter((p) => p.category.type === "ACCESSORY" || p.units.length > 0);
}

async function findOrCreateBrand(name: string) {
  const found = await prisma.brand.findUnique({ where: { name } });
  if (found) return found;
  return prisma.brand.create({ data: { name, active: true } });
}

async function findOrCreateCategory(name: string) {
  const found = await prisma.category.findFirst({ where: { name } });
  if (found) return found;
  const type = name.toLowerCase().includes("accessory") ? "ACCESSORY" : "PHONE";
  return prisma.category.create({ data: { name, type: type as "ACCESSORY" | "PHONE", active: true } });
}

async function findOrCreateColor(name: string) {
  const found = await prisma.color.findUnique({ where: { name } });
  if (found) return found;
  return prisma.color.create({ data: { name, active: true } });
}

export async function importProducts(rows: ImportProductInput[], userId: string) {
  const allSkus = await prisma.product.findMany({ select: { sku: true } });
  let skuCounter = nextSkuNumber(allSkus.map((p) => p.sku));

  const created: { brand: string; model: string; sku: string }[] = [];
  const skipped: { brand: string; model: string; reason: string }[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    try {
      const brand = await findOrCreateBrand(row.brand);
      const category = await findOrCreateCategory(row.category);
      const color = row.color ? await findOrCreateColor(row.color) : null;

      const dupKey = `${brand.id}|${row.model}|${row.storage ?? ""}|${color?.id ?? ""}|${category.id}`;
      if (seen.has(dupKey)) {
        skipped.push({ brand: row.brand, model: row.model, reason: "duplicate in file" });
        continue;
      }

      const existing = await prisma.product.findFirst({
        where: {
          brandId: brand.id,
          model: row.model,
          storage: row.storage ?? null,
          colorId: color?.id ?? null,
          categoryId: category.id,
        },
      });
      if (existing) {
        skipped.push({ brand: row.brand, model: row.model, reason: "already exists" });
        continue;
      }

      seen.add(dupKey);
      const sku = row.sku?.trim() ? row.sku.trim() : formatSku(skuCounter++);
      const product = await prisma.product.create({
        data: {
          sku,
          brandId: brand.id,
          model: row.model,
          storage: row.storage,
          ram: row.ram,
          screenSize: row.screenSize,
          colorId: color?.id ?? null,
          categoryId: category.id,
          sellPrice: row.sellPrice,
          costPrice: row.costPrice,
          retailPrice: row.retailPrice ?? null,
          priceHistory: {
            create: { sellPrice: row.sellPrice, costPrice: row.costPrice },
          },
        },
      });
      created.push({ brand: row.brand, model: row.model, sku: product.sku });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Invalid row";
      skipped.push({ brand: row.brand, model: row.model, reason: message });
    }
  }

  await writeAudit({
    userId,
    action: "PRODUCT.IMPORT",
    entity: "Product",
    entityId: created.map((c) => c.sku).join(","),
    details: JSON.stringify({ created: created.length, skipped: skipped.length }),
  });

  return { created, skipped };
}

export async function bulkDeleteProducts(ids: string[], userId: string) {
  const products = await prisma.product.findMany({
    where: { id: { in: ids } },
    include: { brand: { select: { name: true } }, _count: { select: { items: true } } },
  });

  const deletable = products
    .filter((p) => p._count.items === 0)
    .map((p) => p.id);
  const blocked = products
    .filter((p) => p._count.items > 0)
    .map((p) => ({ id: p.id, brand: p.brand.name, model: p.model }));

  if (deletable.length > 0) {
    await prisma.product.deleteMany({ where: { id: { in: deletable } } });
  }

  await writeAudit({
    userId,
    action: "PRODUCT.DELETE",
    entity: "Product",
    entityId: deletable.join(","),
    details: JSON.stringify({ deleted: deletable.length, blocked: blocked.length }),
  });

  return { deleted: deletable.length, blocked };
}
