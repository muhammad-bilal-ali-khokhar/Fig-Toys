"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import type { BankAccount, CashDrawer, MoneyMovement } from "@/lib/api-types";
import { apiRequest } from "@/lib/apiClient";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { hasPermission } from "@/lib/roles";
import { formatPKR } from "@/lib/money";
import { toISODate } from "@/lib/dates";
import { useDirtyForm } from "@/lib/use-dirty-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dropdown } from "@/components/ui/dropdown";
import { SearchInput } from "@/components/ui/search-input";
import { PageHeader } from "@/components/ui/page-header";
import { PaginationBar, usePagination } from "@/components/ui/pagination";
import { EmptyState } from "@/components/ui/empty-state";
import { StatCard } from "@/components/ui/stat-card";
import { SortHeader } from "@/components/ui/sort-header";
import { DiscardConfirmDialog } from "@/components/ui/discard-confirm-dialog";
import { TransferIcon } from "@/components/icons";
import { useToast } from "@/components/ui/toast";

type MoneyAccount = "cash" | "bank";
type SortKey = "date" | "amount";
type Sort = { key: SortKey; dir: "asc" | "desc" };

const SORTS = [
  { value: "date-desc", label: "Newest first" },
  { value: "date-asc", label: "Oldest first" },
  { value: "amount-desc", label: "Amount: high to low" },
  { value: "amount-asc", label: "Amount: low to high" },
] as const;

function accountLabel(m: MoneyMovement) {
  if (m.account === "bank" && m.bankAccount) return `${m.bankAccount.bankName} · ${m.bankAccount.name}`;
  if (m.account === "cash" && m.cashDrawer) return m.cashDrawer.name;
  if (m.account === "cash") return "Cash";
  return "Bank";
}

function accountShort(m: MoneyMovement) {
  if (m.account === "bank" && m.bankAccount) return m.bankAccount.name;
  if (m.account === "cash" && m.cashDrawer) return m.cashDrawer.name;
  return m.account === "cash" ? "Cash" : "Bank";
}

function BanknoteIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <circle cx="12" cy="12" r="2" />
      <path d="M6 12h.01M18 12h.01" />
    </svg>
  );
}

function ArrowRightIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

