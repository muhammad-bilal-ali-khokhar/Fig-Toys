import { prisma } from "../../core/lib/prisma";
import type { CategoryType } from "../../generated/prisma/enums";

export const DEFAULT_CATEGORIES: {
  id: string;
  name: string;
  type: CategoryType;
  sortOrder: number;
  parentId?: string;
}[] = [
  { id: "cat-vehicles", name: "Cars & Vehicles", type: "ACCESSORY", sortOrder: 1 },
  { id: "cat-dolls", name: "Dolls & Figures", type: "ACCESSORY", sortOrder: 2 },
  { id: "cat-educational", name: "Educational Toys", type: "ACCESSORY", sortOrder: 3 },
  { id: "cat-building", name: "Building Blocks", type: "ACCESSORY", sortOrder: 4 },
  { id: "cat-puzzles", name: "Puzzles & Games", type: "ACCESSORY", sortOrder: 5 },
  { id: "cat-outdoor", name: "Outdoor Toys", type: "ACCESSORY", sortOrder: 6 },
  { id: "cat-baby", name: "Baby Toys", type: "ACCESSORY", sortOrder: 7 },
  { id: "cat-party", name: "Party & Gift Items", type: "ACCESSORY", sortOrder: 8 },
  { id: "cat-other", name: "Other Toys", type: "ACCESSORY", sortOrder: 9 },
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
