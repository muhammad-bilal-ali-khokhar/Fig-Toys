"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import type { BankAccount, Contact, Voucher } from "@/lib/api-types";
import { useApi } from "@/lib/use-api";
import { VOUCHER_STATUS_FILTERS, VOUCHER_TYPE_FILTERS } from "@/lib/constants";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { hasPermission } from "@/lib/roles";
import { formatPKR } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet } from "@/components/ui/sheet";
import { Dropdown } from "@/components/ui/dropdown";
import { SearchInput } from "@/components/ui/search-input";
import { PageHeader } from "@/components/ui/page-header";
import { PaginationBar, usePagination } from "@/components/ui/pagination";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { SortHeader } from "@/components/ui/sort-header";
import { ContextMenu } from "@/components/ui/context-menu";
import { VoucherTypePill } from "@/components/ui/type-pill";
import { VoucherForm } from "@/components/vouchers/voucher-form";
import { ReverseVoucherDialog } from "@/components/vouchers/reverse-voucher-dialog";
import { RestoreVoucherDialog } from "@/components/vouchers/restore-voucher-dialog";
import { InvoiceViewer } from "@/components/transactions/invoice-viewer";
import { VoucherReceipt } from "@/components/transactions/transaction-receipt";
import { FilterIcon, PlusIcon, PrinterIcon, RefreshIcon, ReportsIcon, VoucherIcon, XIcon } from "@/components/icons";
import Link from "next/link";

type TypeFilter = "ALL" | "RECEIVING" | "PAYMENT";
type StatusFilter = "ALL" | "ACTIVE" | "REVERSED";
type SortKey = "date" | "amount" | "type";
type Sort = { key: SortKey; dir: "asc" | "desc" };

const VOUCHER_SORTS = [
  { value: "date-desc", label: "Newest first" },
  { value: "date-asc", label: "Oldest first" },
  { value: "amount-desc", label: "Amount: high to low" },
  { value: "amount-asc", label: "Amount: low to high" },
  { value: "type-asc", label: "Type A–Z" },
  { value: "type-desc", label: "Type Z–A" },
] as const;

