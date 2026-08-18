"use client";

import type { BankAccount } from "@/lib/api-types";
import { formatPKR } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { PlusIcon } from "@/components/icons";

export type BankRow = { id: string; amount: string; bankId: string };

export function BankPaymentRow({
  bankRows,
  bankAccounts,
  onBankSheetOpen,
  onAddBank,
  fillLabel,
  onFill,
  fillDisabled,
}: {
  bankRows: BankRow[];
  bankAccounts: BankAccount[];
  onBankSheetOpen: () => void;
  onAddBank: () => void;
  fillLabel: string;
  onFill: () => void;
  fillDisabled?: boolean;
}) {
  return (
    <>
      {bankRows.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-ink-50 px-3 py-2">
          {bankRows.map((row) => {
            const bank = bankAccounts.find((b) => b.id === row.bankId);
            return (
              <span key={row.id} className="text-xs text-ink-700">
                {bank?.bankName ?? "Bank"} · {row.amount ? formatPKR(parseFloat(row.amount)) : "—"}
              </span>
            );
          })}
          <Button variant="ghost" className="px-2 py-1 text-xs" onClick={onBankSheetOpen}>
            Edit
          </Button>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button
          variant="secondary"
          className="px-3 py-1.5 text-xs"
          disabled={fillDisabled}
          onClick={onAddBank}
        >
          <PlusIcon className="mr-1 h-3.5 w-3.5" />
          {bankRows.length > 0 ? "Edit banks" : "Add bank"}
        </Button>
        <Button variant="secondary" className="px-3 py-1.5 text-xs" onClick={onFill}>
          {fillLabel}
        </Button>
      </div>
    </>
  );
}

export function PaymentSummaryCard({
  title,
  total,
  lines,
  children,
}: {
  title: string;
  total: number;
  lines: { label: string; amount: number; accent?: boolean }[];
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl bg-white">
      <div className="px-5 py-4">
        <h3 className="text-sm font-semibold text-ink-900">{title}</h3>
      </div>
      <div className="px-5 pb-5">
        <div className="flex items-center justify-between gap-3">
          <div className="text-left">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Total</p>
            <p className="text-3xl font-bold leading-tight text-brand-600">{formatPKR(total)}</p>
          </div>
          <div className="space-y-1 text-right text-xs text-ink-500">
            {lines.map((line) => (
              <p key={line.label} className="flex items-center justify-end gap-2">
                <span>{line.label}</span>
                <span className={`w-20 text-right font-medium ${line.accent ? "text-brand-600" : "text-ink-700"}`}>
                  {formatPKR(line.amount)}
                </span>
              </p>
            ))}
          </div>
        </div>
        <div className="mt-4">
          {children}
        </div>
      </div>
    </div>
  );
}
