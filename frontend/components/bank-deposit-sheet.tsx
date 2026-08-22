"use client";

import Link from "next/link";
import type { BankAccount } from "@/lib/api-types";
import { clampMoneyInput, formatPKR } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dropdown } from "@/components/ui/dropdown";
import { Sheet } from "@/components/ui/sheet";
import { PlusIcon, WalletIcon, XIcon } from "@/components/icons";

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
  const total = bankRows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);

  function addRow() {
    const used = bankRows.map((r) => r.bankId);
    const next = bankAccounts.find((b) => !used.includes(b.id));
    const id = next?.id ?? bankAccounts[0]?.id ?? "";
    onBankRowsChange((r) => [...r, { id: crypto.randomUUID(), amount: "", bankId: id }]);
  }

  return (
    <Sheet open={open} title="Bank deposits" onClose={onClose} width="max-w-lg">
      <p className=" -mt-2 text-xs text-ink-500">Split payment across banks. Each bank can be used once.</p>

      {bankAccounts.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-ink-200 bg-ink-50/50 px-6 py-10 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-ink-400">
            <WalletIcon className="h-6 w-6" />
          </div>
          <p className="mt-3 text-sm font-semibold text-ink-900">No bank accounts yet</p>
          <p className="mx-auto mt-1 max-w-[260px] text-xs leading-relaxed text-ink-500">
            Add your banks in Settings first, then you can split any payment across them.
          </p>
          <Link href="/settings" onClick={onClose} className="mt-4 inline-flex">
            <Button variant="secondary" size="sm">Go to Settings</Button>
          </Link>
        </div>
      ) : bankRows.length === 0 ? (
        <div className="mt-4 space-y-4">
          <div className="rounded-2xl border border-dashed border-brand-200 bg-brand-50/40 px-6 py-8 text-center">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-white text-brand-600">
              <WalletIcon className="h-5 w-5" />
            </div>
            <p className="mt-3 text-sm font-semibold text-ink-900">No banks added to this invoice</p>
            <p className="mt-1 text-xs text-ink-500">Distribute the amount across your {bankAccounts.length} bank account(s).</p>
            <Button variant="primary" size="sm" className="mt-4" onClick={addRow}>
              <PlusIcon className="h-3.5 w-3.5" />
              Add bank
            </Button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {bankAccounts.map((b) => (
              <span key={b.id} className="rounded-full bg-ink-100 px-2.5 py-1 text-xs text-ink-600">
                {b.bankName} · {b.accountNo.slice(-4)}
              </span>
            ))}
          </div>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {bankRows.map((row, idx) => {
            const selected = bankAccounts.find((b) => b.id === row.bankId);
            return (
              <div key={row.id} className="rounded-2xl border border-ink-100 bg-white p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="flex items-center gap-2 text-xs font-semibold text-ink-500">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-50 text-xs font-bold text-brand-600">
                      {idx + 1}
                    </span>
                    Bank #{idx + 1}
                  </span>
                  <button
                    type="button"
                    aria-label="Remove bank"
                    className="rounded-lg p-1.5 text-ink-400 transition hover:bg-ink-100 hover:text-error"
                    onClick={() => onBankRowsChange((r) => r.filter((x) => x.id !== row.id))}
                  >
                    <XIcon className="h-4 w-4" />
                  </button>
                </div>
                <div className="grid gap-2 sm:grid-cols-[1.35fr_0.85fr]">
                  <div>
                    <p className="mb-1 text-xs font-medium text-ink-500">Bank</p>
                    <Dropdown
                      value={row.bankId}
                      options={bankAccounts
                        .filter((b) => b.id === row.bankId || !bankRows.some((x) => x.id !== row.id && x.bankId === b.id))
                        .map((b) => ({
                          value: b.id,
                          label: b.bankName,
                          trailing: <span className="text-xs text-ink-400">{b.name} · {b.accountNo}</span>,
                        }))}
                      onChange={(v) => onBankRowsChange((r) => r.map((x) => (x.id === row.id ? { ...x, bankId: v } : x)))}
                      placeholder="Pick bank…"
                      searchable
                      className="w-full"
                      trigger={(open) => (
                        <div className={`flex h-9 items-center justify-between rounded-2xl bg-ink-100 px-3.5 text-sm ${open ? "ring-2 ring-brand-500/60" : ""}`}>
                          <span className="truncate text-ink-900">{selected ? `${selected.bankName} · ${selected.accountNo.slice(-4)}` : "Pick bank…"}</span>
                        </div>
                      )}
                    />
                  </div>
                  <div>
                    <p className="mb-1 text-xs font-medium text-ink-500">Amount (Rs)</p>
                    <Input
                      value={row.amount}
                      onChange={(e) => onBankRowsChange((r) => r.map((x) => (x.id === row.id ? { ...x, amount: clampMoneyInput(e.target.value) } : x)))}
                      placeholder="0"
                      inputMode="decimal"
                      prefix="Rs"
                      variant="filled"
                    />
                  </div>
                </div>
              </div>
            );
          })}

          {bankRows.length < bankAccounts.length ? (
            <button
              type="button"
              onClick={addRow}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-brand-200 bg-brand-50/40 px-4 py-3 text-sm font-semibold text-brand-700 transition hover:bg-brand-50"
            >
              <PlusIcon className="h-4 w-4" />
              Add another bank
            </button>
          ) : (
            <p className="rounded-xl bg-ink-50 px-3 py-2 text-center text-xs text-ink-500">All {bankAccounts.length} bank account(s) added.</p>
          )}

          <div className="flex items-center justify-between rounded-2xl bg-ink-900 px-4 py-3 text-white">
            <span className="text-xs font-medium text-white/70">Total bank</span>
            <span className="text-sm font-bold">{formatPKR(total)}</span>
          </div>
        </div>
      )}

      <div className="mt-6 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>Done</Button>
      </div>
    </Sheet>
  );
}
