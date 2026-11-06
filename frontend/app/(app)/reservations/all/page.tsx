"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { apiRequest } from "@/lib/apiClient";
import { brandOf, type BankAccount, type ReservationDetail } from "@/lib/api-types";
import { useApi } from "@/lib/use-api";
import { clampMoneyInput, formatPKR } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { BadgeVariant } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { SearchInput } from "@/components/ui/search-input";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { BankPaymentRow } from "@/components/payment-bottom";
import { BankDepositSheet } from "@/components/bank-deposit-sheet";
import { useToast } from "@/components/ui/toast";
import { PlusIcon, XIcon } from "@/components/icons";

type TypeFilter = "ALL" | "RESERVATION" | "CONSIGNMENT";
type StatusFilter = "ALL" | "ACTIVE" | "COMPLETED" | "CANCELLED";

const TYPE_FILTERS: { value: TypeFilter; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "RESERVATION", label: "On hold" },
  { value: "CONSIGNMENT", label: "On consignment" },
];

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "ACTIVE", label: "Active" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled" },
];

function statusInfo(r: ReservationDetail) {
  if (r.status === "ACTIVE") {
    return r.type === "CONSIGNMENT"
      ? { label: "Out", variant: "info" as BadgeVariant }
      : { label: "On hold", variant: "warning" as BadgeVariant };
  }
  if (r.status === "COMPLETED") {
    if (r.type === "CONSIGNMENT" && !r.sale) {
      return { label: "Returned", variant: "neutral" as BadgeVariant };
    }
    return { label: "Sold", variant: "success" as BadgeVariant };
  }
  if (r.type === "RESERVATION" && parseFloat(r.advance) > 0) {
    return r.refundStatus === "PAID"
      ? { label: "Refunded", variant: "success" as BadgeVariant }
      : { label: "Refund due", variant: "danger" as BadgeVariant };
  }
  return { label: "Cancelled", variant: "danger" as BadgeVariant };
}

function daysOut(createdAt: string) {
  const diff = Date.now() - new Date(createdAt).getTime();
  return Math.max(1, Math.floor(diff / 86400000));
}

