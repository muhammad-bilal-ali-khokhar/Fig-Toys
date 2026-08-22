"use client";

import { useState } from "react";
import type { Brand, Category, Color } from "@/lib/api-types";
import { RAM_OPTIONS, SCREEN_SIZE_OPTIONS, STORAGE_OPTIONS } from "@/lib/constants";
import { useDirtyForm } from "@/lib/use-dirty-form";
import { DiscardConfirmDialog } from "@/components/ui/discard-confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dropdown } from "@/components/ui/dropdown";
import { Checkbox } from "@/components/ui/checkbox";
import { ImagePicker } from "@/components/products/image-picker";

export type ProductFormValues = {
  brandId: string;
  model: string;
  storage: string;
  ram: string;
  screenSize: string;
  colorId: string;
  categoryId: string;
  subcategoryId: string;
  sellPrice: string;
  costPrice: string;
  retailPrice: string;
  barcode: string;
  hasBarcode: boolean;
  image: string;
};

export const EMPTY_PRODUCT_FORM: ProductFormValues = {
  brandId: "",
  model: "",
  storage: "",
  ram: "",
  screenSize: "",
  colorId: "",
  categoryId: "",
  subcategoryId: "",
  sellPrice: "",
  costPrice: "",
  retailPrice: "",
  barcode: "",
  hasBarcode: false,
  image: "",
};

function flattenForSelect(cats: Category[], prefix = ""): { value: string; label: string }[] {
  const out: { value: string; label: string }[] = [];
  for (const c of cats) {
    const label = prefix ? `${prefix} › ${c.name}` : c.name;
    out.push({ value: c.id, label });
    if (c.children?.length) out.push(...flattenForSelect(c.children, label));
  }
  return out;
}
function findInTree(cats: Category[], id: string): Category | null {
  for (const c of cats) {
    if (c.id === id) return c;
    if (c.children?.length) {
      const f = findInTree(c.children, id);
      if (f) return f;
    }
  }
  return null;
}

export function ProductForm({
  initial,
  brands,
  categories,
  colors,
  viewCosts,
  saving,
  type,
  onSave,
  onCancel,
}: {
  initial: ProductFormValues;
  brands: Brand[];
  categories: Category[];
  colors: Color[];
  viewCosts: boolean;
  saving: boolean;
  type?: "NEW" | "USED" | "ACCESSORY";
  onSave: (values: ProductFormValues) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<ProductFormValues>(() => {
    const leaf = initial.subcategoryId || initial.categoryId;
    if (leaf) {
      const found = findInTree(categories, leaf);
      if (found) return { ...initial, categoryId: leaf, subcategoryId: "" };
    }
    if (initial.subcategoryId && !initial.categoryId) {
      return { ...initial, categoryId: initial.subcategoryId, subcategoryId: "" };
    }
    return { ...initial, subcategoryId: "" };
  });
  const dirty = useDirtyForm(initial);

  function update(next: Partial<ProductFormValues>) {
    const updated = { ...form, ...next };
    setForm(updated);
    dirty.markDirty(updated);
  }

  const parentCategories = categories.filter((c) => !c.parentId);
  const isPhone = type !== "ACCESSORY";
  const filteredRoots =
    type === "ACCESSORY"
      ? parentCategories.filter((c) => c.type === "ACCESSORY")
      : type === "USED"
        ? parentCategories.filter((c) => c.type === "PHONE" && c.name.toLowerCase().includes("used"))
        : type === "NEW"
          ? parentCategories.filter((c) => c.type === "PHONE" && c.name.toLowerCase().includes("new"))
          : parentCategories;
  const categoryOptions = flattenForSelect(filteredRoots);

  const effectiveCategoryId = form.categoryId;

  return (
    <form
      id="product-form"
      onSubmit={(e) => {
        e.preventDefault();
        onSave({ ...form, categoryId: effectiveCategoryId, subcategoryId: "" });
      }}
    >
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-ink-500">Brand</label>
            <Dropdown
              value={form.brandId}
              options={brands.map((b) => ({ value: b.id, label: b.name }))}
              onChange={(value) => update({ brandId: value })}
              placeholder="Select…"

            />
          </div>
          <Input
            value={form.model}
            onChange={(e) => update({ model: e.target.value })}
            placeholder="Model"
            className="self-end"
          />
        </div>
        {isPhone && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-ink-500">Storage</label>
              <Dropdown
                value={form.storage}
                options={STORAGE_OPTIONS.map((s) => ({ value: s, label: s }))}
                onChange={(value) => update({ storage: value })}
                searchable
                allowCustom
                placeholder="Select…"

              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-ink-500">RAM</label>
              <Dropdown
                value={form.ram}
                options={RAM_OPTIONS.map((r) => ({ value: r, label: r }))}
                onChange={(value) => update({ ram: value })}
                searchable
                allowCustom
                placeholder="Select…"

              />
            </div>
          </div>
        )}
        {isPhone && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-ink-500">Screen size</label>
              <Dropdown
                value={form.screenSize}
                options={SCREEN_SIZE_OPTIONS.map((s) => ({ value: s, label: s }))}
                onChange={(value) => update({ screenSize: value })}
                searchable
                allowCustom
                placeholder="Select…"

              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-ink-500">Color</label>
              <Dropdown
                value={form.colorId}
                options={colors.map((c) => ({ value: c.id, label: c.name }))}
                onChange={(value) => update({ colorId: value })}
                searchable
                placeholder="Select…"

              />
            </div>
          </div>
        )}
        <div>
          <label className="mb-1 block text-xs font-semibold text-ink-500">Category</label>
          <Dropdown
            value={form.categoryId}
            options={categoryOptions}
            onChange={(value) => update({ categoryId: value })}
            placeholder="Select…"
            searchable
          />
        </div>
        <div className="flex items-center gap-2 py-1">
          <Checkbox checked={!!form.hasBarcode} onChange={(v) => update({ hasBarcode: !!v })} />
          <label className="text-xs font-semibold text-ink-500">Contain barcode</label>
          <span className="text-xs text-ink-400">— if disabled, no barcode (barcode added at purchase)</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-ink-500">Sell price (PKR)</label>
            <Input
              value={form.sellPrice}
              onChange={(e) => update({ sellPrice: e.target.value })}
              placeholder="0"
              inputMode="numeric"
            />
          </div>
          {viewCosts && (
            <div>
              <label className="mb-1 block text-xs font-semibold text-ink-500">Cost price (PKR)</label>
              <Input
                value={form.costPrice}
                onChange={(e) => update({ costPrice: e.target.value })}
                placeholder="0"
                inputMode="numeric"
              />
            </div>
          )}
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-ink-500">
            Retail price (PKR) <span className="font-normal text-ink-400">(invoice / company MRP, optional)</span>
          </label>
          <Input
            value={form.retailPrice}
            onChange={(e) => update({ retailPrice: e.target.value })}
            placeholder="0"
            inputMode="numeric"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-ink-500">
            Image <span className="font-normal text-ink-400">(optional)</span>
          </label>
          <ImagePicker value={form.image} onChange={(value) => update({ image: value })} />
        </div>
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="grey" onClick={() => dirty.requestClose(onCancel)}>
          Cancel
        </Button>
        <Button type="submit" form="product-form" loading={saving}>
          Save
        </Button>
      </div>

      <DiscardConfirmDialog
        open={dirty.confirmOpen}
        onConfirm={dirty.confirmDiscard}
        onCancel={dirty.cancelDiscard}
      />
    </form>
  );
}
