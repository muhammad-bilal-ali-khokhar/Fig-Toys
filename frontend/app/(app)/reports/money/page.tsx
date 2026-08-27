"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { apiRequest } from "@/lib/apiClient";
import { useAuth } from "@/lib/auth-context";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { hasPermission } from "@/lib/roles";
import { formatPKR } from "@/lib/money";
import { toISODate } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dropdown } from "@/components/ui/dropdown";
import { useToast } from "@/components/ui/toast";
import { KpiCard, ReportCard } from "@/components/reports/report-card";
import { XIcon } from "@/components/icons";
import type { BankAccount, CashDrawer, MoneyMovement, MoneyOverview } from "@/lib/api-types";

const SOURCE_LABELS: Record<string, string> = {
  SALE: "Sale",
  PURCHASE: "Purchase",
  SALE_RETURN: "Sale return",
  PURCHASE_RETURN: "Purchase return",
  EXPENSE: "Expense",
  VOUCHER: "Voucher",
  RESERVATION: "Reservation",
  CARD_SETTLEMENT: "Card settlement",
  TRANSFER: "Transfer",
  ADJUSTMENT: "Adjustment",
};

type MoneyAccount = "cash" | "bank";

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 p-4">
      <div className="flex max-h-[85vh] w-full max-w-md flex-col rounded-2xl bg-white p-4">
        <div className="flex shrink-0 items-center justify-between">
          <h3 className="text-lg font-bold text-ink-900">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-xl p-1.5 text-ink-400 transition hover:bg-ink-50 hover:text-ink-900"
          >
            <XIcon className="h-5 w-5" />
          </button>
        </div>
        <div className="mt-3 min-h-0 flex-1 overflow-y-auto overscroll-none">{children}</div>
      </div>
    </div>
  );
}

