"use client";

import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/apiClient";
import type { Transaction } from "@/lib/api-types";
import { formatPKR } from "@/lib/money";
import { formatDateTime } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { Dropdown, type DropdownOption } from "@/components/ui/dropdown";

const TYPE_LABELS: Record<string, string> = {
  SALE: "Sale",
  PURCHASE: "Purchase",
  SALE_RETURN: "Sale Return",
  PURCHASE_RETURN: "Purchase Return",
};

const TYPE_PREFIX: Record<string, string> = {
  SALE: "SAL-",
  PURCHASE: "PUR-",
  SALE_RETURN: "RET-",
  PURCHASE_RETURN: "PCR-",
};

export function ModifyPicker({
  open,
  onClose,
  type,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  type: "SALE" | "PURCHASE" | "SALE_RETURN" | "PURCHASE_RETURN";
  onSelect: (txn: Transaction) => void;
}) {
  const [docs, setDocs] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setSelectedId(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const found = await apiRequest<Transaction[]>(
          `/transaction?type=${type}&limit=100`,
        );
        if (!cancelled) setDocs(found);
      } catch {
        if (!cancelled) setDocs([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, type]);

  const options: DropdownOption<string>[] = (docs ?? []).map((t) => ({
    value: t.id,
    label: `${t.number} · ${t.contact.name} · ${formatPKR(t.total)}`,
    trailing: (
      <span className="text-xs text-ink-400">{formatDateTime(t.createdAt, " ")}</span>
    ),
  }));

  function confirm() {
    const txn = docs.find((t) => t.id === selectedId);
    if (txn) {
      onSelect(txn);
      onClose();
    }
  }

  return (
    <Sheet open={open} title={`Modify ${TYPE_LABELS[type] ?? type}`} onClose={onClose}>
      <div>
        <p className="mb-3 text-sm text-ink-500">
          Pick the {TYPE_LABELS[type]?.toLowerCase()} document to edit.
        </p>
        <Dropdown
          value={selectedId}
          options={options}
          onChange={setSelectedId}
          placeholder={loading ? "Loading…" : "Select a document…"}
          searchable
          defaultFilter={TYPE_PREFIX[type] ?? ""}
        />
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="grey" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={confirm} disabled={!selectedId}>
            Modify
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
