"use client";

import { Button } from "@/components/ui/button";
import { Dropdown } from "@/components/ui/dropdown";
import { SearchInput } from "@/components/ui/search-input";
import { Sheet } from "@/components/ui/sheet";
import { CARRIER_LABELS, CONDITION_LABELS, STATUS_LABELS } from "@/lib/constants/units";
import type { Brand, Category, Color } from "@/lib/api-types";

export const STATUS_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "All statuses" },
  ...Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label })),
];

export const CARRIER_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "All carriers" },
  ...Object.entries(CARRIER_LABELS).map(([value, label]) => ({ value, label })),
];

export const CONDITION_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "All conditions" },
  ...Object.entries(CONDITION_LABELS).map(([value, label]) => ({ value, label })),
];

export function findCategory(cats: Category[], id: string): Category | null {
  for (const c of cats) {
    if (c.id === id) return c;
    if (c.children?.length) {
      const f = findCategory(c.children, id);
      if (f) return f;
    }
  }
  return null;
}

export function collectSubtreeIds(node: Category): Set<string> {
  const ids = new Set<string>([node.id]);
  for (const ch of node.children ?? []) {
    for (const id of collectSubtreeIds(ch)) ids.add(id);
  }
  return ids;
}

function flattenSubcategoryOptions(cats: Category[], prefix = ""): { value: string; label: string }[] {
  const out: { value: string; label: string }[] = [];
  for (const c of cats) {
    if (!c.active) continue;
    const label = prefix ? `${prefix} › ${c.name}` : c.name;
    out.push({ value: c.id, label });
    if (c.children?.length) out.push(...flattenSubcategoryOptions(c.children, label));
  }
  return out;
}

export type InventoryFilterState = {
  q: string;
  categoryId: string;
  subcategoryId: string;
  brandId: string;
  colorId: string;
  status: string;
  carrier: string;
  condition: string;
  vendor: string;
};

export const EMPTY_INVENTORY_FILTERS: InventoryFilterState = {
  q: "",
  categoryId: "",
  subcategoryId: "",
  brandId: "",
  colorId: "",
  status: "",
  carrier: "",
  condition: "",
  vendor: "",
};

export function InventoryFilterSheet({
  open,
  onClose,
  filters,
  onChange,
  categories,
  brands,
  colors,
  vendorOptions,
  filteredCount,
  totalCount,
}: {
  open: boolean;
  onClose: () => void;
  filters: InventoryFilterState;
  onChange: (next: InventoryFilterState) => void;
  categories: Category[];
  brands: Brand[];
  colors: Color[];
  vendorOptions: string[];
  filteredCount: number;
  totalCount: number;
}) {
  const activeCategories = categories.filter((c) => c.active);
  const activeBrands = brands.filter((b) => b.active);
  const activeColors = colors.filter((c) => c.active);
  const parentCategories = activeCategories.filter((c) => !c.parentId);
  const selectedCategory =
    filters.subcategoryId || filters.categoryId
      ? findCategory(activeCategories, filters.subcategoryId || filters.categoryId)
      : null;
  const subcategoryOptions = selectedCategory
    ? [{ value: "", label: "All subcategories" }, ...flattenSubcategoryOptions(selectedCategory.children ?? [])]
    : [{ value: "", label: "Select a category first" }];

  return (
    <Sheet open={open} title="Filters" onClose={onClose} width="max-w-[720px]">
      <div className="space-y-5">
        <div>
          <p className="mb-3 text-[11px] font-bold uppercase tracking-widest text-ink-400">Product</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-ink-500">Category</label>
              <Dropdown
                value={filters.categoryId}
                onChange={(v) => onChange({ ...filters, categoryId: v, subcategoryId: "" })}
                searchable
                placeholder="All categories"
                options={[{ value: "", label: "All categories" }, ...parentCategories.map((c) => ({ value: c.id, label: c.name }))]}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-ink-500">Subcategory</label>
              <Dropdown
                value={filters.subcategoryId}
                onChange={(v) => onChange({ ...filters, subcategoryId: v })}
                searchable
                placeholder={filters.categoryId ? "All subcategories" : "Select a category first"}
                options={subcategoryOptions}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-ink-500">Brand</label>
              <Dropdown
                value={filters.brandId}
                onChange={(v) => onChange({ ...filters, brandId: v })}
                searchable
                placeholder="All brands"
                options={[{ value: "", label: "All brands" }, ...activeBrands.map((b) => ({ value: b.id, label: b.name }))]}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-ink-500">Color</label>
              <Dropdown
                value={filters.colorId}
                onChange={(v) => onChange({ ...filters, colorId: v })}
                searchable
                placeholder="All colors"
                options={[{ value: "", label: "All colors" }, ...activeColors.map((c) => ({ value: c.id, label: c.name }))]}
              />
            </div>
          </div>
        </div>

        <div>
          <p className="mb-3 text-[11px] font-bold uppercase tracking-widest text-ink-400">Stock details</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-ink-500">Status</label>
              <Dropdown
                value={filters.status}
                onChange={(v) => onChange({ ...filters, status: v })}
                options={STATUS_FILTER_OPTIONS}
                placeholder="All statuses"
                searchable
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-ink-500">Carrier</label>
              <Dropdown
                value={filters.carrier}
                onChange={(v) => onChange({ ...filters, carrier: v })}
                options={CARRIER_FILTER_OPTIONS}
                placeholder="All carriers"
                searchable
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-ink-500">Condition</label>
              <Dropdown
                value={filters.condition}
                onChange={(v) => onChange({ ...filters, condition: v })}
                options={CONDITION_FILTER_OPTIONS}
                placeholder="All conditions"
                searchable
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-ink-500">Vendor</label>
              <Dropdown
                value={filters.vendor}
                onChange={(v) => onChange({ ...filters, vendor: v })}
                searchable
                placeholder="All vendors"
                options={[{ value: "", label: "All vendors" }, ...vendorOptions.map((v) => ({ value: v, label: v }))]}
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-ink-100 pt-4">
          <p className="text-sm text-ink-500">{filteredCount} item(s)</p>
          <div className="flex items-center gap-2">
            <Button variant="grey" onClick={() => onChange({ ...EMPTY_INVENTORY_FILTERS })}>
              Reset
            </Button>
            <Button onClick={onClose}>Show {filteredCount}</Button>
          </div>
        </div>
      </div>
    </Sheet>
  );
}
