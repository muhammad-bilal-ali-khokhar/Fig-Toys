import { prisma } from "../../core/lib/prisma";
import { ApiError } from "../../core/middleware/error";
import { writeAudit } from "../../core/lib/audit";
import type { CashDrawerInput, CashDrawerUpdateInput } from "./schemas";

export async function listCashDrawers() {
  return (prisma as any).cashDrawer.findMany({
    orderBy: [{ isDefault: "desc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
  });
}

export async function createCashDrawer(input: CashDrawerInput, userId: string) {
  const makeDefault = input.isDefault === true;
  if (makeDefault) {
    await (prisma as any).cashDrawer.updateMany({ data: { isDefault: false } });
  }
  const drawer = await (prisma as any).cashDrawer.create({
    data: {
      name: input.name,
      active: input.active ?? true,
      isDefault: makeDefault,
      sortOrder: input.sortOrder ?? 0,
    },
  });
  await writeAudit({
    userId,
    action: "CASH_DRAWER.CREATE",
    entity: "CashDrawer",
    entityId: drawer.id,
    details: JSON.stringify({ name: drawer.name, isDefault: drawer.isDefault }),
  });
  return drawer;
}

export async function updateCashDrawer(id: string, input: CashDrawerUpdateInput, userId: string) {
  const existing = await (prisma as any).cashDrawer.findUnique({ where: { id } });
  if (!existing) throw new ApiError(404, "cash_drawer.not_found", "Cash drawer not found");

  if (input.isDefault === true) {
    await (prisma as any).cashDrawer.updateMany({ data: { isDefault: false } });
  }
  if (input.isDefault === false && existing.isDefault) {
    const others = await (prisma as any).cashDrawer.count({ where: { id: { not: id } } });
    if (others === 0) {
      throw new ApiError(409, "cash_drawer.need_default", "At least one default drawer is required");
    }
  }

  const drawer = await (prisma as any).cashDrawer.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.active !== undefined ? { active: input.active } : {}),
      ...(input.isDefault !== undefined ? { isDefault: input.isDefault } : {}),
      ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
    },
  });
  await writeAudit({
    userId,
    action: "CASH_DRAWER.UPDATE",
    entity: "CashDrawer",
    entityId: drawer.id,
    details: JSON.stringify({ name: drawer.name, active: drawer.active }),
  });
  return drawer;
}

export async function setDefaultCashDrawer(id: string, userId: string) {
  const existing = await (prisma as any).cashDrawer.findUnique({ where: { id } });
  if (!existing) throw new ApiError(404, "cash_drawer.not_found", "Cash drawer not found");
  await (prisma as any).cashDrawer.updateMany({ data: { isDefault: false } });
  const drawer = await (prisma as any).cashDrawer.update({ where: { id }, data: { isDefault: true } });
  await writeAudit({
    userId,
    action: "CASH_DRAWER.SET_DEFAULT",
    entity: "CashDrawer",
    entityId: drawer.id,
  });
  return drawer;
}

export async function deleteCashDrawer(id: string, userId: string) {
  const existing = await (prisma as any).cashDrawer.findUnique({ where: { id } });
  if (!existing) throw new ApiError(404, "cash_drawer.not_found", "Cash drawer not found");
  if (Number(existing.balance) !== 0) {
    throw new ApiError(409, "cash_drawer.balance_not_zero", "Drawer has a balance. Transfer or adjust to zero before deleting.");
  }
  const count = await (prisma as any).cashDrawer.count();
  if (count <= 1) {
    throw new ApiError(409, "cash_drawer.last", "Cannot delete the last drawer");
  }
  if (existing.isDefault) {
    throw new ApiError(409, "cash_drawer.is_default", "Cannot delete the default drawer. Set another drawer as default first.");
  }
  const categories = await prisma.category.count({ where: { defaultCashDrawerId: id } });
  if (categories > 0) {
    throw new ApiError(409, "cash_drawer.in_use", "Drawer is assigned to categories. Reassign those categories first.");
  }
  await (prisma as any).cashDrawer.delete({ where: { id } });
  await writeAudit({
    userId,
    action: "CASH_DRAWER.DELETE",
    entity: "CashDrawer",
    entityId: id,
    details: JSON.stringify({ name: existing.name }),
  });
  return { id, deleted: true };
}
