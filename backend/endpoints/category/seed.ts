import { prisma } from "../../core/lib/prisma";
import type { CategoryType } from "../../generated/prisma/enums";

export const DEFAULT_CATEGORIES: {
  id: string;
  name: string;
  type: CategoryType;
  sortOrder: number;
  parentId?: string;
}[] = [
  { id: "cat-phone-new", name: "New Phone", type: "PHONE", sortOrder: 1 },
  { id: "cat-phone-new-feature", name: "Feature Phone", type: "PHONE", sortOrder: 2, parentId: "cat-phone-new" },
  { id: "cat-phone-new-smart", name: "Smart Phone", type: "PHONE", sortOrder: 3, parentId: "cat-phone-new" },
  { id: "cat-phone-used", name: "Used Phone", type: "PHONE", sortOrder: 4 },
  { id: "cat-phone-used-feature", name: "Feature Phone", type: "PHONE", sortOrder: 5, parentId: "cat-phone-used" },
  { id: "cat-phone-used-smart", name: "Smart Phone", type: "PHONE", sortOrder: 6, parentId: "cat-phone-used" },
  { id: "cat-accessory", name: "Accessory", type: "ACCESSORY", sortOrder: 7 },
  { id: "cat-acc-other", name: "Other Accessories", type: "ACCESSORY", sortOrder: 8, parentId: "cat-accessory" },
];

export async function seedCategories() {
  const created = [];
  for (const cat of DEFAULT_CATEGORIES) {
    const existing = await prisma.category.findUnique({ where: { id: cat.id } });
    if (existing) {
      await prisma.category.update({
        where: { id: cat.id },
        data: { name: cat.name, type: cat.type, sortOrder: cat.sortOrder, active: true, parentId: cat.parentId ?? null },
      });
      continue;
    }
    created.push(
      await prisma.category.create({
        data: { ...cat, active: true, parentId: cat.parentId ?? null },
      }),
    );
  }
  return created;
}