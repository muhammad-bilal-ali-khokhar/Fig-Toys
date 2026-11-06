"use client";

import { useState } from "react";
import { useApi } from "@/lib/use-api";
import type { ReportRange, StockMovement } from "@/lib/api-types";
import { toISODate, formatDateTime } from "@/lib/dates";
import { PeriodPicker } from "@/components/reports/period-picker";
import { PaginationBar, usePagination } from "@/components/ui/pagination";
import { TypePill, type TypePillTone } from "@/components/ui/type-pill";

const MOVE_TONE: Record<string, TypePillTone> = {
  IN: "brand",
  OUT: "grey",
  ADJUST: "white",
  TRANSFER: "grey",
  RESERVED: "white",
  RELEASED: "brand",
};

export function StockMovementsList({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  const [range, setRange] = useState<ReportRange>({ from: toISODate(new Date()), to: toISODate(new Date()) });

  const params = new URLSearchParams({ limit: "100" });
  if (range.from) params.set("from", range.from);
  if (range.to) params.set("to", range.to);

  const { data, loading } = useApi<StockMovement[]>(`/unit/movements?${params.toString()}`);

  const list = data ?? [];
  const { page, pageSize, setPage, setPageSize, pageCount, from: fromRow, to: toRow, slice } = usePagination(list.length);
  const pageItems = slice(list);

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="shrink-0">
        <h2 className="text-lg font-bold text-ink-900">{title}</h2>
        <p className="text-xs text-ink-500">{subtitle}</p>
      </div>

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
                  <th className="px-4 py-2.5 font-semibold">Type</th>
                  <th className="px-4 py-2.5 font-semibold">Product</th>
                  <th className="px-4 py-2.5 font-semibold">Barcode</th>
                  <th className="px-4 py-2.5 font-semibold">Qty</th>
                  <th className="px-4 py-2.5 font-semibold">Note</th>
                  <th className="px-4 py-2.5 text-right font-semibold">When</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((m) => (
                  <tr key={m.id} className="border-t border-ink-100 hover:bg-ink-50/50">
                    <td className="px-4 py-3">
                      <TypePill tone={MOVE_TONE[m.type] ?? "grey"}>{m.type}</TypePill>
                    </td>
                    <td className="px-4 py-3 text-ink-900">
                      {m.product ? `${m.product.brand} ${m.product.model} ${m.product.storage ?? ""}`.trim() : "—"}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-ink-700">{m.unit?.imei ?? "—"}</td>
                    <td className="px-4 py-3 text-ink-700">{m.qty}</td>
                    <td className="px-4 py-3 text-ink-500">{m.note ?? ""}</td>
                    <td className="px-4 py-3 text-right text-xs text-ink-400">
                      {formatDateTime(m.createdAt)}
                    </td>
                  </tr>
                ))}
                {list.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-8 text-center text-sm text-ink-400">
                      No stock movements recorded yet.
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
    </div>
  );
}
