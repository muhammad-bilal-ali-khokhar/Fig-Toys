"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiRequest } from "@/lib/apiClient";
import type { Bank } from "@/lib/api-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet } from "@/components/ui/sheet";
import { Dialog } from "@/components/ui/dialog";
import { ScrollView } from "@/components/ui/scroll-view";
import { useToast } from "@/components/ui/toast";

export function BankManageWindow({
  open,
  onClose,
  onChanged,
}: {
  open: boolean;
  onClose: () => void;
  onChanged?: () => void;
}) {
  const { toast } = useToast();
  const [banks, setBanks] = useState<Bank[]>([]);
  const [name, setName] = useState("");
  const [filter, setFilter] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Bank | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    try {
      setBanks(await apiRequest<Bank[]>("/bank"));
    } catch {
      setBanks([]);
    }
  }, []);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return banks;
    return banks.filter((b) => b.name.toLowerCase().includes(q));
  }, [banks, filter]);

  async function add() {
    if (!name.trim()) {
      toast("Name is required", "error");
      return;
    }
    setSaving(true);
    try {
      await apiRequest("/bank", { method: "POST", body: { name: name.trim() } });
      setName("");
      await load();
      onChanged?.();
      toast("Bank added", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to add bank", "error");
    } finally {
      setSaving(false);
    }
  }

  async function rename(bank: Bank) {
    const next = window.prompt("Rename bank", bank.name);
    if (!next || next.trim() === bank.name) return;
    try {
      await apiRequest(`/bank/${bank.id}`, { method: "PUT", body: { name: next.trim() } });
      await load();
      onChanged?.();
      toast("Bank renamed", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to rename bank", "error");
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiRequest(`/bank/${deleteTarget.id}`, { method: "DELETE" });
      setDeleteTarget(null);
      await load();
      onChanged?.();
      toast("Bank deleted", "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to delete bank", "error");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Sheet open={open} title="Manage banks" onClose={onClose} width="max-w-xl">
      <div className="mt-5 flex items-end gap-2">
        <div className="flex-1">
          <label className="mb-1 block text-xs font-semibold text-ink-500">New bank</label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Meezan Bank"
            onKeyDown={(e) => {
              if (e.key === "Enter") void add();
            }}
          />
        </div>
        <Button onClick={add} loading={saving}>
          Add
        </Button>
      </div>

      <div className="mt-3">
        <Input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Search banks…"
          variant="white"
        />
      </div>

      <ScrollView className="mt-3">
        <div className="space-y-2">
          {visible.map((bank) => (
            <div
              key={bank.id}
              className="flex items-center gap-3 rounded-2xl bg-ink-50 px-3.5 py-2.5"
            >
              <span className="min-w-0 flex-1 text-sm font-medium text-ink-900">{bank.name}</span>
              <button
                type="button"
                onClick={() => void rename(bank)}
                className="shrink-0 text-xs font-medium text-brand-600 hover:underline"
              >
                Rename
              </button>
              <button
                type="button"
                onClick={() => setDeleteTarget(bank)}
                className="shrink-0 text-xs font-medium text-ink-500 hover:text-ink-900 hover:underline"
              >
                Delete
              </button>
            </div>
          ))}
          {visible.length === 0 && (
            <p className="py-6 text-center text-sm text-ink-400">No banks found.</p>
          )}
        </div>
      </ScrollView>

      <Dialog
        open={deleteTarget !== null}
        title="Delete bank"
        message={
          deleteTarget
            ? `Delete "${deleteTarget.name}"? This removes it from the bank list. Existing accounts keep their records.`
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