export default function VouchersPage() {
  const { user } = useAuth();
  const { data: vouchers, loading, refetch } = useApi<Voucher[]>("/voucher");
  const { data: banks } = useApi<BankAccount[]>("/bank-account");
  const { data: contacts } = useApi<Contact[]>("/contact");

  const [typeFilter, setTypeFilter] = useState<TypeFilter>("ALL");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<Sort>({ key: "date", dir: "desc" });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [editing, setEditing] = useState<Voucher | null>(null);
  const [reversing, setReversing] = useState<Voucher | null>(null);
  const [restoring, setRestoring] = useState<Voucher | null>(null);
  const [viewing, setViewing] = useState<Voucher | null>(null);
  const [savedVoucher, setSavedVoucher] = useState<Voucher | null>(null);

  const canCreateVouchers = hasPermission(user, PERMISSIONS.voucherCreate);
  const canManageVouchers = hasPermission(user, PERMISSIONS.voucherUpdate);

  const filtered = useMemo(() => {
    if (!vouchers) return [];
    const q = search.trim().toLowerCase();
    const list = vouchers.filter(
      (v) =>
        (typeFilter === "ALL" || v.type === typeFilter) &&
        (statusFilter === "ALL" || v.status === statusFilter) &&
        (!q ||
          v.number.toLowerCase().includes(q) ||
          (v.narration ?? "").toLowerCase().includes(q) ||
          (v.contact?.name ?? "").toLowerCase().includes(q)),
    );
    const sign = sort.dir === "asc" ? 1 : -1;
    return list.sort((a, b) => {
      let cmp = 0;
      if (sort.key === "date") cmp = new Date(a.date).getTime() - new Date(b.date).getTime();
      else if (sort.key === "amount") cmp = parseFloat(a.amount) - parseFloat(b.amount);
      else cmp = a.type.localeCompare(b.type);
      if (cmp !== 0) return cmp * sign;
      return new Date(a.date).getTime() - new Date(b.date).getTime();
    });
  }, [vouchers, typeFilter, statusFilter, search, sort]);

  const { page: safePage, pageSize, setPage, setPageSize, pageCount, from, to, slice } = usePagination(
    filtered.length,
  );
  const pageItems = slice(filtered);

  useEffect(() => {
    setPage(1);
  }, [typeFilter, statusFilter, search, sort, pageSize]);

  const activeFilterCount =
    (typeFilter !== "ALL" ? 1 : 0) + (statusFilter !== "ALL" ? 1 : 0);

  function resetFilters() {
    setTypeFilter("ALL");
    setStatusFilter("ALL");
  }

  function onSort(key: SortKey) {
    setSort((prev) =>
      prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" },
    );
  }

  function onModifyRow(v: Voucher) {
    setEditing(v);
    setPanelOpen(true);
  }

  const totals = useMemo(() => {
    let received = 0;
    let paid = 0;
    for (const v of vouchers ?? []) {
      if (v.status !== "ACTIVE") continue;
      const value = parseFloat(v.amount) || 0;
      if (v.type === "RECEIVING") received += value;
      else paid += value;
    }
    return { received, paid, net: received - paid };
  }, [vouchers]);

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Vouchers"
        subtitle="Cash receiving & cash payment records"
        action={
          !panelOpen && (
            <div className="flex items-center gap-2">
              <Link
                href="/reports/cash"
                className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-ink-700 transition hover:bg-ink-50"
              >
                <ReportsIcon className="h-4 w-4" />
                Reports
              </Link>
              <Button onClick={() => setPanelOpen(true)} disabled={!canCreateVouchers}>
                <PlusIcon className="h-4 w-4" />
                New voucher
              </Button>
            </div>
          )
        }
      />

      {panelOpen ? (
        <VoucherForm
          key={editing?.id ?? "new"}
          contacts={contacts}
          banks={banks}
          editing={editing}
          onClose={() => {
            setPanelOpen(false);
            setEditing(null);
          }}
          onCreated={(v) => setSavedVoucher(v)}
          onSaved={() => {
            setPanelOpen(false);
            setEditing(null);
            void refetch();
          }}
        />
      ) : savedVoucher ? (
        <div className="flex h-full items-start justify-center overflow-y-auto overscroll-none p-4">
          <VoucherReceipt
            voucher={savedVoucher}
            onNew={() => {
              setSavedVoucher(null);
              setPanelOpen(true);
            }}
          />
        </div>
      ) : (
        <>
          <div className="mb-3 grid shrink-0 grid-cols-3 gap-2">
            <StatCard label="Received" value={formatPKR(totals.received)} variant="brand" />
            <StatCard label="Paid out" value={formatPKR(totals.paid)} variant="grey" />
            <StatCard
              label="Net cash"
              value={formatPKR(totals.net)}
              valueClassName={totals.net >= 0 ? "text-ink-900" : "text-brand-600"}
            />
          </div>

          <div className="mb-3 flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search number, narration, contact…"
              variant="white"
              wrapperClassName="min-w-[220px] flex-1"
            />
            <div className="flex items-center gap-2">
              <Button variant="grey" onClick={() => setFiltersOpen(true)}>
                <FilterIcon className="h-4 w-4" />
                Filters
                {activeFilterCount > 0 && (
                  <Badge variant="brandSolid">{activeFilterCount}</Badge>
                )}
              </Button>
              <div className="w-56">
                <Dropdown
                  value={`${sort.key}-${sort.dir}`}
                  options={VOUCHER_SORTS.map((s) => ({ value: s.value, label: s.label }))}
                  onChange={(v) => {
                    const [key, dir] = v.split("-") as [SortKey, "asc" | "desc"];
                    setSort({ key, dir });
                  }}
                  placeholder="Sort"
                />
              </div>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-none rounded-2xl bg-white">
            {loading ? (
              <p className="py-10 text-center text-sm text-ink-400">Loading vouchers…</p>
            ) : filtered.length === 0 ? (
              <EmptyState
                icon={<VoucherIcon className="h-10 w-10 text-ink-300" />}
                title={
                  vouchers && vouchers.length > 0
                    ? "No vouchers match these filters"
                    : "No vouchers yet. Record cash in and cash out here"
                }
                action={
                  canCreateVouchers && vouchers && vouchers.length === 0 ? (
                    <Button variant="grey" onClick={() => setPanelOpen(true)}>
                      <PlusIcon className="h-4 w-4" />
                      Create your first voucher
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white">
                  <tr className="text-left text-xs uppercase tracking-wide text-ink-500">
                    <th className="px-5 py-2">No.</th>
                    <SortHeader label="Type" k="type" sort={sort} onSort={onSort} />
                    <th className="px-5 py-2">Narration / Contact</th>
                    <SortHeader label="Date" k="date" sort={sort} onSort={onSort} />
                    <SortHeader label="Amount" k="amount" sort={sort} onSort={onSort} right />
                    <th className="px-5 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((v) => {
                    const inAmount = v.type === "RECEIVING";
                    return (
                      <tr key={v.id} className="border-t border-ink-100 transition hover:bg-ink-50">
                        <td className="px-5 py-2 font-mono text-xs font-bold text-ink-900">{v.number}</td>
                        <td className="px-5 py-2">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <VoucherTypePill type={v.type} />
                            <Badge variant={v.status === "ACTIVE" ? "neutral" : "muted"}>
                              {v.status === "ACTIVE" ? "Active" : "Reversed"}
                            </Badge>
                          </div>
                        </td>
                        <td className="max-w-xs px-5 py-2 text-ink-700">
                          <p className="truncate">
                            {v.narration || <span className="italic text-ink-300">No narration</span>}
                          </p>
                          {v.contact && <p className="text-xs text-ink-400">{v.contact.name}</p>}
                        </td>
                        <td className="whitespace-nowrap px-5 py-2 text-ink-500">
                          {new Date(v.date).toLocaleDateString()}
                          {v.status === "REVERSED" && <span className="ml-1 text-xs text-ink-400">· reversed</span>}
                        </td>
                        <td className="px-5 py-2 text-right font-semibold text-brand-600">
                          {inAmount ? "+" : "-"}
                          {formatPKR(parseFloat(v.amount))}
                        </td>
                        <td className="px-5 py-2">
                          <div className="flex items-center justify-end gap-1.5">
                            <Link
                              href={`/print?type=VOUCHER&id=${v.id}`}
                              target="_blank"
                              className="rounded-xl bg-ink-100 px-3 py-1.5 text-xs font-semibold text-ink-600 transition hover:bg-ink-200"
                            >
                              <PrinterIcon className="mr-0.5 inline h-3 w-3" />
                              Print
                            </Link>
                            <button
                              type="button"
                              onClick={() => setViewing(v)}
                              className="rounded-xl bg-ink-100 px-3 py-1.5 text-xs font-semibold text-brand-600 transition hover:bg-brand-50"
                            >
                              View
                            </button>
                            {v.status === "ACTIVE" && canManageVouchers ? (
                              <ContextMenu
                                items={[
                                  { label: "Modify", onClick: () => onModifyRow(v) },
                                  { label: "Reverse", leading: <XIcon className="h-4 w-4" />, danger: true, onClick: () => setReversing(v) },
                                ]}
                              />
                            ) : (
                              canManageVouchers && (
                                <ContextMenu
                                  items={[
                                    { label: "Re-open", leading: <RefreshIcon className="h-4 w-4" />, onClick: () => setRestoring(v) },
                                  ]}
                                />
                              )
                            )}
                          </div>
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

      <Sheet
        open={filtersOpen}
        title="Filters"
        onClose={() => setFiltersOpen(false)}
        width="max-w-md"
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-ink-500">Type</label>
            <Dropdown
              value={typeFilter}
              onChange={(v) => setTypeFilter(v as typeof typeFilter)}
              options={VOUCHER_TYPE_FILTERS.map((f) => ({ value: f.value, label: f.label }))}
              placeholder="All types"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-ink-500">Status</label>
            <Dropdown
              value={statusFilter}
              onChange={(v) => setStatusFilter(v as typeof statusFilter)}
              options={VOUCHER_STATUS_FILTERS.map((f) => ({ value: f.value, label: f.label }))}
              placeholder="All statuses"
            />
          </div>
          <div className="flex items-center justify-between pt-2">
            <p className="text-sm text-ink-500">{filtered.length} voucher(s)</p>
            <div className="flex items-center gap-2">
              <Button variant="grey" onClick={resetFilters}>
                Reset
              </Button>
              <Button onClick={() => setFiltersOpen(false)}>Show results</Button>
            </div>
          </div>
        </div>
      </Sheet>

      {reversing && (
        <ReverseVoucherDialog
          voucher={reversing}
          onClose={() => setReversing(null)}
          onReversed={() => {
            setReversing(null);
            void refetch();
          }}
        />
      )}

      {restoring && (
        <RestoreVoucherDialog
          voucher={restoring}
          onClose={() => setRestoring(null)}
          onRestored={() => {
            setRestoring(null);
            void refetch();
          }}
        />
      )}

      {viewing && (
        <InvoiceViewer type="VOUCHER" id={viewing.id} onClose={() => setViewing(null)} />
      )}
    </div>
  );
}
