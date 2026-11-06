"use client";

import { useState } from "react";
import type { Brand, Category, Color } from "@/lib/api-types";
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
  colorId: string;
  categoryId: string;
  subcategoryId: string;
  ageRange: string;
  size: string;
  pieceCount: string;
  material: string;
  batteryRequired: string;
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
  colorId: "",
  categoryId: "",
  subcategoryId: "",
  ageRange: "",
  size: "",
  pieceCount: "",
  material: "",
  batteryRequired: "",
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
  onBrandCreated,
  onCancel,
}: {
  initial: ProductFormValues;
  brands: Brand[];
  categories: Category[];
  colors: Color[];
  viewCosts: boolean;
  saving: boolean;
  type?: "TOY";
  onSave: (values: ProductFormValues) => void;
  onBrandCreated?: (brand: Brand) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<ProductFormValues>(() => {
    const leaf = initial.subcategoryId || initial.categoryId;
    let base: ProductFormValues;
    if (leaf) {
      const found = findInTree(categories, leaf);
      if (found) base = { ...initial, categoryId: leaf, subcategoryId: "" };
      else base = { ...initial, subcategoryId: "" };
    } else if (initial.subcategoryId && !initial.categoryId) {
      base = { ...initial, categoryId: initial.subcategoryId, subcategoryId: "" };
    } else base = { ...initial, subcategoryId: "" };
    return base;
  });
  const [newBrandName, setNewBrandName] = useState("");
  const [addingBrand, setAddingBrand] = useState(false);
  const dirty = useDirtyForm(initial);

  function update(next: Partial<ProductFormValues>) {
    const updated = { ...form, ...next };
    setForm(updated);
    dirty.markDirty(updated);
  }

  const parentCategories = categories.filter((c) => !c.parentId);
  const filteredRoots = parentCategories;
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
               options={[...brands.map((b) => ({ value: b.id, label: b.name })), { value: "__new_brand__", label: "+ Add new brand" }]}
               onChange={(value) => {
                 if (value === "__new_brand__") setNewBrandName("");
                 else update({ brandId: value });
               }}
              placeholder="Select…"
              searchable
            />
            {newBrandName !== "" || form.brandId === "" ? (
              <div className="mt-2 flex gap-2">
                <Input value={newBrandName} onChange={(e) => setNewBrandName(e.target.value)} placeholder="New brand name" />
                <Button type="button" variant="secondary" loading={addingBrand} onClick={async () => {
                  const name = newBrandName.trim();
                  if (!name) return;
                  setAddingBrand(true);
                  try {
                    const brand = await (await import("@/lib/apiClient")).apiRequest<Brand>("/brand", { method: "POST", body: { name } });
                    update({ brandId: brand.id });
                    setNewBrandName("");
                    onBrandCreated?.(brand);
                  } finally {
                    setAddingBrand(false);
                  }
                }}>Add</Button>
              </div>
            ) : null}
          </div>
          <Input
            aria-label="Product name"
            value={form.model}
            onChange={(e) => update({ model: e.target.value })}
            placeholder="Product name"
            className="self-end"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
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
          <Input value={form.size} onChange={(e) => update({ size: e.target.value })} placeholder="Size (optional)" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input value={form.ageRange} onChange={(e) => update({ ageRange: e.target.value })} placeholder="Recommended age (e.g. 3–5 years)" />
          <Input value={form.pieceCount} onChange={(e) => update({ pieceCount: e.target.value })} placeholder="Piece count (optional)" inputMode="numeric" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input value={form.material} onChange={(e) => update({ material: e.target.value })} placeholder="Material (optional)" />
          <Input value={form.batteryRequired} onChange={(e) => update({ batteryRequired: e.target.value })} placeholder="Battery requirement (optional)" />
        </div>
        <div className="grid grid-cols-2 gap-3">
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
        </div>
        <div className="flex items-center gap-2 py-1">
          <Checkbox checked={!!form.hasBarcode} onChange={(v) => update({ hasBarcode: !!v })} />
          <label className="text-xs font-semibold text-ink-500">Product has a barcode</label>
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
