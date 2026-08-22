"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { apiRequest } from "@/lib/apiClient";
import type { Brand, Category, CategoryType, Color, ScreenSize } from "@/lib/api-types";
import {
  INVENTORY_COLUMNS,
  DEFAULT_INVENTORY_VIEW,
  type InventoryColumnKey,
  type InventoryViewSettings,
} from "@/lib/constants/units";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Dropdown } from "@/components/ui/dropdown";
import { Sheet } from "@/components/ui/sheet";
import { Dialog } from "@/components/ui/dialog";
import { ScrollView } from "@/components/ui/scroll-view";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { useToast } from "@/components/ui/toast";

type ManageTab = "view" | "category" | "brand" | "color" | "size";

export function ManageWindow({
  categories,
  brands,
  colors,
  screenSizes,
  initialTab,
  onClose,
  onChanged,
  view,
  onViewChange,
  title = "Manage categories, brands, colors & sizes",
}: {
  categories?: Category[];
  brands?: Brand[];
  colors?: Color[];
  screenSizes?: ScreenSize[];
  initialTab?: ManageTab;
  onClose: () => void;
  onChanged?: () => void;
  view?: InventoryViewSettings;
  onViewChange?: (next: InventoryViewSettings) => void;
  title?: string;
}) {
  const [tab, setTab] = useState<ManageTab>(initialTab ?? "category");
  const [catKey, setCatKey] = useState(0);
  const [brandKey, setBrandKey] = useState(0);
  const [colorKey, setColorKey] = useState(0);
  const [sizeKey, setSizeKey] = useState(0);
  const hasView = view !== undefined && onViewChange !== undefined;

  if (hasView) {
    return (
      <Sheet open title={title} onClose={onClose} width="max-w-xl">
        <ViewTab view={view} onViewChange={onViewChange} />
      </Sheet>
    );
  }

  return (
    <Sheet open title={title} onClose={onClose} width="max-w-xl">
      <SegmentedControl
        className="w-full"
        value={tab}
        options={[
          { value: "category", label: "Categories" },
          { value: "brand", label: "Brands" },
          { value: "color", label: "Colors" },
          { value: "size", label: "Screen sizes" },
        ]}
        onChange={(value) => setTab(value as ManageTab)}
      />

      {tab === "category" ? (
        <CategoryTreeList
          key={catKey}
          categories={categories ?? []}
          onChanged={() => {
            setCatKey((k) => k + 1);
            onChanged?.();
          }}
        />
      ) : tab === "brand" ? (
        <EntityList
          key={brandKey}
          items={brands ?? []}
          onChanged={() => {
            setBrandKey((k) => k + 1);
            onChanged?.();
          }}
          path="/brand"
          noun="brand"
          placeholder="e.g. Samsung"
        />
      ) : tab === "color" ? (
        <EntityList
          key={colorKey}
          items={colors ?? []}
          onChanged={() => {
            setColorKey((k) => k + 1);
            onChanged?.();
          }}
          path="/color"
          noun="color"
          placeholder="e.g. Midnight"
        />
      ) : (
        <EntityList
          key={sizeKey}
          items={screenSizes ?? []}
          onChanged={() => {
            setSizeKey((k) => k + 1);
            onChanged?.();
          }}
          path="/screen-size"
          noun="screen size"
          placeholder={'e.g. 6.1"'}
        />
      )}
    </Sheet>
  );
}