export default function AllReservationsPage() {
  const { toast } = useToast();
  const { data, loading, refetch } = useApi<ReservationDetail[]>("/reservation");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("ALL");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [q, setQ] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [action, setAction] = useState<{
    reservation: ReservationDetail;
    kind: "cancel" | "return" | "refund";
  } | null>(null);
  const [refunded, setRefunded] = useState(true);
  const [busy, setBusy] = useState(false);
  const [refundCash, setRefundCash] = useState("");
  const [refundCard, setRefundCard] = useState("");
  const [refundCredit, setRefundCredit] = useState("");
  const [refundBankRows, setRefundBankRows] = useState<{ id: string; amount: string; bankId: string }[]>([]);
  const [bankSheetOpen, setBankSheetOpen] = useState(false);
  const { data: bankAccountsData } = useApi<BankAccount[]>("/bank-account");
  const bankAccounts = bankAccountsData ?? [];

  const rows = useMemo(() => {
    const query = q.trim().toLowerCase();
    return (data ?? []).filter((r) => {
      if (typeFilter !== "ALL" && r.type !== typeFilter) return false;
      if (statusFilter !== "ALL" && r.status !== statusFilter) return false;
      if (!query) return true;
      return (
        r.number.toLowerCase().includes(query) ||
        r.contact.name.toLowerCase().includes(query) ||
        (r.contact.phone ?? "").toLowerCase().includes(query)
      );
    });
  }, [data, typeFilter, statusFilter, q]);

  function openCancel(r: ReservationDetail) {
    setRefunded(parseFloat(r.advance) === 0);
    const adv = parseFloat(r.advance) || 0;
    if (r.payments && r.payments.length > 0) {
      setRefundCash(String(r.payments.filter((p) => p.method === "CASH").reduce((s, p) => s + p.amount, 0) || ""));
      setRefundCard(String(r.payments.filter((p) => p.method === "CARD").reduce((s, p) => s + p.amount, 0) || ""));
      setRefundCredit(String(r.payments.filter((p) => p.method === "CREDIT").reduce((s, p) => s + p.amount, 0) || ""));
      const banks = r.payments.filter((p) => p.method === "BANK_TRANSFER");
      setRefundBankRows(banks.map((p) => ({ id: crypto.randomUUID(), amount: String(p.amount), bankId: (p as any).bankAccountId ?? bankAccounts[0]?.id ?? "" })));
    } else {
      setRefundCash(adv > 0 ? String(adv) : "");
      setRefundCard("");
      setRefundCredit("");
      setRefundBankRows([]);
    }
    setAction({ reservation: r, kind: "cancel" });
  }

  async function confirmAction() {
    if (!action) return;
    const { reservation, kind } = action;
    setBusy(true);
    try {
      if (kind === "cancel") {
        let payments: { method: "CASH" | "CARD" | "BANK_TRANSFER" | "CREDIT"; amount: number; bankAccountId?: string }[] | undefined;
        if (refunded) {
          const adv = parseFloat(reservation.advance) || 0;
          payments = [];
          if ((parseFloat(refundCash) || 0) > 0) payments.push({ method: "CASH", amount: parseFloat(refundCash) || 0 });
          if ((parseFloat(refundCard) || 0) > 0) payments.push({ method: "CARD", amount: parseFloat(refundCard) || 0 });
          if ((parseFloat(refundCredit) || 0) > 0) payments.push({ method: "CREDIT", amount: parseFloat(refundCredit) || 0 });
          for (const row of refundBankRows) {
            const amt = parseFloat(row.amount) || 0;
            if (amt > 0 && row.bankId) payments.push({ method: "BANK_TRANSFER", amount: amt, bankAccountId: row.bankId });
          }
          const sum = payments.reduce((s, p) => s + p.amount, 0);
          if (adv > 0 && Math.abs(sum - adv) > 0.01) {
            toast(`Refund total ${formatPKR(sum)} must equal advance ${formatPKR(adv)}`, "error");
            setBusy(false);
            return;
          }
        }
        await apiRequest(`/reservation/${reservation.id}/cancel`, {
          method: "POST",
          body: { refunded, ...(payments && payments.length > 0 ? { payments } : {}) },
        });
        toast(
          `${reservation.number} cancelled. ${
            refunded ? "Units returned to stock" : "Advance kept as debt on us"
          }`,
          "success",
        );
      } else if (kind === "refund") {
        await apiRequest(`/reservation/${reservation.id}/refund`, { method: "POST" });
        toast(`${reservation.number}. Advance refunded to ${reservation.contact.name}`, "success");
      } else {
        await apiRequest(`/reservation/${reservation.id}/return`, { method: "POST" });
        toast(`${reservation.number} returned. Toys are back in stock`, "success");
      }
      setAction(null);
      void refetch();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't update the reservation", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center justify-end gap-2">
        <Link href="/reservations/cancel">
          <Button variant="grey">
            <XIcon className="h-4 w-4" />
            Cancel Reservation
          </Button>
        </Link>
        <Link href="/reservations">
          <Button>
            <PlusIcon className="h-4 w-4" />
            New Reservation
          </Button>
        </Link>
      </div>

      <div className="mt-4 flex shrink-0 flex-wrap items-center gap-3">
        <SegmentedControl
          options={TYPE_FILTERS.map((f) => ({ value: f.value, label: f.label }))}
          value={typeFilter}
          onChange={(v) => setTypeFilter(v as TypeFilter)}
        />
        <SegmentedControl
          options={STATUS_FILTERS.map((f) => ({ value: f.value, label: f.label }))}
          value={statusFilter}
          onChange={(v) => setStatusFilter(v as StatusFilter)}
        />
        <SearchInput
          value={q}
          onChange={setQ}
          placeholder="Search number, customer…"
          className="bg-ink-100"
          wrapperClassName="ml-auto w-64"
        />
      </div>

      <div className="mt-4 flex-1 overflow-y-auto overscroll-none">
        {loading ? (
          <p className="py-8 text-center text-sm text-ink-400">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-ink-400">No reservations found.</p>
        ) : (
          <div className="overflow-x-auto rounded-2xl bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-ink-500">
                  <th className="px-4 py-2.5 font-semibold">Reservation</th>
                  <th className="px-4 py-2.5 font-semibold">Customer</th>
                  <th className="px-4 py-2.5 text-center font-semibold">Items</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Total</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Advance</th>
                  <th className="px-4 py-2.5 font-semibold">Status</th>
                  <th className="px-4 py-2.5 font-semibold">Created</th>
                  <th className="px-4 py-2.5 text-right font-semibold" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => {
                  const info = statusInfo(r);
                  const isConsignment = r.type === "CONSIGNMENT";
                  let rowAction: { label: string; variant: "secondary" | "grey"; onAction: () => void } | null =
                    null;
                  if (r.status === "ACTIVE") {
                    if (isConsignment) {
                      rowAction = {
                        label: "Returned",
                        variant: "secondary",
                        onAction: () => setAction({ reservation: r, kind: "return" }),
                      };
                    } else {
                      rowAction = {
                        label: "Cancel",
                        variant: "grey",
                        onAction: () => openCancel(r),
                      };
                    }
                  } else if (
                    r.status === "CANCELLED" &&
                    !isConsignment &&
                    parseFloat(r.advance) > 0 &&
                    r.refundStatus !== "PAID"
                  ) {
                    rowAction = {
                      label: "Mark refunded",
                      variant: "grey",
                      onAction: () => setAction({ reservation: r, kind: "refund" }),
                    };
                  }
                  return (
                    <FragmentRow
                      key={r.id}
                      r={r}
                      even={i % 2 === 0}
                      info={info}
                      isConsignment={isConsignment}
                      daysOut={isConsignment ? daysOut(r.createdAt) : null}
                      expanded={expanded === r.id}
                      onToggle={() => setExpanded(expanded === r.id ? null : r.id)}
                      action={rowAction}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog
        open={action !== null}
        title={
          action?.kind === "cancel"
            ? `Cancel ${action.reservation.number}?`
            : action?.kind === "refund"
              ? `Mark refund for ${action?.reservation.number ?? ""}?`
              : `Return ${action?.reservation.number ?? ""} to stock?`
        }
        message={
          action ? (
            action.kind === "cancel" ? (
              <div className="space-y-3">
                <p>
                  {action.reservation.contact.name} paid an advance of{" "}
                  {formatPKR(parseFloat(action.reservation.advance))}. The reserved phones will return
                  to stock.
                </p>
                {action.reservation.payments && action.reservation.payments.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 rounded-xl bg-ink-50 p-2.5">
                    {action.reservation.payments.map((p, idx) => (
                      <Badge key={`${p.method}-${idx}`} variant="brand">
                        {p.method.replace("_", " ").toLowerCase()} {formatPKR(p.amount)}
                        {p.method === "BANK_TRANSFER" && (p as any).bankAccount ? ` · ${(p as any).bankAccount.bankName} ${(p as any).bankAccount.name}` : ""}
                      </Badge>
                    ))}
                  </div>
                )}
                {parseFloat(action.reservation.advance) > 0 && (
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
                        : `${formatPKR(parseFloat(action.reservation.advance))} shows as debt on us until you mark it refunded.`}
                    </p>
                    {refunded && parseFloat(action.reservation.advance) > 0 && (
                      <div className="mt-3 space-y-2 rounded-2xl bg-white p-3 ring-1 ring-ink-100">
                        <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">How was it paid back?</p>
                        <div className="space-y-2">
                          <div className="flex items-end gap-1.5"><div className="flex-1"><p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-500">Cash</p><Input value={refundCash} onChange={(e) => setRefundCash(clampMoneyInput(e.target.value.replace(/[^0-9.]/g, "")))} placeholder="0" inputMode="decimal" className="!h-8 bg-ink-100 text-sm" /></div><Button className="h-8 px-3 text-xs" onClick={() => setRefundCash(clampMoneyInput(String(parseFloat(action.reservation.advance) - (parseFloat(refundCard) || 0) - (parseFloat(refundCredit) || 0) - refundBankRows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0))))}>Fill</Button></div>
                          <div className="flex items-end gap-1.5"><div className="flex-1"><p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-500">Card</p><Input value={refundCard} onChange={(e) => setRefundCard(clampMoneyInput(e.target.value.replace(/[^0-9.]/g, "")))} placeholder="0" inputMode="decimal" className="!h-8 bg-ink-100 text-sm" /></div><Button className="h-8 px-3 text-xs" onClick={() => setRefundCard(clampMoneyInput(String(parseFloat(action.reservation.advance) - (parseFloat(refundCash) || 0) - (parseFloat(refundCredit) || 0) - refundBankRows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0))))}>Fill</Button></div>
                          <div className="flex items-end gap-1.5"><div className="flex-1"><p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-500">Credit</p><Input value={refundCredit} onChange={(e) => setRefundCredit(clampMoneyInput(e.target.value.replace(/[^0-9.]/g, "")))} placeholder="0" inputMode="decimal" className="!h-8 bg-ink-100 text-sm" /></div><Button className="h-8 px-3 text-xs" onClick={() => setRefundCredit(clampMoneyInput(String(parseFloat(action.reservation.advance) - (parseFloat(refundCash) || 0) - (parseFloat(refundCard) || 0) - refundBankRows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0))))}>Fill</Button></div>
                          <BankPaymentRow bankRows={refundBankRows} bankAccounts={bankAccounts} onBankSheetOpen={() => setBankSheetOpen(true)} onAddBank={() => { if (refundBankRows.length === 0) { const next = bankAccounts[0]; setRefundBankRows([{ id: crypto.randomUUID(), amount: "", bankId: next?.id ?? "" }]); } setBankSheetOpen(true); }} />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : action.kind === "refund" ? (
              <div className="space-y-2">
                <p>
                  You're returning {formatPKR(parseFloat(action.reservation.advance))} to{" "}
                  {action.reservation.contact.name}. The debt on us will clear.
                </p>
                {action.reservation.payments && action.reservation.payments.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 rounded-xl bg-ink-50 p-2.5">
                    {action.reservation.payments.map((p, idx) => (
                      <Badge key={`${p.method}-${idx}`} variant="brand">
                        {p.method.replace("_", " ").toLowerCase()} {formatPKR(p.amount)}
                        {p.method === "BANK_TRANSFER" && (p as any).bankAccount ? ` · ${(p as any).bankAccount.bankName} ${(p as any).bankAccount.name}` : ""}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <p>
                  {action.reservation.contact.name} has not paid for the phones. They are coming back
                  unsold.
                </p>
                <p>The phones will return to stock.</p>
              </div>
            )
          ) : null
        }
        confirmLabel={
          action?.kind === "cancel"
            ? "Cancel reservation"
            : action?.kind === "refund"
              ? "Mark refunded"
              : "Return to stock"
        }
        destructive={action?.kind === "cancel"}
        busy={busy}
        onConfirm={() => void confirmAction()}
        onCancel={() => setAction(null)}
      />
      <BankDepositSheet open={bankSheetOpen} onClose={() => setBankSheetOpen(false)} bankRows={refundBankRows} onBankRowsChange={setRefundBankRows} bankAccounts={bankAccounts} />
    </div>
  );
}

function FragmentRow({
  r,
  even,
  info,
  isConsignment,
  daysOut,
  expanded,
  onToggle,
  action,
}: {
  r: ReservationDetail;
  even: boolean;
  info: { label: string; variant: BadgeVariant };
  isConsignment: boolean;
  daysOut: number | null;
  expanded: boolean;
  onToggle: () => void;
  action: { label: string; variant: "secondary" | "grey"; onAction: () => void } | null;
}) {
  return (
    <>
      <tr
        onClick={onToggle}
        className={`${even ? "bg-white" : "bg-ink-50"} cursor-pointer ${expanded ? "bg-brand-50/60" : ""}`}
      >
        <td className="px-4 py-3">
          <span className="font-mono font-semibold text-ink-900">{r.number}</span>
          <Badge className="ml-2" variant={isConsignment ? "info" : "neutral"}>
            {isConsignment ? "Out" : "Hold"}
          </Badge>
        </td>
        <td className="px-4 py-3">
          <p className="font-medium text-ink-900">{r.contact.name}</p>
          {r.contact.phone && <p className="text-[11px] text-ink-400">{r.contact.phone}</p>}
        </td>
        <td className="px-4 py-3 text-center text-ink-700">{r.items.length}</td>
        <td className="px-4 py-3 text-right font-semibold text-ink-900">{formatPKR(r.total)}</td>
        <td className="px-4 py-3 text-right text-ink-700">
          {isConsignment ? "—" : formatPKR(parseFloat(r.advance))}
        </td>
        <td className="px-4 py-3">
          <Badge variant={info.variant}>{info.label}</Badge>
        </td>
        <td className="px-4 py-3 text-ink-500">
          {new Date(r.createdAt).toLocaleDateString("en-PK", { day: "numeric", month: "short" })}
          {daysOut !== null && (
            <span className="block text-[10px] text-sky-700">out {daysOut}d</span>
          )}
        </td>
        <td className="px-4 py-3 text-right">
          {action && (
            <Button
              variant={action.variant}
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                action.onAction();
              }}
            >
              <XIcon className="h-3.5 w-3.5" />
              {action.label}
            </Button>
          )}
        </td>
      </tr>
      {expanded && (
        <tr className="bg-white">
          <td colSpan={8} className="px-4 py-3">
            <div className="rounded-xl bg-ink-50 p-3">
              {r.items.map((i) => (
                <div key={i.id} className="flex items-center justify-between py-0.5 text-xs">
                  <span className="text-ink-700">
                    {brandOf(i.product)} {i.product.model}
                    {i.unit ? ` · ${i.unit.imei}` : ` ×${i.quantity}`}
                  </span>
                  <span className="text-ink-500">
                    {formatPKR(i.total)}
                    {isConsignment && <span className="ml-1 text-[10px] text-sky-700">agreed</span>}
                  </span>
                </div>
              ))}
              {isConsignment && r.status === "COMPLETED" && !r.sale && (
                <div className="mt-1.5 rounded-lg bg-white px-2.5 py-1.5 text-xs text-ink-500">
                  Returned unsold. No payment collected.
                </div>
              )}
              {r.status === "CANCELLED" && !isConsignment ? (
                <div className="mt-1 flex items-center justify-between border-t border-ink-200 pt-1.5 text-xs font-semibold text-ink-900">
                  <span>Refund due</span>
                  <span className={r.refundStatus === "PAID" ? "text-success" : "text-error"}>
                    {r.refundStatus === "PAID"
                      ? "Paid back"
                      : formatPKR(parseFloat(r.advance))}
                  </span>
                </div>
              ) : (
                <div className="mt-1 flex items-center justify-between border-t border-ink-200 pt-1.5 text-xs font-semibold text-ink-900">
                  <span>{isConsignment ? "Balance to collect" : "Balance due"}</span>
                  <span>
                    {r.status === "COMPLETED" && r.sale
                      ? "Settled"
                      : formatPKR(Math.max(0, parseFloat(r.total) - parseFloat(r.advance)))}
                  </span>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
