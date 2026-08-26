import { INVENTORY_TEXT } from "@/lib/constants";
import type { InventoryProduct, Unit } from "@/lib/api-types";

export type ProductGroup = {
  key: string;
  units: Unit[];
  accessory?: InventoryProduct;
  count: number;
  displayName: string;
};
export type CategoryGroup = { key: string; products: ProductGroup[] };

export function productName(u: Unit): string {
  return `${u.product.brand} ${u.product.model}${u.product.storage ? ` ${u.product.storage}` : ""}`;
}

export function productNameFromAccessory(p: InventoryProduct): string {
  return `${p.brand} ${p.model}${p.storage ? ` ${p.storage}` : ""}`;
}

export function moneySum(units: Unit[], get: (u: Unit) => string | null | undefined): number {
  return units.reduce((s, u) => s + (parseFloat(get(u) ?? "") || 0), 0);
}

export function uniformText(units: Unit[], get: (u: Unit) => string | null | undefined): string {
  const first = get(units[0]) ?? null;
  const same = units.every((u) => (get(u) ?? null) === first);
  return same ? first || "—" : INVENTORY_TEXT.mixed;
}

export function gradeBattCell(u: Unit): string {
  return (
    [u.grade ? `G${u.grade}` : "", u.batteryHealth != null ? `${u.batteryHealth}%` : ""]
      .filter(Boolean)
      .join(" ") || "—"
  );
}

export function groupInventory(units: Unit[], products?: InventoryProduct[]): CategoryGroup[] {
  const catMap = new Map<string, Map<string, ProductGroup>>();
  for (const u of units) {
    const cat = u.product.category ?? "Other";
    let prodMap = catMap.get(cat);
    if (!prodMap) {
      prodMap = new Map();
      catMap.set(cat, prodMap);
    }
    const existing = prodMap.get(u.product.id);
    if (existing) existing.units.push(u);
    else
      prodMap.set(u.product.id, {
        key: u.product.id,
        units: [u],
        count: 1,
        displayName: productName(u),
      });
  }
  for (const p of products ?? []) {
    const cat = p.category ?? "Other";
    let prodMap = catMap.get(cat);
    if (!prodMap) {
      prodMap = new Map();
      catMap.set(cat, prodMap);
    }
    const existing = prodMap.get(p.id);
    if (existing) {
      existing.count += p.qty;
      existing.accessory = p;
    } else {
      prodMap.set(p.id, {
        key: p.id,
        units: [],
        accessory: p,
        count: p.qty,
        displayName: productNameFromAccessory(p),
      });
    }
  }
  for (const [, prodMap] of catMap) {
    for (const [, g] of prodMap) {
      g.units.sort((a, b) => a.imei.localeCompare(b.imei));
      if (g.units.length > 0) g.count = g.units.length + (g.accessory?.qty ?? 0);
    }
  }
  const list: CategoryGroup[] = [...catMap.entries()].map(([key, prodMap]) => ({
    key,
    products: [...prodMap.values()],
  }));
  const prio = ["New Phone", "Used Phone", "Accessory"];
  list.sort((a, b) => {
    const ia = prio.indexOf(a.key);
    const ib = prio.indexOf(b.key);
    if (ia !== -1 || ib !== -1) {
      if (ia !== -1 && ib !== -1) return ia - ib;
      return ia !== -1 ? -1 : 1;
    }
    return a.key.localeCompare(b.key);
  });
  for (const g of list) {
    g.products.sort((a, b) => a.displayName.localeCompare(b.displayName));
  }
  return list;
}
