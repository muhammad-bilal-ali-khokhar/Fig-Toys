import { prisma } from "../../core/lib/prisma";
import { writeAudit } from "../../core/lib/audit";
import type { BundleInput } from "./schemas";

const includeBundle = {
  items: { include: { product: { include: { brand: true, color: true } } } },
} as const;

export async function listBundles() {
  return prisma.bundle.findMany({ include: includeBundle, orderBy: { name: "asc" } });
}

export async function createBundle(input: BundleInput, userId: string) {
  const bundle = await prisma.bundle.create({
    data: {
      name: input.name,
      sku: input.sku || undefined,
      price: input.price,
      active: input.active,
      items: { create: input.items },
    },
    include: includeBundle,
  });
  await writeAudit({ userId, action: "BUNDLE.CREATE", entity: "Bundle", entityId: bundle.id, details: JSON.stringify({ name: bundle.name }) });
  return bundle;
}

export async function updateBundle(id: string, input: BundleInput, userId: string) {
  const bundle = await prisma.$transaction(async (tx) => {
    await tx.bundleItem.deleteMany({ where: { bundleId: id } });
    return tx.bundle.update({
      where: { id },
      data: { name: input.name, sku: input.sku || null, price: input.price, active: input.active, items: { create: input.items } },
      include: includeBundle,
    });
  });
  await writeAudit({ userId, action: "BUNDLE.UPDATE", entity: "Bundle", entityId: bundle.id, details: JSON.stringify({ name: bundle.name }) });
  return bundle;
}

export async function deleteBundle(id: string, userId: string) {
  await prisma.bundle.delete({ where: { id } });
  await writeAudit({ userId, action: "BUNDLE.DELETE", entity: "Bundle", entityId: id });
}
