"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { apiRequest } from "@/lib/apiClient";
import { brandOf, type BankAccount, type ReservationDetail } from "@/lib/api-types";
import { useApi } from "@/lib/use-api";
import { clampMoneyInput, formatPKR } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { BankPaymentRow } from "@/components/payment-bottom";
import { BankDepositSheet } from "@/components/bank-deposit-sheet";
import { useToast } from "@/components/ui/toast";
import { PlusIcon, ReservationIcon, XIcon } from "@/components/icons";

export default function CancelReservationPage() {
  const { toast } = useToast();
  const { data, loading, refetch } = useApi<ReservationDetail[]>(
    "/reservation?status=ACTIVE&type=RESERVATION",
  );
  const [cancelling, setCancelling] = useState<ReservationDetail | null>(null);
  const [refunded, setRefunded] = useState(true);
  const [busy, setBusy] = useState(false);
  const [refundCash, setRefundCash] = useState("");
  const [refundCard, setRefundCard] = useState("");
  const [refundCredit, setRefundCredit] = useState("");
  const [refundBankRows, setRefundBankRows] = useState<{ id: string; amount: string; bankId: string }[]>([]);
  const [bankSheetOpen, setBankSheetOpen] = useState(false);
  const { data: bankAccountsData } = useApi<BankAccount[]>("/bank-account");
  const bankAccounts = bankAccountsData ?? [];

  const active = useMemo(
    () => (data ?? []).filter((r) => r.status === "ACTIVE" && r.type === "RESERVATION"),
    [data],
  );

  function openCancel(r: ReservationDetail) {
    setRefunded(parseFloat(r.advance) === 0);
    const advance = parseFloat(r.advance) || 0;
    if (r.payments && r.payments.length > 0) {
      setRefundCash(String(r.payments.filter((p) => p.method === "CASH").reduce((s, p) => s + p.amount, 0) || ""));
      setRefundCard(String(r.payments.filter((p) => p.method === "CARD").reduce((s, p) => s + p.amount, 0) || ""));
      setRefundCredit(String(r.payments.filter((p) => p.method === "CREDIT").reduce((s, p) => s + p.amount, 0) || ""));
      const banks = r.payments.filter((p) => p.method === "BANK_TRANSFER");
      setRefundBankRows(banks.map((p) => ({ id: crypto.randomUUID(), amount: String(p.amount), bankId: p.bankAccountId ?? bankAccounts[0]?.id ?? "" })));
    } else {
      setRefundCash(advance > 0 ? String(advance) : "");
      setRefundCard("");
      setRefundCredit("");
      setRefundBankRows([]);
    }
    setCancelling(r);
  }

  async function confirmCancel() {
    if (!cancelling) return;
    setBusy(true);
    try {
      const advance = parseFloat(cancelling.advance) || 0;
      let payments: { method: "CASH" | "CARD" | "BANK_TRANSFER" | "CREDIT"; amount: number; bankAccountId?: string }[] | undefined;
      if (refunded && advance > 0) {
        payments = [];
        if ((parseFloat(refundCash) || 0) > 0) payments.push({ method: "CASH", amount: parseFloat(refundCash) || 0 });
        if ((parseFloat(refundCard) || 0) > 0) payments.push({ method: "CARD", amount: parseFloat(refundCard) || 0 });
        if ((parseFloat(refundCredit) || 0) > 0) payments.push({ method: "CREDIT", amount: parseFloat(refundCredit) || 0 });
        for (const row of refundBankRows) {
          const amt = parseFloat(row.amount) || 0;
          if (amt > 0 && row.bankId) payments.push({ method: "BANK_TRANSFER", amount: amt, bankAccountId: row.bankId });
        }
        const sum = payments.reduce((s, p) => s + p.amount, 0);
        if (Math.abs(sum - advance) > 0.01) {
          toast(`Refund total ${formatPKR(sum)} must equal advance ${formatPKR(advance)}`, "error");
          setBusy(false);
          return;
        }
      }
      await apiRequest(`/reservation/${cancelling.id}/cancel`, {
        method: "POST",
        body: { refunded, ...(payments && payments.length > 0 ? { payments } : {}) },
      });
      toast(
        `${cancelling.number} cancelled. ${
          refunded ? "Advance returned" : "Advance kept as debt on us"
        }`,
        "success",
      );
      setCancelling(null);
      void refetch();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't cancel the reservation", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center justify-end gap-2">
        <Link href="/reservations/all">
          <Button variant="grey">
            <ReservationIcon className="h-4 w-4" />
            All Reservations
          </Button>
        </Link>
        <Link href="/reservations">
          <Button>
            <PlusIcon className="h-4 w-4" />
            New Reservation
          </Button>
        </Link>
      </div>

      <div className="mt-4 flex-1 overflow-y-auto overscroll-none">
        {loading ? (
          <p className="py-8 text-center text-sm text-ink-400">Loading…</p>
        ) : active.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-sm text-ink-400">No active reservations.</p>
            <Link href="/reservations" className="mt-4 inline-block">
              <Button>
                <PlusIcon className="h-4 w-4" />
                New Reservation
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {active.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-4 rounded-2xl bg-white p-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-semibold text-ink-900">{r.number}</span>
                    <Badge variant="warning">Active</Badge>
                  </div>
                  <p className="mt-1 text-sm font-medium text-ink-900">
                    {r.contact.name}
                    {r.contact.phone ? ` · ${r.contact.phone}` : ""}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-ink-500">
                    {r.items.map((i) => `${brandOf(i.product)} ${i.product.model}`).join(", ")}
                  </p>
                  <p className="mt-1 text-xs text-ink-400">
                    Reserved{" "}
                    {new Date(r.createdAt).toLocaleDateString("en-PK", { day: "numeric", month: "short" })}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-4">
                  <div className="text-right">
                    <p className="text-sm font-bold text-ink-900">{formatPKR(r.total)}</p>
                    <p className="text-xs text-ink-500">Advance {formatPKR(parseFloat(r.advance))}</p>
                    {r.payments && r.payments.length > 0 && (
                      <div className="mt-1 flex flex-wrap justify-end gap-1">
                        {r.payments.map((p, idx) => (
                          <Badge key={`${p.method}-${idx}`} variant="brand" className="text-[10px] px-1.5 py-0">
                            {p.method.replace("_", " ").toLowerCase()} {formatPKR(p.amount)}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <Button variant="destructive" size="sm" onClick={() => openCancel(r)}>
                    <XIcon className="h-3.5 w-3.5" />
                    Cancel
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog
        open={cancelling !== null}
        title={`Cancel ${cancelling?.number ?? ""}?`}
        message={
          cancelling ? (
            <div className="space-y-3">
              <p>
                {cancelling.contact.name} paid an advance of {formatPKR(parseFloat(cancelling.advance))}.
                The reserved toys will return to stock.
              </p>
              {cancelling.payments && cancelling.payments.length > 0 && (
                <div className="flex flex-wrap gap-1.5 rounded-xl bg-ink-50 p-2.5">
                  {cancelling.payments.map((p, idx) => (
                    <Badge key={`${p.method}-${idx}`} variant="brand">
                      {p.method.replace("_", " ").toLowerCase()} {formatPKR(p.amount)}
                      {p.method === "BANK_TRANSFER" && p.bankAccount ? ` · ${p.bankAccount.bankName} ${p.bankAccount.name}` : ""}
                    </Badge>
                  ))}
                </div>
              )}
              {parseFloat(cancelling.advance) > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">
                    Advance refund
                  </p>
                  <div className="flex items-center gap-1 rounded-2xl bg-brand-100 p-1">
                    <button
                      type="button"
                      onClick={() => setRefunded(true)}
                      className={`flex-1 rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                        refunded ? "bg-brand-600 text-white" : "text-brand-700 hover:text-ink-900"
                      }`}
                    >
                      Paid back now
                    </button>
                    <button
                      type="button"
                      onClick={() => setRefunded(false)}
                      className={`flex-1 rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                        !refunded ? "bg-brand-600 text-white" : "text-brand-700 hover:text-ink-900"
                      }`}
                    >
                      Not yet. We owe it
                    </button>
                  </div>
                  <p className="text-xs text-ink-500">
                    {refunded
                      ? "The advance is already back with the customer."
                      : `${formatPKR(parseFloat(cancelling.advance))} shows as debt on us until you mark it refunded.`}
                  </p>
                  {refunded && parseFloat(cancelling.advance) > 0 && (
                    <div className="mt-3 space-y-2 rounded-2xl bg-white p-3 ring-1 ring-ink-100">
                      <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">How was it paid back?</p>
                      <div className="space-y-2">
                        <div className="flex items-end gap-1.5"><div className="flex-1"><p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-500">Cash</p><Input value={refundCash} onChange={(e) => setRefundCash(clampMoneyInput(e.target.value.replace(/[^0-9.]/g, "")))} placeholder="0" inputMode="decimal" className="!h-8 bg-ink-100 text-sm" /></div><Button className="h-8 px-3 text-xs" onClick={() => setRefundCash(clampMoneyInput(String(parseFloat(cancelling.advance) - (parseFloat(refundCard) || 0) - (parseFloat(refundCredit) || 0) - refundBankRows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0))))}>Fill</Button></div>
                        <div className="flex items-end gap-1.5"><div className="flex-1"><p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-500">Card</p><Input value={refundCard} onChange={(e) => setRefundCard(clampMoneyInput(e.target.value.replace(/[^0-9.]/g, "")))} placeholder="0" inputMode="decimal" className="!h-8 bg-ink-100 text-sm" /></div><Button className="h-8 px-3 text-xs" onClick={() => setRefundCard(clampMoneyInput(String(parseFloat(cancelling.advance) - (parseFloat(refundCash) || 0) - (parseFloat(refundCredit) || 0) - refundBankRows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0))))}>Fill</Button></div>
                        <div className="flex items-end gap-1.5"><div className="flex-1"><p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-500">Credit</p><Input value={refundCredit} onChange={(e) => setRefundCredit(clampMoneyInput(e.target.value.replace(/[^0-9.]/g, "")))} placeholder="0" inputMode="decimal" className="!h-8 bg-ink-100 text-sm" /></div><Button className="h-8 px-3 text-xs" onClick={() => setRefundCredit(clampMoneyInput(String(parseFloat(cancelling.advance) - (parseFloat(refundCash) || 0) - (parseFloat(refundCard) || 0) - refundBankRows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0))))}>Fill</Button></div>
                        <BankPaymentRow bankRows={refundBankRows} bankAccounts={bankAccounts} onBankSheetOpen={() => setBankSheetOpen(true)} onAddBank={() => { if (refundBankRows.length === 0) { const next = bankAccounts[0]; setRefundBankRows([{ id: crypto.randomUUID(), amount: "", bankId: next?.id ?? "" }]); } setBankSheetOpen(true); }} />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : null
        }
        confirmLabel="Cancel reservation"
        destructive
        busy={busy}
        onConfirm={() => void confirmCancel()}
        onCancel={() => setCancelling(null)}
      />
      <BankDepositSheet open={bankSheetOpen} onClose={() => setBankSheetOpen(false)} bankRows={refundBankRows} onBankRowsChange={setRefundBankRows} bankAccounts={bankAccounts} />
    </div>
  );
}
