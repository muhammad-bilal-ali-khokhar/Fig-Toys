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
  fillLabel?: string;
  onFill?: () => void;
  fillDisabled?: boolean;
}) {
  const hasFill = !!fillLabel && !!onFill;
  return (
    <div className="rounded-2xl border border-ink-100 bg-ink-50/40 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Banks</p>
        <Button
          variant="secondary"
          className="px-2.5 py-1 text-xs"
          disabled={bankRows.length === 0 && bankAccounts.length === 0}
          onClick={onAddBank}
        >
          <PlusIcon className="mr-1 h-3 w-3" />
          {bankRows.length > 0 ? "Edit banks" : "Add bank"}
        </Button>
      </div>

      {bankRows.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {bankRows.map((row) => {
            const bank = bankAccounts.find((b) => b.id === row.bankId);
            return (
              <span
                key={row.id}
                className="inline-flex items-center gap-1.5 rounded-full border border-ink-100 bg-white px-2.5 py-1 text-xs font-medium text-ink-700"
              >
                <span className="max-w-[90px] truncate">{bank?.bankName ?? "Bank"}{bank?.accountNo ? ` · ${bank.accountNo.slice(-4)}` : ""}</span>
                <span className="font-semibold text-ink-900">{row.amount ? formatPKR(parseFloat(row.amount)) : "—"}</span>
              </span>
            );
          })}
        </div>
      ) : (
        <p className="rounded-xl bg-white px-3 py-2 text-xs text-ink-400">
          No bank selected. Split payment across bank accounts.
        </p>
      )}

      {hasFill && (
        <div className="mt-3 flex justify-end border-t border-ink-100 pt-2">
          <Button variant="ghost" className="px-2 py-1 text-xs" disabled={fillDisabled} onClick={onFill}>
            {fillLabel}
          </Button>
        </div>
      )}
    </div>
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