function flattenForSelect(cats: Category[], prefix = ""): { value: string; label: string }[] {
  const out: { value: string; label: string }[] = [];
  for (const c of cats) {
    const label = prefix ? `${prefix} › ${c.name}` : c.name;
    out.push({ value: c.id, label });
    if (c.children?.length) out.push(...flattenForSelect(c.children, label));
  }
  return out;
}
function findCategoryById(cats: Category[], id: string): Category | null {
  for (const c of cats) {
    if (c.id === id) return c;
    if (c.children?.length) {
      const found = findCategoryById(c.children, id);
      if (found) return found;
    }
  }
  return null;
}
function countRecursive(cat: Category): number {
  let total = cat._count?.products ?? 0;
  for (const ch of cat.children ?? []) total += countRecursive(ch);
  return total;
}
function countDirectChildren(cat: Category): number {
  let n = cat.children?.length ?? 0;
  for (const ch of cat.children ?? []) n += countDirectChildren(ch);
  return n;
}
function CategoryNode({
  cat,
  depth,
  expanded,
  onToggle,
  onRename,
  onDelete,
  onToggleActive,
}: {
  cat: Category;
  depth: number;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  onRename: (c: Category, n: string) => void;
  onDelete: (c: Category) => void;
  onToggleActive: (c: Category) => void;
}) {
  const hasChildren = (cat.children?.length ?? 0) > 0;
  const isExpanded = expanded.has(cat.id);
  const isRoot = depth === 0;
  return (
    <div>
      <div
        className={`flex items-center gap-3 rounded-2xl px-3.5 py-2.5 ${isRoot ? (cat.active ? "bg-ink-50" : "bg-ink-50 opacity-50") : cat.active ? "bg-white border border-ink-100" : "bg-white border border-ink-100 opacity-50"}`}
        style={{ marginLeft: depth > 1 ? depth * 12 : undefined }}
      >
        {hasChildren ? (
          <button type="button" onClick={() => onToggle(cat.id)} className="shrink-0 text-xs text-ink-500 hover:text-ink-900 w-4">
            {isExpanded ? "▼" : "▶"}
          </button>
        ) : (
          <span className="w-4" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {isRoot && <Badge variant="neutral">{cat.type}</Badge>}
            <span className="text-sm font-medium text-ink-900">{cat.name}</span>
            {!cat.active && <span className="text-xs text-ink-500">(inactive)</span>}
          </div>
          <p className="mt-0.5 text-xs text-ink-500">
            {hasChildren ? `${countDirectChildren(cat)} nested, ${countRecursive(cat)} product(s)` : `${cat._count?.products ?? 0} product(s)`}
          </p>
        </div>
        <button type="button" onClick={() => { const next = window.prompt("Rename category", cat.name); if (next) onRename(cat, next); }} className="shrink-0 text-xs font-medium text-brand-600 hover:underline">Rename</button>
        <button type="button" onClick={() => onDelete(cat)} className="shrink-0 text-xs font-medium text-ink-500 hover:text-ink-900 hover:underline">Delete</button>
        <button type="button" onClick={() => onToggleActive(cat)} className="shrink-0 text-xs font-medium text-brand-600 hover:underline">{cat.active ? "Deactivate" : "Activate"}</button>
      </div>
      {isExpanded && hasChildren && (
        <div className="mt-1.5 space-y-1.5">
          {cat.children!.map((ch) => (
            <CategoryNode key={ch.id} cat={ch} depth={depth + 1} expanded={expanded} onToggle={onToggle} onRename={onRename} onDelete={onDelete} onToggleActive={onToggleActive} />
          ))}
        </div>
      )}
    </div>
  );
}
function CategoryTreeList({
  categories,
  onChanged,
}: {
  categories: Category[];
  onChanged: () => void;
}) {
  const { toast } = useToast();
  const [subTab, setSubTab] = useState<"categories" | "subcategories">("categories");
  const [name, setName] = useState("");
  const [type, setType] = useState<CategoryType>("PHONE");
  const [subParentId, setSubParentId] = useState("");
  const [subName, setSubName] = useState("");
  const [saving, setSaving] = useState(false);
  const [savingSub, setSavingSub] = useState(false);
  const [expandedParents, setExpandedParents] = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const [deleting, setDeleting] = useState(false);

  const allOptions = flattenForSelect(categories);
  function toggleExpand(parentId: string) {
    setExpandedParents((prev) => {
      const next = new Set(prev);
      if (next.has(parentId)) next.delete(parentId);
      else next.add(parentId);
      return next;
    });
  }

  async function add() {
    if (!name.trim()) {
      toast("Name is required", "error");
      return;
    }
    setSaving(true);
    try {
      await apiRequest("/category", { method: "POST", body: { name: name.trim(), type } });
      setName("");
      onChanged();
      toast("Category added", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to add category", "error");
    } finally {
      setSaving(false);
    }
  }

  async function addSubcategory() {
    if (!subName.trim()) {
      toast("Name is required", "error");
      return;
    }
    if (!subParentId) {
      toast("Pick a parent category", "error");
      return;
    }
    const parent = findCategoryById(categories, subParentId);
    if (!parent) {
      toast("Parent not found", "error");
      return;
    }
    setSavingSub(true);
    try {
      await apiRequest("/category", { method: "POST", body: { name: subName.trim(), type: parent.type, parentId: subParentId } });
      setSubName("");
      onChanged();
      toast("Subcategory added", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to add subcategory", "error");
    } finally {
      setSavingSub(false);
    }
  }

  async function rename(cat: Category, nextName: string) {
    if (!nextName.trim() || nextName.trim() === cat.name) return;
    try {
      await apiRequest(`/category/${cat.id}`, { method: "PUT", body: { name: nextName.trim() } });
      onChanged();
      toast("Category renamed", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to rename", "error");
    }
  }

  async function toggleActive(cat: Category) {
    try {
      if (cat.active) {
        await apiRequest(`/category/${cat.id}/deactivate`, { method: "POST" });
        toast("Category deactivated", "success");
      } else {
        await apiRequest(`/category/${cat.id}`, { method: "PUT", body: { active: true } });
        toast("Category reactivated", "success");
      }
      onChanged();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to update", "error");
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiRequest(`/category/${deleteTarget.id}`, { method: "DELETE" });
      setDeleteTarget(null);
      onChanged();
      toast("Category deleted", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to delete", "error");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <SegmentedControl
        className="mt-5 w-full"
        value={subTab}
        options={[
          { value: "categories", label: "Categories" },
          { value: "subcategories", label: "Subcategories" },
        ]}
        onChange={(v) => setSubTab(v as "categories" | "subcategories")}
      />

      {subTab === "categories" ? (
        <>
          <div className="mt-5 flex items-end gap-2">
            <div className="flex-1">
              <label className="mb-1 block text-xs font-semibold text-ink-500">New category</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Refurbished" onKeyDown={(e) => { if (e.key === "Enter") void add(); }} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-ink-500">Type</label>
              <Dropdown value={type} options={[{ value: "PHONE", label: "Phone" }, { value: "ACCESSORY", label: "Accessory" }]} onChange={(value) => setType(value as CategoryType)} className="w-32" />
            </div>
            <Button onClick={add} loading={saving}>Add</Button>
          </div>

          <ScrollView className="mt-5">
            <div className="space-y-2">
              {categories.map((cat) => (
                <CategoryNode key={cat.id} cat={cat} depth={0} expanded={expandedParents} onToggle={toggleExpand} onRename={rename} onDelete={setDeleteTarget} onToggleActive={(c) => void toggleActive(c)} />
              ))}
            </div>
          </ScrollView>
        </>
      ) : (
        <>
          <div className="mt-5 flex items-end gap-2">
            <div className="flex-1">
              <label className="mb-1 block text-xs font-semibold text-ink-500">Parent category</label>
              <Dropdown value={subParentId} options={allOptions} onChange={(value) => setSubParentId(value)} placeholder="Select parent… (any level)" />
            </div>
            <div className="flex-1">
              <label className="mb-1 block text-xs font-semibold text-ink-500">Subcategory name</label>
              <Input value={subName} onChange={(e) => setSubName(e.target.value)} placeholder="e.g. Pouch › TPU" onKeyDown={(e) => { if (e.key === "Enter") void addSubcategory(); }} />
            </div>
            <Button onClick={addSubcategory} loading={savingSub}>Add</Button>
          </div>

          <ScrollView className="mt-5">
            <div className="space-y-2">
              {categories.map((cat) => (
                <CategoryNode key={cat.id} cat={cat} depth={0} expanded={expandedParents} onToggle={toggleExpand} onRename={rename} onDelete={setDeleteTarget} onToggleActive={(c) => void toggleActive(c)} />
              ))}
              {categories.length === 0 && <p className="py-4 text-center text-sm text-ink-400">No categories yet.</p>}
            </div>
          </ScrollView>
        </>
      )}

      <Dialog
        open={deleteTarget !== null}
        title="Delete category"
        message={deleteTarget ? `Delete "${deleteTarget.name}"? This permanently removes the category and cannot be undone. Categories with products or subcategories can't be deleted.` : ""}
        confirmLabel="Delete"
        destructive
        busy={deleting}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
}

function ViewTab({
  view,
  onViewChange,
}: {
  view: InventoryViewSettings;
  onViewChange: (next: InventoryViewSettings) => void;
}) {
  function toggleColumn(key: InventoryColumnKey) {
    onViewChange({ ...view, columns: { ...view.columns, [key]: !view.columns[key] } });
  }

  return (
    <div className="mt-5 space-y-5">
      <div>
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">View mode</p>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onViewChange({ ...view, mode: "units" })}
            className={`rounded-2xl px-4 py-3 text-sm font-semibold transition ${
              view.mode === "units" ? "bg-brand-600 text-white" : "bg-brand-50 text-brand-700 hover:bg-brand-100"
            }`}
          >
            Units
          </button>
          <button
            type="button"
            onClick={() => onViewChange({ ...view, mode: "quantity" })}
            className={`rounded-2xl px-4 py-3 text-sm font-semibold transition ${
              view.mode === "quantity" ? "bg-brand-600 text-white" : "bg-brand-50 text-brand-700 hover:bg-brand-100"
            }`}
          >
            Quantity
          </button>
        </div>
        <p className="mt-1.5 text-xs text-ink-400">
          Units shows every IMEI with vendor details. Quantity shows one row per model with stock totals.
        </p>
      </div>

      <div className="flex items-center justify-between rounded-2xl bg-ink-50 px-3.5 py-2">
        <div>
          <p className="text-sm font-semibold text-ink-900">Blur cost</p>
          <p className="text-xs text-ink-400">Hover to reveal. Cashiers stay blurred regardless.</p>
        </div>
        <Checkbox
          checked={view.blurCost}
          onChange={() => onViewChange({ ...view, blurCost: !view.blurCost })}
        />
      </div>

      <div>
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">Columns</p>
        <div className="grid grid-cols-2 gap-2">
          {INVENTORY_COLUMNS.map((c) => (
            <label
              key={c.key}
              className="flex cursor-pointer items-center gap-2.5 rounded-2xl bg-ink-50 px-3.5 py-2 text-sm font-medium text-ink-900"
            >
              <Checkbox checked={view.columns[c.key]} onChange={() => toggleColumn(c.key)} />
              {c.label}
            </label>
          ))}
        </div>
        <p className="mt-1.5 text-xs text-ink-400">Visible columns in the Units view.</p>
      </div>

      <div className="flex justify-start">
        <Button variant="grey" onClick={() => onViewChange(DEFAULT_INVENTORY_VIEW)}>
          Reset view
        </Button>
      </div>
    </div>
  );
}

function EntityList<T extends { id: string; name: string; active: boolean; _count?: { products?: number } }>({
  items,
  onChanged,
  path,
  noun,
  placeholder,
  hasType = false,
  renderExtra,
}: {
  items: T[];
  onChanged: () => void;
  path: string;
  noun: string;
  placeholder: string;
  hasType?: boolean;
  renderExtra?: (item: T) => ReactNode;
}) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [type, setType] = useState<CategoryType>("PHONE");
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<T | null>(null);
  const [deleting, setDeleting] = useState(false);
  const nounLabel = noun.charAt(0).toUpperCase() + noun.slice(1);
  const nounPlural = nounLabel + (noun.endsWith("y") ? "ies" : "s");

  async function add() {
    if (!name.trim()) {
      toast("Name is required", "error");
      return;
    }
    setSaving(true);
    try {
      await apiRequest(path, {
        method: "POST",
        body: hasType ? { name: name.trim(), type } : { name: name.trim() },
      });
      setName("");
      onChanged();
      toast(`${nounLabel} added`, "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : `Failed to add ${noun}`, "error");
    } finally {
      setSaving(false);
    }
  }

  async function rename(item: T, nextName: string) {
    if (!nextName.trim() || nextName.trim() === item.name) return;
    try {
      await apiRequest(`${path}/${item.id}`, { method: "PUT", body: { name: nextName.trim() } });
      onChanged();
      toast(`${nounLabel} renamed`, "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : `Failed to rename ${noun}`, "error");
    }
  }

  async function toggleActive(item: T) {
    try {
      if (item.active) {
        await apiRequest(`${path}/${item.id}/deactivate`, { method: "POST" });
        toast(`${nounLabel} deactivated`, "success");
      } else {
        await apiRequest(`${path}/${item.id}`, { method: "PUT", body: { active: true } });
        toast(`${nounLabel} reactivated`, "success");
      }
      onChanged();
    } catch (err) {
      toast(err instanceof Error ? err.message : `Failed to update ${noun}`, "error");
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiRequest(`${path}/${deleteTarget.id}`, { method: "DELETE" });
      setDeleteTarget(null);
      onChanged();
      toast(`${nounLabel} deleted`, "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to delete", "error");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <div className="mt-5 flex items-end gap-2">
        <div className="flex-1">
          <label className="mb-1 block text-xs font-semibold text-ink-500">New {noun}</label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={placeholder}
            onKeyDown={(e) => {
              if (e.key === "Enter") void add();
            }}
          />
        </div>
        {hasType && (
          <div>
            <label className="mb-1 block text-xs font-semibold text-ink-500">Type</label>
            <Dropdown
              value={type}
              options={[
                { value: "PHONE", label: "Phone" },
                { value: "ACCESSORY", label: "Accessory" },
              ]}
              onChange={(value) => setType(value as CategoryType)}
              className="w-32"
            />
          </div>
        )}
        <Button onClick={add} loading={saving}>
          Add
        </Button>
      </div>

      <ScrollView className="mt-5">
        <div className="space-y-2">
          {items.map((item) => (
            <div
              key={item.id}
              className={`flex items-center gap-3 rounded-2xl px-3.5 py-2.5 ${
                item.active ? "bg-ink-50" : "bg-ink-50 opacity-50"
              }`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  {renderExtra?.(item)}
                  <span className="text-sm font-medium text-ink-900">{item.name}</span>
                  {!item.active && <span className="text-xs text-ink-500">(inactive)</span>}
                </div>
                {item._count && (
                  <p className="mt-0.5 text-xs text-ink-500">{item._count.products ?? 0} product(s)</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  const next = window.prompt(`Rename ${noun}`, item.name);
                  if (next) void rename(item, next);
                }}
                className="shrink-0 text-xs font-medium text-brand-600 hover:underline"
              >
                Rename
              </button>
              <button
                type="button"
                onClick={() => setDeleteTarget(item)}
                className="shrink-0 text-xs font-medium text-ink-500 hover:text-ink-900 hover:underline"
              >
                Delete
              </button>
              <button
                type="button"
                onClick={() => void toggleActive(item)}
                className="shrink-0 text-xs font-medium text-brand-600 hover:underline"
              >
                {item.active ? "Deactivate" : "Activate"}
              </button>
            </div>
          ))}
        </div>
      </ScrollView>

      <Dialog
        open={deleteTarget !== null}
        title={`Delete ${noun}`}
        message={
          deleteTarget
            ? `Delete "${deleteTarget.name}"? This permanently removes the ${noun} and cannot be undone.${deleteTarget._count ? ` ${nounPlural} with products can't be deleted.` : ""}`
            : ""
        }
        confirmLabel="Delete"
        destructive
        busy={deleting}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
}
