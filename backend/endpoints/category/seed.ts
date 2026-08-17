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
  { id: "cat-phone-used", name: "Used Phone", type: "PHONE", sortOrder: 2 },
  { id: "cat-accessory", name: "Accessory", type: "ACCESSORY", sortOrder: 3 },
  { id: "cat-acc-cases", name: "Cases & Covers", type: "ACCESSORY", sortOrder: 4, parentId: "cat-accessory" },
  { id: "cat-acc-chargers", name: "Chargers & Cables", type: "ACCESSORY", sortOrder: 5, parentId: "cat-accessory" },
  { id: "cat-acc-screens", name: "Screens & Protectors", type: "ACCESSORY", sortOrder: 6, parentId: "cat-accessory" },
  { id: "cat-acc-batteries", name: "Batteries", type: "ACCESSORY", sortOrder: 7, parentId: "cat-accessory" },
  { id: "cat-acc-earphones", name: "Earphones & Headphones", type: "ACCESSORY", sortOrder: 8, parentId: "cat-accessory" },
  { id: "cat-acc-cards", name: "Memory Cards & Storages", type: "ACCESSORY", sortOrder: 9, parentId: "cat-accessory" },
  { id: "cat-acc-holders", name: "Holders & Stands", type: "ACCESSORY", sortOrder: 10, parentId: "cat-accessory" },
  { id: "cat-acc-other", name: "Other Accessories", type: "ACCESSORY", sortOrder: 11, parentId: "cat-accessory" },
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