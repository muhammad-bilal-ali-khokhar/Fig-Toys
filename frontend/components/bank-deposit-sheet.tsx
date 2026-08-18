"use client";

import type { BankAccount } from "@/lib/api-types";
import { clampMoneyInput } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dropdown } from "@/components/ui/dropdown";
import { Sheet } from "@/components/ui/sheet";
import { PlusIcon, XIcon } from "@/components/icons";

export type BankRow = { id: string; amount: string; bankId: string };

export function BankDepositSheet({
  open,
  onClose,
  bankRows,
  onBankRowsChange,
  bankAccounts,
}: {
  open: boolean;
  onClose: () => void;
  bankRows: BankRow[];
  onBankRowsChange: React.Dispatch<React.SetStateAction<BankRow[]>>;
  bankAccounts: BankAccount[];
}) {
  function addRow() {
    const used = bankRows.map((r) => r.bankId);
    const next = bankAccounts.find((b) => !used.includes(b.id));
    const id = next?.id ?? "";
    onBankRowsChange((r) => [...r, { id: crypto.randomUUID(), amount: "", bankId: id }]);
  }

  return (
    <Sheet open={open} title="Bank deposits" onClose={onClose} width="max-w-2xl">
      <div className="space-y-3">
        {bankAccounts.length === 0 ? (
          <p className="rounded-2xl bg-ink-100 px-3.5 py-2 text-xs text-ink-500">
            No registered bank accounts. Add them in Settings.
          </p>
        ) : (
          bankRows.map((row) => (
            <div key={row.id} className="flex items-center gap-2">
              <Dropdown
                value={row.bankId}
                options={bankAccounts
                  .filter((b) => b.id === row.bankId || !bankRows.some((x) => x.id !== row.id && x.bankId === b.id))
                  .map((b) => ({
                    value: b.id,
                    label: b.bankName,
                    trailing: (
                      <span className="text-xs text-ink-400">
                        {b.name} · {b.accountNo}
                      </span>
                    ),
                  }))}
                onChange={(v) =>
                  onBankRowsChange((r) =>
                    r.map((x) => (x.id === row.id ? { ...x, bankId: v } : x))
                  )
                }
                className="flex-1"
                trigger={(open) => (
                  <div className={`flex h-9 items-center justify-between rounded-2xl bg-ink-100 px-3.5 text-sm ${open ? "ring-2 ring-brand-500/60" : ""}`}>
                    <span className="truncate text-ink-900">
                      {bankAccounts.find((b) => b.id === row.bankId)?.bankName ?? "Pick bank…"}
                    </span>
                  </div>
                )}
              />
              <Input
                value={row.amount}
                onChange={(e) =>
                  onBankRowsChange((r) =>
                    r.map((x) => (x.id === row.id ? { ...x, amount: clampMoneyInput(e.target.value) } : x))
                  )
                }
                placeholder="Amount"
                inputMode="decimal"
                className="min-w-0 w-32"
              />
              <button
                type="button"
                aria-label="Remove bank"
                className="rounded-lg p-2 text-ink-400 transition hover:bg-ink-100 hover:text-ink-900"
                onClick={() => onBankRowsChange((r) => r.filter((x) => x.id !== row.id))}
              >
                <XIcon className="h-4 w-4" />
              </button>
            </div>
          ))
        )}
        {bankAccounts.length > 0 && bankRows.length < bankAccounts.length && (
          <Button
            variant="secondary"
            className="w-full text-xs"
            onClick={addRow}
          >
            <PlusIcon className="mr-1 h-3.5 w-3.5" />
            Add bank
          </Button>
        )}
      </div>
    </Sheet>
  );
}
