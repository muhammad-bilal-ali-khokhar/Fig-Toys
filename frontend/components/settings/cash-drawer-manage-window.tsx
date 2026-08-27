"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiRequest } from "@/lib/apiClient";
import type { CashDrawer, Category } from "@/lib/api-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dropdown } from "@/components/ui/dropdown";
import { Sheet } from "@/components/ui/sheet";
import { Dialog } from "@/components/ui/dialog";
import { ScrollView } from "@/components/ui/scroll-view";
import { useToast } from "@/components/ui/toast";
import { CheckIcon, TrashIcon } from "@/components/icons";

export function CashDrawerManageWindow({
  open,
  onClose,
  onChanged,
}: {
  open: boolean;
  onClose: () => void;
  onChanged?: () => void;
}) {
  const { toast } = useToast();
  const [drawers, setDrawers] = useState<CashDrawer[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CashDrawer | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [assigningDrawerId, setAssigningDrawerId] = useState<string | null>(null);
  const [assignCategoryId, setAssignCategoryId] = useState("");

  const flatCategories = useMemo(() => {
    const out: Category[] = [];
    for (const c of categories) {
      out.push(c);
      if (c.children) {
        for (const child of c.children) out.push(child);
      }
    }
    return out;
  }, [categories]);

  const categoryMap = useMemo(() => {
    const m = new Map<string, Category>();
    for (const c of flatCategories) m.set(c.id, c);
    return m;
  }, [flatCategories]);

  function categoriesForDrawer(drawerId: string) {
    return flatCategories.filter((c) => c.defaultCashDrawer?.id === drawerId);
  }

  function unassignedCategories(drawerId: string) {
    return flatCategories.filter((c) => !c.defaultCashDrawer || c.defaultCashDrawer.id === drawerId);
  }

  const load = useCallback(async () => {
    try {
      const [d, c] = await Promise.all([
        apiRequest<CashDrawer[]>("/cash-drawer"),
        apiRequest<Category[]>("/category"),
      ]);
      setDrawers(d ?? []);
      setCategories(c ?? []);
    } catch {
      setDrawers([]);
      setCategories([]);
    }
  }, []);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  async function add() {
    if (!name.trim()) {
      toast("Name is required", "error");
      return;
    }
    setSaving(true);
    try {
      await apiRequest("/cash-drawer", { method: "POST", body: { name: name.trim() } });
      setName("");
      await load();
      onChanged?.();
      toast("Drawer added", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to add drawer", "error");
    } finally {
      setSaving(false);
    }
  }

  async function saveEdit(id: string) {
    if (!editName.trim()) {
      toast("Name is required", "error");
      return;
    }
    try {
      await apiRequest(`/cash-drawer/${id}`, { method: "PUT", body: { name: editName.trim() } });
      setEditingId(null);
      await load();
      onChanged?.();
      toast("Drawer renamed", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to rename drawer", "error");
    }
  }

  async function setDefault(id: string) {
    try {
      await apiRequest(`/cash-drawer/${id}/default`, { method: "POST" });
      await load();
      onChanged?.();
      toast("Default drawer updated", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to set default", "error");
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiRequest(`/cash-drawer/${deleteTarget.id}`, { method: "DELETE" });
      setDeleteTarget(null);
      await load();
      onChanged?.();
      toast("Drawer deleted", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to delete drawer", "error");
    } finally {
      setDeleting(false);
    }
  }

  async function assignCategory(categoryId: string, drawerId: string) {
    if (!categoryId) return;
    try {
      await apiRequest(`/category/${categoryId}`, { method: "PUT", body: { defaultCashDrawerId: drawerId } });
      setAssigningDrawerId(null);
      setAssignCategoryId("");
      await load();
      onChanged?.();
      toast("Category assigned", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to assign category", "error");
    }
  }

  async function unassignCategory(categoryId: string) {
    try {
      await apiRequest(`/category/${categoryId}`, { method: "PUT", body: { defaultCashDrawerId: null } });
      await load();
      onChanged?.();
      toast("Category unassigned", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to unassign category", "error");
    }
  }

  return (
    <Sheet open={open} title="Manage cash drawers" onClose={onClose} width="max-w-xl">
      <p className="mt-3 text-xs text-ink-500">
        Cash drawers split your cash balance by category. Assign a drawer to a category and cash from sales of that category auto-routes there.
      </p>

      <div className="mt-4 flex items-end gap-2">
        <div className="flex-1">
          <label className="mb-1 block text-xs font-semibold text-ink-500">New drawer</label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. New Phones"
            onKeyDown={(e) => { if (e.key === "Enter") void add(); }}
          />
        </div>
        <Button onClick={add} loading={saving}>Add</Button>
      </div>

      <ScrollView className="mt-4">
        <div className="space-y-3">
          {drawers.map((d) => {
            const assigned = categoriesForDrawer(d.id);
            const opts = unassignedCategories(d.id).filter((c) => !c.defaultCashDrawer);
            return (
              <div key={d.id} className="rounded-2xl bg-ink-50 px-3.5 py-2.5">
                {editingId === d.id ? (
                  <div className="flex min-w-0 items-center gap-2">
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") void saveEdit(d.id); if (e.key === "Escape") setEditingId(null); }}
                      className="flex-1"
                      autoFocus
                    />
                    <Button size="sm" onClick={() => void saveEdit(d.id)}>Save</Button>
                    <Button size="sm" variant="secondary" onClick={() => setEditingId(null)}>Cancel</Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 truncate text-sm font-medium text-ink-900">
                        {d.name}
                        {d.isDefault && <span className="rounded-lg bg-brand-100 px-1.5 py-0.5 text-[10px] font-semibold text-brand-700">Default</span>}
                      </p>
                      <p className="text-xs text-ink-400">Balance: Rs {Number(d.balance).toLocaleString()}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {!d.isDefault && (
                        <button
                          type="button"
                          onClick={() => void setDefault(d.id)}
                          className="text-xs font-medium text-brand-600 hover:underline"
                        >
                          Set default
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => { setEditingId(d.id); setEditName(d.name); }}
                        className="text-xs font-medium text-brand-600 hover:underline"
                      >
                        Rename
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(d)}
                        className="text-xs font-medium text-ink-500 hover:text-ink-900 hover:underline"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )}

                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {assigned.map((c) => (
                    <span key={c.id} className="inline-flex items-center gap-1 rounded-full bg-brand-100 px-2 py-0.5 text-[11px] font-medium text-brand-700">
                      {c.name}
                      <button
                        type="button"
                        onClick={() => void unassignCategory(c.id)}
                        className="ml-0.5 rounded-full hover:bg-brand-200"
                        title="Remove"
                      >
                        <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={2} className="h-2.5 w-2.5">
                          <path d="M3 3l6 6M9 3l-6 6" />
                        </svg>
                      </button>
                    </span>
                  ))}
                  {assigned.length === 0 && (
                    <span className="text-[11px] text-ink-400">No categories assigned</span>
                  )}
                  {assigningDrawerId === d.id ? (
                    <span className="inline-flex items-center gap-1">
                      <Dropdown
                        value={assignCategoryId || null}
                        options={opts.map((c) => ({ value: c.id, label: c.name }))}
                        onChange={(v) => { setAssignCategoryId(v); void assignCategory(v, d.id); }}
                        placeholder="Select category"
                        searchable
                        className="h-6 w-32 text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => { setAssigningDrawerId(null); setAssignCategoryId(""); }}
                        className="text-[11px] text-ink-400 hover:text-ink-600"
                      >
                        Cancel
                      </button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => { setAssigningDrawerId(d.id); setAssignCategoryId(""); }}
                      className="inline-flex items-center gap-0.5 rounded-full border border-dashed border-brand-300 px-2 py-0.5 text-[11px] font-medium text-brand-600 hover:bg-brand-50"
                    >
                      <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={2} className="h-2.5 w-2.5">
                        <path d="M6 2v8M2 6h8" />
                      </svg>
                      Assign
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          {drawers.length === 0 && (
            <p className="py-6 text-center text-sm text-ink-400">
              No cash drawers yet. Add one to start splitting cash by category.
            </p>
          )}
        </div>
      </ScrollView>

      <Dialog
        open={deleteTarget !== null}
        title="Delete drawer"
        message={
          deleteTarget
            ? `Delete "${deleteTarget.name}"? Categories using this drawer will fall back to the default. Existing movements keep their records.`
            : ""
        }
        confirmLabel="Delete"
        destructive
        busy={deleting}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleteTarget(null)}
      />
    </Sheet>
  );
}