export default function MoneyReportPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const canWrite = hasPermission(user, PERMISSIONS.moneyWrite);

  const [overview, setOverview] = useState<MoneyOverview | null>(null);
  const [movements, setMovements] = useState<MoneyMovement[]>([]);
  const [banks, setBanks] = useState<BankAccount[]>([]);
  const [drawers, setDrawers] = useState<CashDrawer[]>([]);
  const [loading, setLoading] = useState(true);

  const [settleOpen, setSettleOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [ov, mv] = await Promise.all([
        apiRequest<MoneyOverview>("/money"),
        apiRequest<MoneyMovement[]>("/money/movements"),
      ]);
      setOverview(ov);
      setDrawers(ov?.cashDrawers ?? []);
      setMovements(mv ?? []);
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to load money", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    (async () => {
      try {
        setBanks((await apiRequest<BankAccount[]>("/bank-account")) ?? []);
      } catch {
        /* optional */
      }
    })();
  }, []);

  const bankOptions = banks.map((b) => ({
    value: b.id,
    label: `${b.bankName} · ${b.name} (${b.accountNo})`,
  }));

  const drawerOptions = drawers.map((d) => ({
    value: d.id,
    label: d.name + (d.isDefault ? " (default)" : ""),
  }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-ink-900">Money & bank balances</h2>
          <p className="text-xs text-ink-500">
            What you actually hold, including cash in hand, money in each bank, pending card, and outstanding credit.
          </p>
        </div>
        {canWrite && (
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={() => setSettleOpen(true)}>
              Settle card
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setTransferOpen(true)}>
              Transfer
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setAdjustOpen(true)}>
              Adjust
            </Button>
          </div>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-ink-400">Loading…</p>
      ) : overview ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard label="Cash in hand" value={formatPKR(overview.cashBalance)} sub={drawers.length > 0 ? `Across ${drawers.length} cash drawer${drawers.length > 1 ? "s" : ""}` : "Cash you physically hold"} />
            <KpiCard label="In bank" value={formatPKR(overview.totalBankBalance)} sub="Across all bank accounts" />
            <KpiCard
              label="Pending card"
              value={formatPKR(overview.pendingCard)}
              sub="Card sales not yet settled. Record it under \u201cSettle card\u201d when the bank pays out"
            />
            <KpiCard
              label="Outstanding credit"
              value={formatPKR(overview.receivables - overview.payables)}
              sub={
                overview.payables > 0
                  ? `Customers owe ${formatPKR(overview.receivables)} \u00b7 you owe ${formatPKR(overview.payables)}`
                  : "What customers owe you on credit"
              }
            />
          </div>

          <div className="grid gap-3 lg:grid-cols-3">
            {drawers.length > 0 && (
              <ReportCard title="Cash drawers" sub="Balance per drawer">
                <div className="space-y-2">
                  {drawers.map((d) => (
                    <div key={d.id} className="flex items-center justify-between gap-3 rounded-2xl bg-ink-50 px-3.5 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-ink-900">{d.name}</p>
                        {d.isDefault && <p className="text-xs text-ink-400">Default</p>}
                      </div>
                      <p className="shrink-0 text-sm font-bold text-ink-900">{formatPKR(d.balance)}</p>
                    </div>
                  ))}
                </div>
              </ReportCard>
            )}

            <ReportCard title="Bank accounts" sub="Current balance per account">
              {overview.banks.length === 0 ? (
                <p className="text-sm text-ink-400">No bank accounts added.</p>
              ) : (
                <div className="space-y-2">
                  {overview.banks.map((b) => (
                    <div key={b.id} className="flex items-center justify-between gap-3 rounded-2xl bg-ink-50 px-3.5 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-ink-900">{b.bankName}</p>
                        <p className="truncate text-xs text-ink-400">{b.name} · {b.accountNo}</p>
                      </div>
                      <p className="shrink-0 text-sm font-bold text-ink-900">{formatPKR(b.balance)}</p>
                    </div>
                  ))}
                </div>
              )}
            </ReportCard>

            <ReportCard title="Card money" sub="Tracked against card sales and settlements">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-ink-500">Pending (not yet in bank/cash)</span>
                  <span className="font-semibold text-ink-900">{formatPKR(overview.pendingCard)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-500">Card fee collected on sales</span>
                  <span className="font-semibold text-ink-900">Included above</span>
                </div>
              </div>
            </ReportCard>

            <ReportCard title="How it's counted" sub="Card fee is collected from the customer at sale time">
              <p className="text-sm leading-relaxed text-ink-500">
                When a card sale is made, that money sits as “pending card” until the bank pays it out.
                Once it arrives, use <span className="font-semibold text-ink-900">Settle card</span> to record it into
                a bank account or cash. Card fees are collected from the customer at the counter, so they are money in
                your favour, not a loss.
              </p>
            </ReportCard>
          </div>

          <ReportCard title="Movement history" sub="Every cash & bank change">
            {movements.length === 0 ? (
              <p className="text-sm text-ink-400">No movements yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-ink-100 text-left text-xs uppercase tracking-wide text-ink-500">
                      <th className="px-2 py-2 font-semibold">Date</th>
                      <th className="px-2 py-2 font-semibold">Type</th>
                      <th className="px-2 py-2 font-semibold">Account</th>
                      <th className="px-2 py-2 font-semibold">Note</th>
                      <th className="px-2 py-2 text-right font-semibold">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movements.map((m) => {
                      const inOut = m.kind === "IN" ? "text-success" : m.kind === "OUT" ? "text-error" : "text-ink-700";
                      const signed =
                        m.kind === "IN" ? `+${formatPKR(m.amount)}` : m.kind === "OUT" ? `−${formatPKR(m.amount)}` : formatPKR(m.amount);
                      return (
                        <tr key={m.id} className="border-b border-ink-50">
                          <td className="whitespace-nowrap px-2 py-2 text-ink-700">
                            {new Date(m.date).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                          </td>
                          <td className="px-2 py-2">
                            <span className="font-medium text-ink-900">{SOURCE_LABELS[m.sourceType] ?? m.sourceType}</span>
                          </td>
                          <td className="px-2 py-2 text-ink-700">
                            {m.account === "cash" ? (m.cashDrawer?.name ?? "Cash") : m.bankAccount?.bankName ?? "Bank"}
                          </td>
                          <td className="max-w-[240px] truncate px-2 py-2 text-ink-500">{m.note ?? "—"}</td>
                          <td className={`whitespace-nowrap px-2 py-2 text-right font-semibold ${inOut}`}>{signed}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </ReportCard>
        </>
      ) : null}

      {settleOpen && (
        <Modal title="Settle card money" onClose={() => setSettleOpen(false)}>
          <SettleForm
            banks={bankOptions}
            drawers={drawerOptions}
            pendingCard={overview?.pendingCard ?? 0}
            onDone={() => {
              setSettleOpen(false);
              void refresh();
            }}
          />
        </Modal>
      )}

      {transferOpen && (
        <Modal title="Transfer money" onClose={() => setTransferOpen(false)}>
          <TransferForm
            banks={bankOptions}
            drawers={drawerOptions}
            onDone={() => {
              setTransferOpen(false);
              void refresh();
            }}
          />
        </Modal>
      )}

      {adjustOpen && (
        <Modal title="Adjust balance" onClose={() => setAdjustOpen(false)}>
          <AdjustForm
            banks={bankOptions}
            drawers={drawerOptions}
            onDone={() => {
              setAdjustOpen(false);
              void refresh();
            }}
          />
        </Modal>
      )}
    </div>
  );
}

function SettleForm({
  banks,
  drawers,
  pendingCard,
  onDone,
}: {
  banks: { value: string; label: string }[];
  drawers: { value: string; label: string }[];
  pendingCard: number;
  onDone: () => void;
}) {
  const { toast } = useToast();
  const [amount, setAmount] = useState(pendingCard > 0 ? String(pendingCard) : "");
  const [target, setTarget] = useState<MoneyAccount>("bank");
  const [bankId, setBankId] = useState(banks[0]?.value ?? "");
  const [drawerId, setDrawerId] = useState(drawers[0]?.value ?? "");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    const value = parseFloat(amount);
    if (!value || value <= 0) {
      toast("Enter a valid amount", "error");
      return;
    }
    if (target === "bank" && !bankId) {
      toast("Pick which bank received the card money", "error");
      return;
    }
    if (target === "cash" && drawers.length > 0 && !drawerId) {
      toast("Pick which drawer received the card money", "error");
      return;
    }
    setBusy(true);
    try {
      await apiRequest("/money/settle-card", {
        method: "POST",
        body: {
          amount: value,
          target,
          bankAccountId: target === "bank" ? bankId : undefined,
          cashDrawerId: target === "cash" ? drawerId : undefined,
          note: note || undefined,
          date: toISODate(new Date()),
        },
      });
      toast("Card money recorded", "success");
      onDone();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to settle card", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
      <p className="text-xs text-ink-500">
        The bank paid out card money into your account (or cash drawer). Record it here so it shows as money you hold.
      </p>
      <Field label="Amount (Rs)">
        <Input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" inputMode="decimal" />
      </Field>
      <Field label="Arrives into">
        <Dropdown
          value={target}
          options={[
            { value: "bank", label: "A bank account" },
            { value: "cash", label: "Cash drawer" },
          ]}
          onChange={(v) => setTarget(v as MoneyAccount)}
        />
      </Field>
      {target === "bank" && (
        <Field label="Bank account">
          <Dropdown value={bankId} options={banks} onChange={setBankId} placeholder="Select bank\u2026" searchable />
        </Field>
      )}
      {target === "cash" && drawers.length > 0 && (
        <Field label="Cash drawer">
          <Dropdown value={drawerId} options={drawers} onChange={setDrawerId} placeholder="Select drawer\u2026" searchable />
        </Field>
      )}
      <Field label="Note">
        <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" />
      </Field>
      <Button type="submit" className="w-full" loading={busy}>
        Record card settlement
      </Button>
    </form>
  );
}

function TransferForm({
  banks,
  drawers,
  onDone,
}: {
  banks: { value: string; label: string }[];
  drawers: { value: string; label: string }[];
  onDone: () => void;
}) {
  const { toast } = useToast();
  const [amount, setAmount] = useState("");
  const [from, setFrom] = useState<MoneyAccount>("cash");
  const [fromBankId, setFromBankId] = useState(banks[0]?.value ?? "");
  const [fromDrawerId, setFromDrawerId] = useState(drawers[0]?.value ?? "");
  const [to, setTo] = useState<MoneyAccount>("bank");
  const [toBankId, setToBankId] = useState(banks[0]?.value ?? "");
  const [toDrawerId, setToDrawerId] = useState(drawers[0]?.value ?? "");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    const value = parseFloat(amount);
    if (!value || value <= 0) {
      toast("Enter a valid amount", "error");
      return;
    }
    if (from === "bank" && !fromBankId) {
      toast("Pick the bank to move money from", "error");
      return;
    }
    if (from === "cash" && drawers.length > 0 && !fromDrawerId) {
      toast("Pick the drawer to move money from", "error");
      return;
    }
    if (to === "bank" && !toBankId) {
      toast("Pick the bank to move money into", "error");
      return;
    }
    if (to === "cash" && drawers.length > 0 && !toDrawerId) {
      toast("Pick the drawer to move money into", "error");
      return;
    }
    setBusy(true);
    try {
      await apiRequest("/money/transfer", {
        method: "POST",
        body: {
          amount: value,
          from,
          fromBankId: from === "bank" ? fromBankId : undefined,
          fromCashDrawerId: from === "cash" ? fromDrawerId : undefined,
          to,
          toBankId: to === "bank" ? toBankId : undefined,
          toCashDrawerId: to === "cash" ? toDrawerId : undefined,
          note: note || undefined,
          date: toISODate(new Date()),
        },
      });
      toast("Transfer recorded", "success");
      onDone();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to transfer", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
      <p className="text-xs text-ink-500">
        Move money between cash drawers, bank accounts, or both. Both balances update.
      </p>
      <Field label="Amount (Rs)">
        <Input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" inputMode="decimal" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="From">
          <Dropdown
            value={from}
            options={[
              { value: "cash", label: "Cash drawer" },
              { value: "bank", label: "Bank" },
            ]}
            onChange={(v) => setFrom(v as MoneyAccount)}
          />
        </Field>
        <Field label="To">
          <Dropdown
            value={to}
            options={[
              { value: "cash", label: "Cash drawer" },
              { value: "bank", label: "Bank" },
            ]}
            onChange={(v) => setTo(v as MoneyAccount)}
          />
        </Field>
      </div>
      {from === "bank" && (
        <Field label="From bank">
          <Dropdown value={fromBankId} options={banks} onChange={setFromBankId} placeholder="Select bank\u2026" searchable />
        </Field>
      )}
      {from === "cash" && drawers.length > 0 && (
        <Field label="From drawer">
          <Dropdown value={fromDrawerId} options={drawers} onChange={setFromDrawerId} placeholder="Select drawer\u2026" searchable />
        </Field>
      )}
      {to === "bank" && (
        <Field label="To bank">
          <Dropdown value={toBankId} options={banks} onChange={setToBankId} placeholder="Select bank\u2026" searchable />
        </Field>
      )}
      {to === "cash" && drawers.length > 0 && (
        <Field label="To drawer">
          <Dropdown value={toDrawerId} options={drawers} onChange={setToDrawerId} placeholder="Select drawer\u2026" searchable />
        </Field>
      )}
      <Field label="Note">
        <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" />
      </Field>
      <Button type="submit" className="w-full" loading={busy}>
        Transfer
      </Button>
    </form>
  );
}

function AdjustForm({
  banks,
  drawers,
  onDone,
}: {
  banks: { value: string; label: string }[];
  drawers: { value: string; label: string }[];
  onDone: () => void;
}) {
  const { toast } = useToast();
  const [amount, setAmount] = useState("");
  const [account, setAccount] = useState<MoneyAccount>("cash");
  const [bankId, setBankId] = useState(banks[0]?.value ?? "");
  const [drawerId, setDrawerId] = useState(drawers[0]?.value ?? "");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    const value = parseFloat(amount);
    if (!value || value === 0) {
      toast("Enter an amount", "error");
      return;
    }
    if (account === "bank" && !bankId) {
      toast("Pick the bank account", "error");
      return;
    }
    if (account === "cash" && drawers.length > 0 && !drawerId) {
      toast("Pick the drawer", "error");
      return;
    }
    setBusy(true);
    try {
      await apiRequest("/money/adjust", {
        method: "POST",
        body: {
          account,
          bankAccountId: account === "bank" ? bankId : undefined,
          cashDrawerId: account === "cash" ? drawerId : undefined,
          amount: value,
          note: note || undefined,
          date: toISODate(new Date()),
        },
      });
      toast("Balance adjusted", "success");
      onDone();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to adjust", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
      <p className="text-xs text-ink-500">
        Correct a balance manually. Use a positive number to add money, a negative one to remove it.
      </p>
      <Field label="Amount (Rs)">
        <Input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" inputMode="decimal" />
      </Field>
      <Field label="Account">
        <Dropdown
          value={account}
          options={[
            { value: "cash", label: "Cash drawer" },
            { value: "bank", label: "Bank account" },
          ]}
          onChange={(v) => setAccount(v as MoneyAccount)}
        />
      </Field>
      {account === "bank" && (
        <Field label="Bank account">
          <Dropdown value={bankId} options={banks} onChange={setBankId} placeholder="Select bank\u2026" searchable />
        </Field>
      )}
      {account === "cash" && drawers.length > 0 && (
        <Field label="Cash drawer">
          <Dropdown value={drawerId} options={drawers} onChange={setDrawerId} placeholder="Select drawer\u2026" searchable />
        </Field>
      )}
      <Field label="Note">
        <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reason (required for audit)" />
      </Field>
      <Button type="submit" className="w-full" loading={busy}>
        Adjust
      </Button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-500">{label}</p>
      {children}
    </div>
  );
}
