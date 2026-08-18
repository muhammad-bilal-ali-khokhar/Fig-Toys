"use client";

import { PeriodPicker } from "@/components/reports/period-picker";
import { usePeriodReport } from "@/components/reports/use-period-report";
import { KpiCard } from "@/components/reports/report-card";
import { TopList } from "@/components/reports/top-list";
import { DailyBars } from "@/components/reports/daily-bars";
import { ReportTable } from "@/components/reports/report-table";
import type { SalesReport } from "@/lib/api-types";
import { formatPKR } from "@/lib/money";
import { pluralize } from "@/lib/pluralize";
import { PAYMENT_METHOD_LABELS, REPORT_CONDITION_LABELS } from "@/lib/constants";

export default function SalesReportPage() {
  const { data, loading, range, setRange } = usePeriodReport<SalesReport>("/report/sales");

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-ink-900">Sales report</h2>
        <p className="text-xs text-ink-500">Revenue, items and breakdowns by condition, brand, payment and staff.</p>
      </div>

      <PeriodPicker value={range} onChange={setRange} />

      {loading ? (
        <p className="text-sm text-ink-400">Loading…</p>
      ) : data ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard label="Revenue" value={formatPKR(data.revenue)} sub={pluralize(data.count, "sale")} />
            <KpiCard label="Items sold" value={String(data.items)} sub="Across all sales" />
            <KpiCard label="Discounts" value={formatPKR(data.discount)} sub={`Subtotal ${formatPKR(data.subtotal)}`} />
            <KpiCard label="Avg. sale" value={formatPKR(data.count > 0 ? data.revenue / data.count : 0)} sub="Revenue per sale" />
          </div>

          <DailyBars title="Daily revenue" points={data.daily.map((d) => ({ date: d.date, value: d.revenue }))} />

          <div className="grid gap-3 lg:grid-cols-3">
            <TopList
              title="By condition"
              rows={data.byCondition.map((c) => ({
                id: c.condition,
                label: REPORT_CONDITION_LABELS[c.condition] ?? c.condition,
                sub: `${pluralize(c.items, "item")}`,
                value: c.revenue,
              }))}
              format={formatPKR}
            />
            <TopList
              title="By brand"
              rows={data.byBrand.map((b) => ({
                id: b.name,
                label: b.name,
                sub: `${pluralize(b.count, "line")}`,
                value: b.revenue,
              }))}
              format={formatPKR}
            />
            <TopList
              title="By category"
              rows={data.byCategory.map((c) => ({
                id: c.name,
                label: c.name,
                sub: `${pluralize(c.count, "line")}`,
                value: c.revenue,
              }))}
              format={formatPKR}
            />
          </div>

          {data.bySubCategory.length > 0 && (
            <TopList
              title="By subcategory (accessories)"
              rows={data.bySubCategory.map((sc) => ({
                id: `${sc.parentName}-${sc.name}`,
                label: `${sc.parentName} > ${sc.name}`,
                sub: `${pluralize(sc.count, "line")}`,
                value: sc.revenue,
              }))}
              format={formatPKR}
            />
          )}

          <div className="grid gap-3 lg:grid-cols-2">
            <ReportTable
              columns={[
                { key: "method", label: "Payment method", render: (r) => <span className="font-medium text-ink-900">{PAYMENT_METHOD_LABELS[r.method] ?? r.method}</span> },
                { key: "count", label: "Payments", align: "right", render: (r) => r.count },
                { key: "amount", label: "Amount", align: "right", render: (r) => <span className="font-semibold text-ink-900">{formatPKR(r.amount)}</span> },
              ]}
              rows={data.byPayment}
              rowKey={(r) => r.method}
            />
            <ReportTable
              columns={[
                { key: "user", label: "Staff", render: (r) => <span className="font-medium text-ink-900">{r.name}</span> },
                { key: "count", label: "Sales", align: "right", render: (r) => r.count },
                { key: "revenue", label: "Revenue", align: "right", render: (r) => <span className="font-semibold text-ink-900">{formatPKR(r.revenue)}</span> },
              ]}
              rows={data.byUser}
              rowKey={(r) => r.name}
            />
          </div>
        </>
      ) : null}
    </div>
  );
}