export default function TransfersPage() {
  const { user } = useAuth();
  const canWrite = hasPermission(user, PERMISSIONS.moneyWrite);

  const [movements, setMovements] = useState<MoneyMovement[]>([]);
  const [banks, setBanks] = useState<BankAccount[]>([]);
  const [drawers, setDrawers] = useState<CashDrawer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<Sort>({ key: "date", dir: "desc" });
  const [panelOpen, setPanelOpen] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const [mv, ov] = await Promise.all([
        apiRequest<MoneyMovement[]>("/money/movements"),
        apiRequest<{ cashDrawers: CashDrawer[] }>("/money"),
      ]);
      setMovements((mv ?? []).filter((m) => m.kind === "TRANSFER"));
      setDrawers(ov?.cashDrawers ?? []);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    void apiRequest<BankAccount[]>("/bank-account").then(setBanks).catch(() => {});
  }, []);

  const bankOptions = banks.map((b) => ({
    value: b.id,
    label: `${b.bankName} · ${b.name}`,
  }));

  const drawerOptions = drawers.map((d) => ({
    value: d.id,
    label: d.name + (d.isDefault ? " (default)" : ""),
  }));

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = movements.filter(
      (m) =>
        !q ||
        (m.note ?? "").toLowerCase().includes(q) ||
        accountLabel(m).toLowerCase().includes(q),
    );
    const sign = sort.dir === "asc" ? 1 : -1;
    return list.sort((a, b) => {
      let cmp = 0;
      if (sort.key === "date") cmp = new Date(a.date).getTime() - new Date(b.date).getTime();
      else cmp = parseFloat(a.amount) - parseFloat(b.amount);
      return cmp * sign;
    });
  }, [movements, search, sort]);

  const { page: safePage, pageSize, setPage, setPageSize, pageCount, from, to, slice } = usePagination(
    filtered.length,
  );
  const pageItems = slice(filtered);

  useEffect(() => {
    setPage(1);
  }, [search, sort, pageSize]);

  const totals = useMemo(() => {
    let totalIn = 0;
    let totalOut = 0;
    for (const m of movements) {
      const value = parseFloat(m.amount) || 0;
      if (m.kind === "IN") totalIn += value;
      else totalOut += value;
    }
    return { totalIn, totalOut, net: totalIn - totalOut };
  }, [movements]);

  function onSort(key: SortKey) {
    setSort((prev) =>
      prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" },
    );
  }

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Transfers"
        subtitle="Move money between cash drawers, bank accounts, or both"
        action={
          !panelOpen && (
            <Button onClick={() => setPanelOpen(true)} disabled={!canWrite}>
              New transfer
            </Button>
          )
        }
      />

      {panelOpen ? (
        <TransferForm
          banks={bankOptions}
          drawers={drawerOptions}
          onDone={() => {
            setPanelOpen(false);
            void refresh();
          }}
          onCancel={() => setPanelOpen(false)}
        />
      ) : (
        <>
          <div className="mb-3 grid shrink-0 grid-cols-3 gap-2">
            <StatCard label="Total in" value={formatPKR(totals.totalIn)} variant="brand" />
            <StatCard label="Total out" value={formatPKR(totals.totalOut)} variant="grey" />
            <StatCard
              label="Net flow"
              value={formatPKR(totals.net)}
              valueClassName={totals.net >= 0 ? "text-ink-900" : "text-brand-600"}
            />
          </div>

          <div className="mb-3 flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search note, account…"
              variant="white"
              wrapperClassName="min-w-[220px] flex-1"
            />
            <div className="w-56">
              <Dropdown
                value={`${sort.key}-${sort.dir}`}
                options={SORTS.map((s) => ({ value: s.value, label: s.label }))}
                onChange={(v) => {
                  const [key, dir] = v.split("-") as [SortKey, "asc" | "desc"];
                  setSort({ key, dir });
                }}
                placeholder="Sort"
                searchable
              />
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-none rounded-2xl bg-white">
            {loading ? (
              <p className="py-10 text-center text-sm text-ink-400">Loading transfers…</p>
            ) : filtered.length === 0 ? (
              <EmptyState
                icon={<TransferIcon className="h-10 w-10 text-ink-300" />}
                title={
                  movements.length > 0
                    ? "No transfers match these filters"
                    : "No transfers yet. Move money between drawers and banks here."
                }
                action={
                  canWrite && movements.length === 0 ? (
                    <Button variant="grey" onClick={() => setPanelOpen(true)}>
                      Record your first transfer
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white">
                  <tr className="text-left text-xs uppercase tracking-wide text-ink-500">
                    <SortHeader label="Date" k="date" sort={sort} onSort={onSort} />
                    <th className="px-5 py-2">Flow</th>
                    <th className="px-5 py-2">Note</th>
                    <SortHeader label="Amount" k="amount" sort={sort} onSort={onSort} right />
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((m) => {
                    const isIn = m.kind === "IN";
                    const val = parseFloat(m.amount) || 0;
                    return (
                      <tr key={m.id} className="group border-t border-ink-100 transition hover:bg-ink-50/60">
                        <td className="whitespace-nowrap px-5 py-3 text-xs text-ink-500">
                          {new Date(m.date).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <span className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold ${isIn ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                              {isIn ? (
                                <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={2} className="h-3 w-3">
                                  <path d="M6 9V3M3 5l3-3 3 3" />
                                </svg>
                              ) : (
                                <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={2} className="h-3 w-3">
                                  <path d="M6 3v6M3 7l3 3 3-3" />
                                </svg>
                              )}
                              {isIn ? "In" : "Out"}
                            </span>
                            <span className="text-xs text-ink-400">from</span>
                            <span className="rounded-lg bg-ink-100 px-2 py-1 text-xs font-medium text-ink-700">
                              {accountShort(m)}
                            </span>
                          </div>
                        </td>
                        <td className="max-w-xs px-5 py-3 text-xs text-ink-400">
                          {m.note || "—"}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <span className={`text-sm font-bold ${isIn ? "text-emerald-600" : "text-amber-600"}`}>
                            {isIn ? "+" : "−"}{formatPKR(val)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          <PaginationBar
            className="mt-3"
            from={from}
            to={to}
            total={filtered.length}
            page={safePage}
            pageCount={pageCount}
            pageSize={pageSize}
            onPrev={() => setPage(safePage - 1)}
            onNext={() => setPage(safePage + 1)}
            onPageSize={setPageSize}
          />
        </>
      )}
    </div>
  );
}

function TransferForm({
  banks,
  drawers,
  onDone,
  onCancel,
}: {
  banks: { value: string; label: string }[];
  drawers: { value: string; label: string }[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const { toast } = useToast();
  const [from, setFrom] = useState<MoneyAccount>("cash");
  const [fromBankId, setFromBankId] = useState(banks[0]?.value ?? "");
  const [fromDrawerId, setFromDrawerId] = useState(drawers.find((d) => d.label.includes("default"))?.value ?? drawers[0]?.value ?? "");
  const [to, setTo] = useState<MoneyAccount>("bank");
  const [toBankId, setToBankId] = useState(banks[0]?.value ?? "");
  const [toDrawerId, setToDrawerId] = useState(drawers.find((d) => d.label.includes("default"))?.value ?? drawers[0]?.value ?? "");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const dirty = useDirtyForm({ from, fromBankId, fromDrawerId, to, toBankId, toDrawerId, amount, note });

  function update(partial: Partial<{ from: MoneyAccount; fromBankId: string; fromDrawerId: string; to: MoneyAccount; toBankId: string; toDrawerId: string; amount: string; note: string }>) {
    const next = { from, fromBankId, fromDrawerId, to, toBankId, toDrawerId, amount, note, ...partial };
    if (partial.from !== undefined) setFrom(partial.from);
    if (partial.fromBankId !== undefined) setFromBankId(partial.fromBankId);
    if (partial.fromDrawerId !== undefined) setFromDrawerId(partial.fromDrawerId);
    if (partial.to !== undefined) setTo(partial.to);
    if (partial.toBankId !== undefined) setToBankId(partial.toBankId);
    if (partial.toDrawerId !== undefined) setToDrawerId(partial.toDrawerId);
    if (partial.amount !== undefined) setAmount(partial.amount);
    if (partial.note !== undefined) setNote(partial.note);
    dirty.markDirty(next);
  }

  const fromLabel = from === "bank" ? banks.find((b) => b.value === fromBankId)?.label ?? "Select bank…" : drawers.find((d) => d.value === fromDrawerId)?.label ?? "Select drawer…";
  const toLabel = to === "bank" ? banks.find((b) => b.value === toBankId)?.label ?? "Select bank…" : drawers.find((d) => d.value === toDrawerId)?.label ?? "Select drawer…";

  async function save() {
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
    setSubmitting(true);
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
      setSubmitting(false);
    }
  }

  const isBankToCash = from === "bank" && to === "cash";
  const isCashToBank = from === "cash" && to === "bank";
  const isDrawerToDrawer = from === "cash" && to === "cash";
  const isBankToBank = from === "bank" && to === "bank";

  return (
    <form
      className="flex h-full flex-col"
      onSubmit={(e) => { e.preventDefault(); void save(); }}
    >
      <div className="grid min-h-0 flex-1 gap-5 pb-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-4">
          <div className="rounded-3xl bg-white p-5">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-400">Quick select</p>
            <div className="grid grid-cols-2 gap-3">
              <DirectionCard
                active={isBankToCash}
                onClick={() => update({ from: "bank", to: "cash" })}
                icon={<BanknoteIcon className="h-5 w-5" />}
                title="Bank to Cash"
                desc="Withdraw from bank into drawer"
              />
              <DirectionCard
                active={isCashToBank}
                onClick={() => update({ from: "cash", to: "bank" })}
                icon={<BanknoteIcon className="h-5 w-5" />}
                title="Cash to Bank"
                desc="Deposit from drawer into bank"
              />
              <DirectionCard
                active={isDrawerToDrawer}
                onClick={() => update({ from: "cash", to: "cash" })}
                icon={<TransferIcon className="h-5 w-5" />}
                title="Drawer to Drawer"
                desc="Move between cash drawers"
              />
              <DirectionCard
                active={isBankToBank}
                onClick={() => update({ from: "bank", to: "bank" })}
                icon={<TransferIcon className="h-5 w-5" />}
                title="Bank to Bank"
                desc="Transfer between bank accounts"
              />
            </div>
          </div>

          <div className="rounded-3xl bg-white p-5">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-400">Amount</p>
            <div className="flex items-center rounded-2xl bg-ink-50 px-4 focus-within:ring-2 focus-within:ring-brand-500/60 focus-within:bg-white transition">
              <span className="ml-1 text-lg font-bold text-ink-400">Rs</span>
              <input
                value={amount}
                onChange={(e) => update({ amount: e.target.value })}
                placeholder="0"
                inputMode="decimal"
                className="w-full bg-transparent px-3 py-3.5 text-3xl font-bold text-ink-900 outline-none placeholder:text-ink-300"
                autoFocus
              />
            </div>
          </div>

          <div className="rounded-3xl bg-white p-5">
            <div className="mb-3 flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
                <ArrowRightIcon className="h-4 w-4 rotate-180" />
              </div>
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">From</p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <Dropdown
                value={from}
                options={[
                  { value: "cash", label: "Cash drawer" },
                  { value: "bank", label: "Bank account" },
                ]}
                onChange={(v) => update({ from: v as MoneyAccount })}
              />
              {from === "bank" ? (
                <Dropdown
                  value={fromBankId}
                  options={banks}
                  onChange={(v) => update({ fromBankId: v })}
                  placeholder="Select bank…"
                  searchable
                />
              ) : drawers.length > 0 ? (
                <Dropdown
                  value={fromDrawerId}
                  options={drawers}
                  onChange={(v) => update({ fromDrawerId: v })}
                  placeholder="Select drawer…"
                  searchable
                />
              ) : null}
            </div>
          </div>

          <div className="flex justify-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-100 text-brand-600">
              <ArrowRightIcon className="h-5 w-5" />
            </div>
          </div>

          <div className="rounded-3xl bg-white p-5">
            <div className="mb-3 flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
                <ArrowRightIcon className="h-4 w-4" />
              </div>
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">To</p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <Dropdown
                value={to}
                options={[
                  { value: "cash", label: "Cash drawer" },
                  { value: "bank", label: "Bank account" },
                ]}
                onChange={(v) => update({ to: v as MoneyAccount })}
              />
              {to === "bank" ? (
                <Dropdown
                  value={toBankId}
                  options={banks}
                  onChange={(v) => update({ toBankId: v })}
                  placeholder="Select bank…"
                  searchable
                />
              ) : drawers.length > 0 ? (
                <Dropdown
                  value={toDrawerId}
                  options={drawers}
                  onChange={(v) => update({ toDrawerId: v })}
                  placeholder="Select drawer…"
                  searchable
                />
              ) : null}
            </div>
          </div>

          <div className="rounded-3xl bg-white p-5">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-400">Note</p>
            <Input
              value={note}
              onChange={(e) => update({ note: e.target.value })}
              placeholder="Optional note for this transfer"
              className="bg-ink-50 focus:bg-white transition"
            />
          </div>
        </div>

        <div className="self-start lg:sticky lg:top-0">
          <TransferPreview
            from={from}
            to={to}
            fromLabel={fromLabel}
            toLabel={toLabel}
            amount={amount}
            note={note}
          />
          <Button type="submit" className="mt-3 w-full" loading={submitting}>
            Record transfer
          </Button>
          <Button variant="grey" type="button" className="mt-2 w-full" onClick={() => dirty.requestClose(onCancel)}>
            Cancel
          </Button>
        </div>
      </div>

      <DiscardConfirmDialog
        open={dirty.confirmOpen}
        onConfirm={dirty.confirmDiscard}
        onCancel={dirty.cancelDiscard}
      />
    </form>
  );
}

function DirectionCard({
  active,
  onClick,
  icon,
  title,
  desc,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  desc: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative rounded-2xl p-4 text-left transition ${
        active
          ? "bg-brand-600 text-white"
          : "bg-ink-50 text-ink-600 hover:bg-ink-100"
      }`}
    >
      <span
        className={`flex h-9 w-9 items-center justify-center rounded-xl ${
          active ? "bg-white/20 text-white" : "bg-white text-brand-600"
        }`}
      >
        {icon}
      </span>
      <p className="mt-2.5 text-sm font-bold">{title}</p>
      <p className={`mt-0.5 text-[11px] ${active ? "text-white/70" : "text-ink-400"}`}>
        {desc}
      </p>
    </button>
  );
}

function TransferPreview({
  from,
  to,
  fromLabel,
  toLabel,
  amount,
  note,
}: {
  from: MoneyAccount;
  to: MoneyAccount;
  fromLabel: string;
  toLabel: string;
  amount: string;
  note: string;
}) {
  const value = parseFloat(amount) || 0;

  const dirLabel = from === "bank" && to === "cash" ? "Bank to Cash"
    : from === "cash" && to === "bank" ? "Cash to Bank"
    : from === "cash" && to === "cash" ? "Drawer to Drawer"
    : from === "bank" && to === "bank" ? "Bank to Bank"
    : "Transfer";

  return (
    <div className="rounded-3xl border border-ink-100 bg-white p-5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">Transfer preview</p>
        <p className="font-mono text-xs font-bold text-ink-300">{dirLabel}</p>
      </div>
      <div className="my-4 border-t border-dashed border-ink-200" />
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-ink-100 bg-brand-50/60 text-brand-600">
          <BanknoteIcon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="text-base font-bold text-ink-900">Money Transfer</p>
          <p className="text-xs text-ink-400">{fromLabel} → {toLabel}</p>
        </div>
      </div>
      <p className="mt-4 text-3xl font-bold text-brand-600">
        {value > 0 ? formatPKR(value) : "Rs 0"}
      </p>
      <div className="mt-4 space-y-2 text-sm">
        <div className="flex justify-between gap-3">
          <span className="text-ink-400">From</span>
          <span className="truncate font-semibold text-ink-900">{fromLabel}</span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="text-ink-400">To</span>
          <span className="truncate font-semibold text-ink-900">{toLabel}</span>
        </div>
        {note && (
          <div className="flex justify-between gap-3">
            <span className="text-ink-400">Note</span>
            <span className="truncate font-semibold text-ink-900">{note}</span>
          </div>
        )}
      </div>
      <div className="mt-4 rounded-2xl bg-ink-50 px-3 py-2.5 text-xs text-ink-500">
        Moves {value > 0 ? formatPKR(value) : "Rs 0"} from {from === "bank" ? "bank" : "cash drawer"} to {to === "bank" ? "bank" : "cash drawer"}. Both balances update instantly.
      </div>
    </div>
  );
}
