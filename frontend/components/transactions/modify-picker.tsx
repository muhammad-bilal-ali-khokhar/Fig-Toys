"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiRequest } from "@/lib/apiClient";
import type { Transaction } from "@/lib/api-types";
import { formatPKR } from "@/lib/money";
import { formatDateTime } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet } from "@/components/ui/sheet";
import { SearchInput } from "@/components/ui/search-input";

const TYPE_LABELS: Record<string, string> = {
  SALE: "Sale",
  PURCHASE: "Purchase",
  SALE_RETURN: "Sale Return",
  PURCHASE_RETURN: "Purchase Return",
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
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Transaction[]>([]);
  const [searching, setSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!open) {
      setQ("");
      setResults([]);
    }
  }, [open]);

  const runSearch = useCallback(
    async (term: string) => {
      const query = term.trim();
      if (query.length < 2) {
        setResults([]);
        return;
      }
      setSearching(true);
      try {
        const found = await apiRequest<Transaction[]>(
          `/transaction?type=${type}&q=${encodeURIComponent(query)}&limit=20`,
        );
        setResults(found);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    },
    [type],
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(() => {
      void runSearch(q);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [q, runSearch]);

  function pick(txn: Transaction) {
    onSelect(txn);
    onClose();
  }

  return (
    <Sheet open={open} title={`Modify ${TYPE_LABELS[type] ?? type}`} onClose={onClose}>
      <div>
        <SearchInput
          value={q}
          onChange={setQ}
          placeholder="Search by number, customer, or product…"
          autoFocus
        />
        <div className="mt-3 max-h-[50vh] space-y-1.5 overflow-y-auto overscroll-none">
          {searching && <p className="p-4 text-center text-sm text-ink-400">Searching…</p>}
          {!searching && q.trim().length >= 2 && results.length === 0 && (
            <p className="p-4 text-center text-sm text-ink-400">No documents found.</p>
          )}
          {results.map((txn) => (
            <button
              key={txn.id}
              type="button"
              onClick={() => pick(txn)}
              className="w-full rounded-xl bg-ink-50 p-3 text-left transition hover:bg-brand-50"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-ink-900">
                    {txn.number} · {txn.contact.name}
                  </p>
                  <p className="mt-0.5 text-xs text-ink-500">
                    {formatDateTime(txn.createdAt, " · ")} · {txn._count.items} item(s)
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={txn.status === "PAID" ? "success" : txn.status === "PARTIAL" ? "warning" : "neutral"}>
                    {txn.status}
                  </Badge>
                  <span className="text-sm font-bold text-ink-900">{formatPKR(txn.total)}</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </Sheet>
  );
}
