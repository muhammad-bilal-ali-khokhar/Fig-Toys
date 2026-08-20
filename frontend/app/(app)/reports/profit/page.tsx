"use client";

import { PeriodPicker } from "@/components/reports/period-picker";
import { usePeriodReport } from "@/components/reports/use-period-report";
import { KpiCard } from "@/components/reports/report-card";
import { TopList } from "@/components/reports/top-list";
import { DailyBars } from "@/components/reports/daily-bars";
import { ReportTable } from "@/components/reports/report-table";
import type { ProfitReport } from "@/lib/api-types";
import { formatPKR } from "@/lib/money";
import { REPORT_CONDITION_LABELS } from "@/lib/constants";
import { ReportPrint } from "@/components/reports/report-print";
import { ReportDoc } from "@/app/(app)/print/dlayout";
import { Button } from "@/components/ui/button";

export default function ProfitReportPage() {
  const { data, loading, range, setRange } = usePeriodReport<ProfitReport | null>("/report/profit");

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-ink-900">Profit report</h2>
          <p className="text-xs text-ink-500">Revenue against cost of goods and expenses, broken down by day, brand, model and condition.</p>
        </div>
        <ReportPrint
          trigger={(open, busy) => (
            <Button variant="grey" onClick={open} loading={busy} disabled={!data}>
              Print
            </Button>
          )}
        >
          {(profile) => (data ? <ReportDoc format="a4" kind="PROFIT_REPORT" profile={profile} data={data} range={range} /> : null)}
        </ReportPrint>
      </div>

      <PeriodPicker value={range} onChange={setRange} />

      {loading ? (
        <p className="text-sm text-ink-400">Loading…</p>
      ) : data ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard label="Revenue" value={formatPKR(data.revenue)} sub="Total sold value" />
            <KpiCard label="Cost of goods" value={formatPKR(data.cost)} sub="Purchase cost of sold items" />
            <KpiCard label="Expenses" value={formatPKR(data.expenses)} sub="Operating expenses" />
            <KpiCard label="Profit" value={formatPKR(data.profit)} sub="Revenue minus cost and expenses" />
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <KpiCard label="Margin" value={`${(data.margin * 100).toFixed(1)}%`} sub="Profit as % of revenue" />
          </div>

          <DailyBars title="Daily profit" points={data.daily.map((d) => ({ date: d.date, value: d.profit }))} />

          <div className="grid gap-3 lg:grid-cols-3">
            <TopList
              title="By brand"
              rows={data.byBrand.map((b) => ({ id: b.name, label: b.name, sub: `margin ${((b.profit / (b.revenue || 1)) * 100).toFixed(0)}%`, value: b.profit }))}
              format={formatPKR}
            />
            <TopList
              title="By condition"
              rows={data.byCondition.map((c) => ({
                id: c.condition,
                label: REPORT_CONDITION_LABELS[c.condition] ?? c.condition,
                value: c.profit,
              }))}
              format={formatPKR}
            />
            <ReportTable
              columns={[
                { key: "model", label: "Model", render: (r) => <span className="font-medium text-ink-900">{r.name}</span> },
                { key: "revenue", label: "Revenue", align: "right", render: (r) => formatPKR(r.revenue) },
                { key: "cost", label: "Cost", align: "right", render: (r) => formatPKR(r.cost) },
                { key: "profit", label: "Profit", align: "right", render: (r) => <span className="font-semibold text-ink-900">{formatPKR(r.profit)}</span> },
              ]}
              rows={data.byModel}
              rowKey={(r) => r.name}
            />
          </div>
        </>
      ) : (
        <p className="rounded-2xl bg-white p-4 text-sm text-ink-500">
          Profit and cost reports are only available to Admins and Managers.
        </p>
      )}
    </div>
  );
}
