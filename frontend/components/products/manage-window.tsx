"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { apiRequest } from "@/lib/apiClient";
import type { Brand, Category, CategoryType, Color } from "@/lib/api-types";
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

type ManageTab = "view" | "category" | "brand" | "color";

export function ManageWindow({
  categories,
  brands,
  colors,
  initialTab,
  onClose,
  onChanged,
  view,
  onViewChange,
  title = "Manage categories, brands & colors",
}: {
  categories?: Category[];
  brands?: Brand[];
  colors?: Color[];
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
      ) : (
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
      )}
    </Sheet>
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

  const parentCategories = categories.filter((c) => !c.parentId);
  const childrenMap = new Map<string, Category[]>();
  for (const c of categories) {
    if (c.parentId) {
      const list = childrenMap.get(c.parentId) ?? [];
      list.push(c);
      childrenMap.set(c.parentId, list);
    }
  }

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
      await apiRequest("/category", {
        method: "POST",
        body: { name: name.trim(), type },
      });
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
    const parent = categories.find((c) => c.id === subParentId);
    if (!parent) return;
    setSavingSub(true);
    try {
      await apiRequest("/category", {
        method: "POST",
        body: { name: subName.trim(), type: parent.type, parentId: subParentId },
      });
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

  const totalProductCount = (cat: Category) => {
    const children = childrenMap.get(cat.id) ?? [];
    const childProductCount = children.reduce((sum, ch) => sum + (ch._count?.products ?? 0), 0);
    return (cat._count?.products ?? 0) + childProductCount;
  };

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
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Refurbished"
                onKeyDown={(e) => {
                  if (e.key === "Enter") void add();
                }}
              />
            </div>
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
            <Button onClick={add} loading={saving}>
              Add
            </Button>
          </div>

          <ScrollView className="mt-5">
            <div className="space-y-2">
              {parentCategories.map((parent) => {
                const children = childrenMap.get(parent.id) ?? [];
                const isExpanded = expandedParents.has(parent.id);
                return (
                  <div key={parent.id}>
                    <div
                      className={`flex items-center gap-3 rounded-2xl px-3.5 py-2.5 ${
                        parent.active ? "bg-ink-50" : "bg-ink-50 opacity-50"
                      }`}
                    >
                      {children.length > 0 ? (
                        <button
                          type="button"
                          onClick={() => toggleExpand(parent.id)}
                          className="shrink-0 text-xs text-ink-500 hover:text-ink-900 w-4"
                        >
                          {isExpanded ? "▼" : "▶"}
                        </button>
                      ) : (
                        <span className="w-4" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="neutral">{parent.type}</Badge>
                          <span className="text-sm font-medium text-ink-900">{parent.name}</span>
                          {!parent.active && <span className="text-xs text-ink-500">(inactive)</span>}
                        </div>
                        <p className="mt-0.5 text-xs text-ink-500">
                          {children.length > 0
                            ? `${children.length} subcategor${children.length === 1 ? "y" : "ies"}, ${totalProductCount(parent)} product(s)`
                            : `${parent._count?.products ?? 0} product(s)`}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const next = window.prompt("Rename category", parent.name);
                          if (next) void rename(parent, next);
                        }}
                        className="shrink-0 text-xs font-medium text-brand-600 hover:underline"
                      >
                        Rename
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(parent)}
                        className="shrink-0 text-xs font-medium text-ink-500 hover:text-ink-900 hover:underline"
                      >
                        Delete
                      </button>
                      <button
                        type="button"
                        onClick={() => void toggleActive(parent)}
                        className="shrink-0 text-xs font-medium text-brand-600 hover:underline"
                      >
                        {parent.active ? "Deactivate" : "Activate"}
                      </button>
                    </div>

                    {isExpanded && children.length > 0 && (
                      <div className="ml-7 space-y-1.5 mt-1.5">
                        {children.map((child) => (
                          <div
                            key={child.id}
                            className={`flex items-center gap-3 rounded-2xl px-3.5 py-2.5 ${
                              child.active ? "bg-white border border-ink-100" : "bg-white border border-ink-100 opacity-50"
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-ink-900">{child.name}</span>
                                {!child.active && <span className="text-xs text-ink-500">(inactive)</span>}
                              </div>
                              <p className="mt-0.5 text-xs text-ink-500">{child._count?.products ?? 0} product(s)</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                const next = window.prompt("Rename subcategory", child.name);
                                if (next) void rename(child, next);
                              }}
                              className="shrink-0 text-xs font-medium text-brand-600 hover:underline"
                            >
                              Rename
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(child)}
                              className="shrink-0 text-xs font-medium text-ink-500 hover:text-ink-900 hover:underline"
                            >
                              Delete
                            </button>
                            <button
                              type="button"
                              onClick={() => void toggleActive(child)}
                              className="shrink-0 text-xs font-medium text-brand-600 hover:underline"
                            >
                              {child.active ? "Deactivate" : "Activate"}
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollView>
        </>
      ) : (
        <>
          <div className="mt-5 flex items-end gap-2">
            <div className="flex-1">
              <label className="mb-1 block text-xs font-semibold text-ink-500">Parent category</label>
              <Dropdown
                value={subParentId}
                options={parentCategories.map((c) => ({ value: c.id, label: c.name }))}
                onChange={(value) => setSubParentId(value)}
                placeholder="Select parent…"
              />
            </div>
            <div className="flex-1">
              <label className="mb-1 block text-xs font-semibold text-ink-500">Subcategory name</label>
              <Input
                value={subName}
                onChange={(e) => setSubName(e.target.value)}
                placeholder="e.g. Cases & Covers"
                onKeyDown={(e) => {
                  if (e.key === "Enter") void addSubcategory();
                }}
              />
            </div>
            <Button onClick={addSubcategory} loading={savingSub}>
              Add
            </Button>
          </div>

          <ScrollView className="mt-5">
            <div className="space-y-3">
              {parentCategories.map((parent) => {
                const children = childrenMap.get(parent.id) ?? [];
                if (children.length === 0) return null;
                return (
                  <div key={parent.id}>
                    <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">{parent.name}</p>
                    <div className="space-y-1.5">
                      {children.map((child) => (
                        <div
                          key={child.id}
                          className={`flex items-center gap-3 rounded-2xl px-3.5 py-2.5 ${
                            child.active ? "bg-ink-50" : "bg-ink-50 opacity-50"
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-ink-900">{child.name}</span>
                              {!child.active && <span className="text-xs text-ink-500">(inactive)</span>}
                            </div>
                            <p className="mt-0.5 text-xs text-ink-500">{child._count?.products ?? 0} product(s)</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const next = window.prompt("Rename subcategory", child.name);
                              if (next) void rename(child, next);
                            }}
                            className="shrink-0 text-xs font-medium text-brand-600 hover:underline"
                          >
                            Rename
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(child)}
                            className="shrink-0 text-xs font-medium text-ink-500 hover:text-ink-900 hover:underline"
                          >
                            Delete
                          </button>
                          <button
                            type="button"
                            onClick={() => void toggleActive(child)}
                            className="shrink-0 text-xs font-medium text-brand-600 hover:underline"
                          >
                            {child.active ? "Deactivate" : "Activate"}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
              {parentCategories.every((p) => (childrenMap.get(p.id) ?? []).length === 0) && (
                <p className="py-4 text-center text-sm text-ink-400">No subcategories yet. Pick a parent category above and add one.</p>
              )}
            </div>
          </ScrollView>
        </>
      )}

      <Dialog
        open={deleteTarget !== null}
        title="Delete category"
        message={
          deleteTarget
            ? `Delete "${deleteTarget.name}"? This permanently removes the category and cannot be undone. Categories with products or subcategories can't be deleted.`
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
                <p className="mt-0.5 text-xs text-ink-500">{item._count?.products ?? 0} product(s)</p>
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
            ? `Delete "${deleteTarget.name}"? This permanently removes the ${noun} and cannot be undone. ${nounPlural} with products can't be deleted.`
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
