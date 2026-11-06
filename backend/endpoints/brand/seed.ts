import { prisma } from "../../core/lib/prisma";

export const DEFAULT_BRANDS: {
  id: string;
  name: string;
  sortOrder: number;
}[] = [
  { id: "brand-apple", name: "PlaySmart", sortOrder: 1 },
  { id: "brand-samsung", name: "FunBox", sortOrder: 2 },
  { id: "brand-oneplus", name: "KiddoCraft", sortOrder: 3 },
  { id: "brand-infinix", name: "Little Genius", sortOrder: 4 },
  { id: "brand-xiaomi", name: "Happy Wheels", sortOrder: 5 },
  { id: "brand-oppo", name: "BrightStart", sortOrder: 6 },
  { id: "brand-vivo", name: "BuildMax", sortOrder: 7 },
  { id: "brand-generic", name: "WonderLand", sortOrder: 8 },
  { id: "brand-other", name: "ToyHouse", sortOrder: 9 },
];

export async function seedBrands() {
  const created = [];
  for (const brand of DEFAULT_BRANDS) {
    const existing = await prisma.brand.findUnique({ where: { id: brand.id } });
    if (existing) {
      await prisma.brand.update({
        where: { id: brand.id },
        data: { name: brand.name, sortOrder: brand.sortOrder, active: true },
      });
      continue;
    }
    created.push(
      await prisma.brand.create({
        data: { ...brand, active: true },
      }),
    );
  }
  return created;
}
