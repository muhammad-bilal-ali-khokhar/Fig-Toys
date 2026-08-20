"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { useApi } from "@/lib/use-api";
import type { ReportRange, Transaction } from "@/lib/api-types";
import { toISODate } from "@/lib/dates";
import { formatPKR } from "@/lib/money";
import { PeriodPicker } from "@/components/reports/period-picker";
import { PaginationBar, usePagination } from "@/components/ui/pagination";
import { Button } from "@/components/ui/button";
import { TypePill, type TypePillTone } from "@/components/ui/type-pill";
import { InvoiceViewer } from "@/components/transactions/invoice-viewer";
import { ReportPrint } from "@/components/reports/report-print";
import { ReportDoc, type ReportDocKind } from "@/app/(app)/print/dlayout";

export function TransactionList({
  type,
  title,
  subtitle,
  pillTone = "grey",
  pillLabel,
  summary,
  printTitle,
}: {
  type: string;
  title: string;
  subtitle: string;
  pillTone?: TypePillTone;
  pillLabel: (t: Transaction) => string;
  summary?: ReactNode;
  printTitle?: string;
}) {
  const [range, setRange] = useState<ReportRange>({ from: toISODate(new Date()), to: toISODate(new Date()) });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showSummary, setShowSummary] = useState(false);

  const params = new URLSearchParams({ type, limit: "100" });
  if (range.from) params.set("from", range.from);
  if (range.to) params.set("to", range.to);

  const { data, loading } = useApi<Transaction[]>(`/transaction?${params.toString()}`);

  const list = data ?? [];
  const kind: Record<string, ReportDocKind> = {
    SALE: "SALES_LIST",
    SALE_RETURN: "SALE_RETURNS",
    PURCHASE: "PURCHASE_LIST",
    PURCHASE_RETURN: "PURCHASE_RETURNS",
  };
  const { page, pageSize, setPage, setPageSize, pageCount, from: fromRow, to: toRow, slice } = usePagination(list.length);
  const pageItems = slice(list);

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex shrink-0 items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-ink-900">{title}</h2>
          <p className="text-xs text-ink-500">{subtitle}</p>
        </div>
        {summary && (
          <Button variant={showSummary ? "primary" : "grey"} onClick={() => setShowSummary((v) => !v)}>
            {showSummary ? "Hide summary" : "Show summary"}
          </Button>
        )}
        {printTitle && (
          <ReportPrint
            trigger={(open, busy) => (
              <Button variant="grey" onClick={open} loading={busy} disabled={list.length === 0}>
                Print
              </Button>
            )}
          >
            {(profile) =>
              list.length > 0 ? <ReportDoc format="a4" kind={kind[type]} profile={profile} rows={list} /> : null
            }
          </ReportPrint>
        )}
      </div>

      {showSummary && summary && <div className="shrink-0">{summary}</div>}

      <div className="shrink-0">
        <PeriodPicker value={range} onChange={setRange} />
      </div>

      {loading && !data ? (
        <p className="min-h-0 flex-1 text-sm text-ink-400">Loading…</p>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-none rounded-2xl bg-white">
          <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-ink-500">
                  <th className="px-4 py-2.5 font-semibold">Number</th>
                  <th className="px-4 py-2.5 font-semibold">Contact</th>
                  <th className="px-4 py-2.5 font-semibold">Status</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Items</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Total</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Date</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {pageItems.map((t) => (
                  <tr key={t.id} className="border-t border-ink-100 hover:bg-ink-50/50">
                    <td className="px-4 py-3 font-medium text-ink-900">{t.number}</td>
                    <td className="px-4 py-3 text-ink-700">{t.contact.name}</td>
                    <td className="px-4 py-3">
                      <TypePill tone={pillTone}>{pillLabel(t)}</TypePill>
                    </td>
                    <td className="px-4 py-3 text-right text-ink-500">{t._count.items}</td>
                    <td className="px-4 py-3 text-right font-medium text-ink-900">{formatPKR(t.total)}</td>
                    <td className="px-4 py-3 text-right text-xs text-ink-400">
                      {new Date(t.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedId(t.id)}
                        className="rounded-lg px-2 py-1 text-xs font-semibold text-brand-600 transition hover:bg-brand-50"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
                {list.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-5 py-8 text-center text-sm text-ink-400">
                      Nothing here yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
        </div>
      )}

      {!loading && (
        <PaginationBar
          from={fromRow}
          to={toRow}
          total={list.length}
          page={page}
          pageCount={pageCount}
          pageSize={pageSize}
          onPrev={() => setPage(page - 1)}
          onNext={() => setPage(page + 1)}
          onPageSize={setPageSize}
        />
      )}

      {selectedId && (
        <InvoiceViewer type={type as "SALE" | "PURCHASE" | "SALE_RETURN" | "PURCHASE_RETURN"} id={selectedId} onClose={() => setSelectedId(null)} />
      )}
    </div>
  );
}
