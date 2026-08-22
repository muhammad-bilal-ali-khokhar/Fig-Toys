import { prisma } from "../../core/lib/prisma";
import { ApiError } from "../../core/middleware/error";
import { writeAudit } from "../../core/lib/audit";
import type { CategoryInput, CategoryUpdateInput } from "./schemas";

export async function listCategories() {
  const all = await prisma.category.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      _count: { select: { products: true } },
      parent: { select: { id: true, name: true } },
    },
  });
  const byId = new Map<string, (typeof all)[number] & { children: typeof all }>();
  for (const c of all) (byId as Map<string, unknown>).set(c.id, { ...c, children: [] });
  const roots: typeof all = [];
  for (const c of all) {
    const node = byId.get(c.id)!;
    if (c.parentId && byId.has(c.parentId)) byId.get(c.parentId)!.children.push(node);
    else roots.push(node as unknown as (typeof all)[number]);
  }
  const sortRec = (nodes: typeof all) => {
    nodes.sort((a, b) => (a.sortOrder - b.sortOrder) || a.name.localeCompare(b.name));
    for (const n of nodes) if ((n as unknown as { children: typeof all }).children?.length) sortRec((n as unknown as { children: typeof all }).children);
  };
  sortRec(roots as unknown as typeof all);
  return roots as unknown as typeof all;
}

export async function createCategory(input: CategoryInput, userId: string) {
  const targetParentId = input.parentId ?? null;
  const existing = await prisma.category.findFirst({
    where: { name: input.name, parentId: targetParentId },
  });
  if (existing) throw new ApiError(409, "category.duplicate", "Category already exists");

  if (input.parentId) {
    const parent = await prisma.category.findUnique({ where: { id: input.parentId } });
    if (!parent) throw new ApiError(404, "category.parent_not_found", "Parent category not found");
  }

  const category = await prisma.category.create({
    data: {
      name: input.name,
      type: input.type,
      sortOrder: input.sortOrder ?? 0,
      active: true,
      parentId: input.parentId ?? null,
    },
  });
  await writeAudit({
    userId,
    action: "CATEGORY.CREATE",
    entity: "Category",
    entityId: category.id,
    details: JSON.stringify({ name: category.name, type: category.type, parentId: category.parentId }),
  });
  return category;
}

export async function updateCategory(id: string, input: CategoryUpdateInput, userId: string) {
  const existing = await prisma.category.findUnique({ where: { id } });
  if (!existing) throw new ApiError(404, "category.not_found", "Category not found");

  const nextName = input.name !== undefined ? input.name : existing.name;
  const nextParentId = input.parentId !== undefined ? input.parentId : existing.parentId;
  const isNameChange = input.name !== undefined && input.name !== existing.name;
  const isParentChange = input.parentId !== undefined && input.parentId !== existing.parentId;
  if (isNameChange || isParentChange) {
    const dup = await prisma.category.findFirst({
      where: { name: nextName, parentId: nextParentId ?? null, NOT: { id } },
    });
    if (dup) throw new ApiError(409, "category.duplicate", "Category already exists");
  }

  if (input.parentId !== undefined && input.parentId === id) {
    throw new ApiError(400, "category.self_parent", "Category cannot be its own parent");
  }
  if (input.parentId !== undefined && input.parentId !== null) {
    let cur: string | null = input.parentId;
    const seen = new Set<string>();
    while (cur) {
      if (seen.has(cur)) break;
      seen.add(cur);
      if (cur === id) throw new ApiError(400, "category.cycle", "Cannot move category into its own descendant");
      const par: { parentId: string | null } | null = await prisma.category.findUnique({ where: { id: cur }, select: { parentId: true } });
      cur = par?.parentId ?? null;
    }
  }

  const category = await prisma.category.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.type !== undefined ? { type: input.type } : {}),
      ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
      ...(input.active !== undefined ? { active: input.active } : {}),
      ...(input.parentId !== undefined ? { parentId: input.parentId } : {}),
    },
  });
  await writeAudit({
    userId,
    action: "CATEGORY.UPDATE",
    entity: "Category",
    entityId: category.id,
    details: JSON.stringify({ name: category.name, active: category.active }),
  });
  return category;
}

export async function deactivateCategory(id: string, userId: string) {
  const existing = await prisma.category.findUnique({
    where: { id },
    include: { _count: { select: { products: true, children: true } } },
  });
  if (!existing) throw new ApiError(404, "category.not_found", "Category not found");
  if (existing._count.products > 0) {
    throw new ApiError(409, "category.in_use", "Cannot deactivate a category that has products");
  }
  if (existing._count.children > 0) {
    throw new ApiError(409, "category.has_children", "Cannot deactivate a category that has subcategories");
  }

  const category = await prisma.category.update({
    where: { id },
    data: { active: false },
  });
  await writeAudit({
    userId,
    action: "CATEGORY.DEACTIVATE",
    entity: "Category",
    entityId: category.id,
  });
  return category;
}

export async function deleteCategory(id: string, userId: string) {
  const existing = await prisma.category.findUnique({
    where: { id },
    include: { _count: { select: { products: true, children: true } } },
  });
  if (!existing) throw new ApiError(404, "category.not_found", "Category not found");
  if (existing._count.products > 0) {
    throw new ApiError(409, "category.in_use", "Cannot delete a category that has products");
  }
  if (existing._count.children > 0) {
    throw new ApiError(409, "category.has_children", "Cannot delete a category that has subcategories");
  }

  await prisma.category.delete({ where: { id } });
  await writeAudit({
    userId,
    action: "CATEGORY.DELETE",
    entity: "Category",
    entityId: id,
    details: JSON.stringify({ name: existing.name }),
  });
  return { id, deleted: true };
}
