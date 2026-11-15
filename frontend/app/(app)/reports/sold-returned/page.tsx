"use client";

import { PeriodPicker } from "@/components/reports/period-picker";
import { usePeriodReport } from "@/components/reports/use-period-report";
import { KpiCard } from "@/components/reports/report-card";
import { ReportTable } from "@/components/reports/report-table";
import { ReportPrint } from "@/components/reports/report-print";
import { ReportDoc } from "@/app/(app)/print/dlayout";
import { Button } from "@/components/ui/button";
import type { SoldReturnedReport } from "@/lib/api-types";
import { formatPKR } from "@/lib/money";
import { pluralize } from "@/lib/pluralize";

export default function SoldReturnedReportPage() {
  const { data, loading, range, setRange } = usePeriodReport<SoldReturnedReport>("/report/sold-returned");

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-ink-900">Sold vs returned</h2>
          <p className="text-xs text-ink-500">Pieces sold and pieces taken back, toy by toy, netted out.</p>
        </div>
        <ReportPrint
          trigger={(open, busy) => (
            <Button variant="grey" onClick={open} loading={busy} disabled={!data}>
              Print
            </Button>
          )}
        >
          {(profile) => (data ? <ReportDoc format="a4" kind="SOLD_RETURNED_REPORT" profile={profile} data={data} range={range} /> : null)}
        </ReportPrint>
      </div>

      <PeriodPicker value={range} onChange={setRange} />

      {loading ? (
        <p className="text-sm text-ink-400">Loading…</p>
      ) : data ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              label="Pieces sold"
              value={String(data.totals.soldQty)}
              sub={pluralize(data.totals.products, "toy")}
            />
            <KpiCard
              label="Pieces returned"
              value={String(data.totals.returnedQty)}
              sub={formatPKR(data.totals.refunds)}
            />
            <KpiCard
              label="Net pieces sold"
              value={String(data.totals.netQty)}
              sub={formatPKR(data.totals.revenue - data.totals.refunds)}
            />
            {data.totals.profit !== null && (
              <KpiCard label="Net profit" value={formatPKR(data.totals.profit)} sub="Sales less refunds less cost" />
            )}
          </div>

          <ReportTable
            rows={data.rows}
            rowKey={(row) => row.productId}
            empty="No toys were sold in this period."
            columns={[
              {
                key: "toy",
                label: "Toy",
                render: (row) => (
                  <div>
                    <p className="font-medium text-ink-900">{row.label}</p>
                    <p className="text-xs text-ink-400">{row.category}</p>
                  </div>
                ),
              },
              {
                key: "barcode",
                label: "Barcode",
                render: (row) => <span className="font-mono text-xs text-ink-500">{row.barcode ?? "—"}</span>,
              },
              { key: "sold", label: "Sold", align: "right", render: (row) => row.soldQty },
              {
                key: "returned",
                label: "Returned",
                align: "right",
                render: (row) => (row.returnedQty > 0 ? <span className="font-semibold text-error">{row.returnedQty}</span> : row.returnedQty),
              },
              { key: "net", label: "Net", align: "right", render: (row) => <span className="font-semibold">{row.netQty}</span> },
              { key: "revenue", label: "Sold value", align: "right", render: (row) => formatPKR(row.revenue) },
              { key: "refunds", label: "Refunds", align: "right", render: (row) => formatPKR(row.refunds) },
              ...(data.costsHidden
                ? []
                : [
                    {
                      key: "cost",
                      label: "Cost",
                      align: "right" as const,
                      render: (row: SoldReturnedReport["rows"][number]) => (row.cost === null ? "—" : formatPKR(row.cost)),
                    },
                    {
                      key: "profit",
                      label: "Profit",
                      align: "right" as const,
                      render: (row: SoldReturnedReport["rows"][number]) =>
                        row.profit === null ? "—" : <span className={row.profit < 0 ? "text-error" : "text-brand-600"}>{formatPKR(row.profit)}</span>,
                    },
                  ]),
            ]}
          />

          <div className="grid gap-3 rounded-2xl bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Sold value</p>
              <p className="mt-1 text-sm font-semibold text-ink-900">{formatPKR(data.totals.revenue)}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Refunded</p>
              <p className="mt-1 text-sm font-semibold text-ink-900">{formatPKR(data.totals.refunds)}</p>
            </div>
            {data.totals.cost !== null && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Cost of net pieces</p>
                <p className="mt-1 text-sm font-semibold text-ink-900">{formatPKR(data.totals.cost)}</p>
              </div>
            )}
            {data.totals.profit !== null && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Net profit</p>
                <p className="mt-1 text-sm font-semibold text-brand-600">{formatPKR(data.totals.profit)}</p>
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
