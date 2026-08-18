"use client";

import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "@/lib/apiClient";
import { useAuth } from "@/lib/auth-context";
import type { Contact, Expense } from "@/lib/api-types";
import { useApi } from "@/lib/use-api";
import {
  EXPENSE_CATEGORY_LABELS,
  EXPENSE_DATE_FILTERS,
  EXPENSE_FILTERS,
  EXPENSE_SORTS,
  EXPENSE_TEXT,
} from "@/lib/constants";
import type { ExpenseDateFilter } from "@/lib/constants";
import { PERMISSIONS } from "@/lib/constants/permissions";
import { hasPermission } from "@/lib/roles";
import { formatPKR } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { Sheet } from "@/components/ui/sheet";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { SearchInput } from "@/components/ui/search-input";
import { Dropdown } from "@/components/ui/dropdown";
import { PaginationBar, usePagination } from "@/components/ui/pagination";
import { SortHeader } from "@/components/ui/sort-header";
import { ContextMenu } from "@/components/ui/context-menu";
import { ExpenseCategoryPill } from "@/components/ui/type-pill";
import { useToast } from "@/components/ui/toast";
import { ExpenseForm } from "@/components/expenses/expense-form";
import { InvoiceViewer } from "@/components/transactions/invoice-viewer";
import { ExpenseReceipt } from "@/components/transactions/transaction-receipt";
import { FilterIcon, PlusIcon, PrinterIcon, RefreshIcon, ReportsIcon, TrashIcon, WalletIcon } from "@/components/icons";
import Link from "next/link";

type SortKey = "date" | "amount" | "category";
type Sort = { key: SortKey; dir: "asc" | "desc" };

function inRange(date: Date, from: Date, to?: Date) {
  const t = date.getTime();
  if (t < from.getTime()) return false;
  if (to && t > to.getTime()) return false;
  return true;
}

export default function ExpensesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { data: expenses, loading, refetch } = useApi<Expense[]>("/expense");
  const { data: contacts } = useApi<Contact[]>("/contact");

  const [categoryFilter, setCategoryFilter] = useState<"ALL" | Expense["category"]>("ALL");
  const [dateFilter, setDateFilter] = useState<ExpenseDateFilter>("ALL");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<Sort>({ key: "date", dir: "desc" });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [deleting, setDeleting] = useState<Expense | null>(null);
  const [viewing, setViewing] = useState<Expense | null>(null);
  const [savedExpense, setSavedExpense] = useState<Expense | null>(null);

  const canCreateExpenses = hasPermission(user, PERMISSIONS.expenseCreate);
  const canManageExpenses = hasPermission(user, PERMISSIONS.expenseUpdate);

  const filtered = useMemo(() => {
    if (!expenses) return [];
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    weekStart.setHours(0, 0, 0, 0);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    const yearStart = new Date(now.getFullYear(), 0, 1);

    const q = search.trim().toLowerCase();
    const list = expenses.filter((e) => {
      if (categoryFilter !== "ALL" && e.category !== categoryFilter) return false;
      const t = new Date(e.date);
      if (dateFilter === "WEEK" && !inRange(t, weekStart)) return false;
      if (dateFilter === "MONTH" && !inRange(t, monthStart)) return false;
      if (dateFilter === "LAST_MONTH" && !inRange(t, lastStart, lastEnd)) return false;
      if (dateFilter === "YEAR" && !inRange(t, yearStart)) return false;
      if (q) {
        const haystack = [
          e.number,
          e.note ?? "",
          EXPENSE_CATEGORY_LABELS[e.category] ?? e.category,
          e.contact?.name ?? "",
          formatPKR(parseFloat(e.amount)),
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });

    const sign = sort.dir === "asc" ? 1 : -1;
    return list.sort((a, b) => {
      let cmp = 0;
      if (sort.key === "date") cmp = new Date(a.date).getTime() - new Date(b.date).getTime();
      else if (sort.key === "amount") cmp = parseFloat(a.amount) - parseFloat(b.amount);
      else cmp = (EXPENSE_CATEGORY_LABELS[a.category] ?? a.category).localeCompare(
        EXPENSE_CATEGORY_LABELS[b.category] ?? b.category,
      );
      if (cmp !== 0) return cmp * sign;
      return new Date(a.date).getTime() - new Date(b.date).getTime();
    });
  }, [expenses, categoryFilter, dateFilter, search, sort]);

  const { page: safePage, pageSize, setPage, setPageSize, pageCount, from, to, slice } = usePagination(
    filtered.length,
  );
  const pageItems = slice(filtered);

  useEffect(() => {
    setPage(1);
  }, [categoryFilter, dateFilter, search, sort, pageSize]);

  const stats = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const yearStart = new Date(now.getFullYear(), 0, 1);
    let month = 0;
    let last = 0;
    let year = 0;
    for (const e of expenses ?? []) {
      const value = parseFloat(e.amount) || 0;
      const t = new Date(e.date).getTime();
      if (t >= monthStart.getTime()) month += value;
      if (t >= lastStart.getTime() && t < monthStart.getTime()) last += value;
      if (t >= yearStart.getTime()) year += value;
    }
    return { month, last, year };
  }, [expenses]);

  const notes = useMemo(
    () => (expenses ?? []).map((e) => e.note ?? "").filter(Boolean),
    [expenses],
  );

  const hasFilters =
    categoryFilter !== "ALL" || dateFilter !== "ALL" || search.trim() !== "";

  const activeFilterCount =
    (categoryFilter !== "ALL" ? 1 : 0) + (dateFilter !== "ALL" ? 1 : 0);

  function clearFilters() {
    setCategoryFilter("ALL");
    setDateFilter("ALL");
    setSearch("");
    setSort({ key: "date", dir: "desc" });
  }

  function resetFilters() {
    setCategoryFilter("ALL");
    setDateFilter("ALL");
  }

  function onSort(key: SortKey) {
    setSort((prev) =>
      prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" },
    );
  }

  function onModifyRow(e: Expense) {
    setEditing(e);
    setPanelOpen(true);
  }

  async function confirmDelete() {
    if (!deleting) return;
    const target = deleting;
    try {
      await apiRequest(`/expense/${target.id}`, { method: "DELETE" });
      setDeleting(null);
      toast("Expense deleted", "success", undefined, {
        label: "Undo",
        onClick: () => void undoDelete(target),
      });
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not delete expense", "error");
      setDeleting(null);
    }
  }

  async function undoDelete(target: Expense) {
    try {
      await apiRequest<Expense>("/expense", {
        method: "POST",
        body: {
          category: target.category,
          amount: parseFloat(target.amount),
          note: target.note || undefined,
          contactId: target.contact?.id || undefined,
          date: target.date,
        },
      });
      toast("Expense restored", "success");
      void refetch();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not restore expense", "error");
    }
  }

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Expenses"
        subtitle={EXPENSE_TEXT.subtitle}
        action={
          !panelOpen && (
            <div className="flex items-center gap-2">
              <Link
                href="/reports/expenses"
                className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-ink-700 transition hover:bg-ink-50"
              >
                <ReportsIcon className="h-4 w-4" />
                Reports
              </Link>
              <Button onClick={() => setPanelOpen(true)} disabled={!canCreateExpenses}>
                <PlusIcon className="h-4 w-4" />
                New expense
              </Button>
            </div>
          )
        }
      />

      {panelOpen ? (
        <ExpenseForm
          key={editing?.id ?? "new"}
          editing={editing}
          contacts={contacts ?? []}
          notes={notes}
          onClose={() => {
            setPanelOpen(false);
            setEditing(null);
          }}
          onCreated={(e) => setSavedExpense(e)}
          onSaved={() => {
            setPanelOpen(false);
            setEditing(null);
            void refetch();
          }}
        />
      ) : savedExpense ? (
        <div className="flex h-full items-start justify-center overflow-y-auto overscroll-none p-4">
          <ExpenseReceipt
            expense={savedExpense}
            onNew={() => {
              setSavedExpense(null);
              setPanelOpen(true);
            }}
          />
        </div>
      ) : (
        <>
          <div className="mb-3 grid shrink-0 grid-cols-3 gap-2">
            <StatCard label={EXPENSE_TEXT.thisMonth} value={formatPKR(stats.month)} variant="brand" />
            <StatCard label={EXPENSE_TEXT.lastMonth} value={formatPKR(stats.last)} variant="grey" />
            <StatCard label={EXPENSE_TEXT.thisYear} value={formatPKR(stats.year)} />
          </div>

          <div className="mb-3 flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder={EXPENSE_TEXT.searchPlaceholder}
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
                  options={EXPENSE_SORTS.map((s) => ({ value: s.value, label: s.label }))}
                  onChange={(v) => {
                    const [key, dir] = v.split("-") as [SortKey, "asc" | "desc"];
                    setSort({ key, dir });
                  }}
                  placeholder={EXPENSE_TEXT.sort}
                />
              </div>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-none rounded-2xl bg-white">
            {loading ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-[52px]" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <EmptyState
                icon={<WalletIcon className="h-10 w-10 text-ink-300" />}
                title={
                  expenses && expenses.length > 0 ? EXPENSE_TEXT.noMatch : EXPENSE_TEXT.noData
                }
                action={
                  expenses && expenses.length > 0 && hasFilters ? (
                    <Button variant="grey" onClick={clearFilters}>
                      <RefreshIcon className="h-4 w-4" />
                      {EXPENSE_TEXT.clearFilters}
                    </Button>
                  ) : canCreateExpenses && expenses && expenses.length === 0 ? (
                    <Button variant="grey" onClick={() => setPanelOpen(true)}>
                      <PlusIcon className="h-4 w-4" />
                      Record your first expense
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white">
                  <tr className="text-left text-xs uppercase tracking-wide text-ink-500">
                    <th className="px-5 py-2">No.</th>
                    <SortHeader label="Category" k="category" sort={sort} onSort={onSort} />
                    <th className="px-5 py-2">Note / Contact</th>
                    <SortHeader label="Date" k="date" sort={sort} onSort={onSort} />
                    <SortHeader label="Amount" k="amount" sort={sort} onSort={onSort} right />
                    <th className="px-5 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {pageItems.map((e) => (
                    <tr
                      key={e.id}
                      className="border-t border-ink-100 transition hover:bg-ink-50"
                    >
                      <td className="px-5 py-2 font-mono text-xs font-bold text-ink-900">{e.number}</td>
                      <td className="px-5 py-2">
                        <ExpenseCategoryPill
                          category={e.category}
                          label={EXPENSE_CATEGORY_LABELS[e.category] ?? e.category}
                        />
                      </td>
                      <td className="max-w-xs px-5 py-2 text-ink-700">
                        <p className="truncate">
                          {e.note || <span className="italic text-ink-300">No note</span>}
                        </p>
                        {e.contact && <p className="text-xs text-ink-400">{e.contact.name}</p>}
                      </td>
                      <td className="whitespace-nowrap px-5 py-2 text-ink-500">
                        {new Date(e.date).toLocaleDateString()}
                      </td>
                      <td className="px-5 py-2 text-right font-semibold text-brand-600">
                        {formatPKR(parseFloat(e.amount))}
                      </td>
                      <td className="px-5 py-2">
                        <div className="flex items-center justify-end gap-1.5">
                          <Link
                            href={`/print?type=EXPENSE&id=${e.id}`}
                            target="_blank"
                            className="rounded-xl bg-ink-100 px-3 py-1.5 text-xs font-semibold text-ink-600 transition hover:bg-ink-200"
                          >
                            <PrinterIcon className="mr-0.5 inline h-3 w-3" />
                            Print
                          </Link>
                          <button
                            type="button"
                            onClick={() => setViewing(e)}
                            className="rounded-xl bg-ink-100 px-3 py-1.5 text-xs font-semibold text-brand-600 transition hover:bg-brand-50"
                          >
                            View
                          </button>
                          {canManageExpenses && (
                            <ContextMenu
                              items={[
                                { label: "Modify", onClick: () => onModifyRow(e) },
                                { label: "Delete", leading: <TrashIcon className="h-4 w-4" />, danger: true, onClick: () => setDeleting(e) },
                              ]}
                            />
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
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

      <Dialog
        open={!!deleting}
        title="Delete expense?"
        message={
          deleting ? (
            <span>
              This removes <span className="font-semibold text-ink-900">{formatPKR(parseFloat(deleting.amount))}</span>{" "}
              for {EXPENSE_CATEGORY_LABELS[deleting.category] ?? deleting.category}. You can undo this.
            </span>
          ) : null
        }
        confirmLabel="Delete"
        destructive
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleting(null)}
      />

      <Sheet
        open={filtersOpen}
        title="Filters"
        onClose={() => setFiltersOpen(false)}
        width="max-w-md"
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-ink-500">{EXPENSE_TEXT.category}</label>
            <Dropdown
              value={categoryFilter}
              onChange={(v) => setCategoryFilter(v as "ALL" | Expense["category"])}
              options={EXPENSE_FILTERS.map((f) => ({ value: f.value, label: f.label }))}
              placeholder="All categories"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-ink-500">{EXPENSE_TEXT.period}</label>
            <Dropdown
              value={dateFilter}
              onChange={(v) => setDateFilter(v as ExpenseDateFilter)}
              options={EXPENSE_DATE_FILTERS.map((f) => ({ value: f.value, label: f.label }))}
              placeholder="All time"
            />
          </div>
          <div className="flex items-center justify-between pt-2">
            <p className="text-sm text-ink-500">{filtered.length} expense(s)</p>
            <div className="flex items-center gap-2">
              <Button variant="grey" onClick={resetFilters}>
                Reset
              </Button>
              <Button onClick={() => setFiltersOpen(false)}>Show results</Button>
            </div>
          </div>
        </div>
      </Sheet>

      {viewing && (
        <InvoiceViewer type="EXPENSE" id={viewing.id} onClose={() => setViewing(null)} />
      )}
    </div>
  );
}