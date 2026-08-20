"use client";

import { PeriodPicker } from "@/components/reports/period-picker";
import { usePeriodReport } from "@/components/reports/use-period-report";
import { KpiCard } from "@/components/reports/report-card";
import { TopList } from "@/components/reports/top-list";
import { DailyBars } from "@/components/reports/daily-bars";
import type { ExpenseReport } from "@/lib/api-types";
import { formatPKR } from "@/lib/money";
import { pluralize } from "@/lib/pluralize";
import { EXPENSE_CATEGORY_LABELS } from "@/lib/constants";
import { ReportPrint } from "@/components/reports/report-print";
import { ReportDoc } from "@/app/(app)/print/dlayout";
import { Button } from "@/components/ui/button";

export default function ExpensesReportPage() {
  const { data, loading, range, setRange } = usePeriodReport<ExpenseReport>("/report/expenses");

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-ink-900">Expenses report</h2>
          <p className="text-xs text-ink-500">Shop spending by category, including rent, salaries, utilities and more.</p>
        </div>
        <ReportPrint
          trigger={(open, busy) => (
            <Button variant="grey" onClick={open} loading={busy}>
              Print
            </Button>
          )}
        >
          {(profile) => (data ? <ReportDoc format="a4" kind="EXPENSES_REPORT" profile={profile} data={data} range={range} /> : null)}
        </ReportPrint>
      </div>

      <PeriodPicker value={range} onChange={setRange} />

      {loading ? (
        <p className="text-sm text-ink-400">Loading…</p>
      ) : data ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <KpiCard label="Total expenses" value={formatPKR(data.total)} sub={pluralize(data.count, "expense")} />
            <KpiCard
              label="Daily average"
              value={formatPKR(data.daily.length > 0 ? data.total / data.daily.length : 0)}
              sub="Across the selected period"
            />
            <KpiCard label="Largest category" value={data.byCategory[0] ? formatPKR(data.byCategory[0].total) : "—"} sub={data.byCategory[0] ? (EXPENSE_CATEGORY_LABELS[data.byCategory[0].category] ?? data.byCategory[0].category) : "No expenses"} />
          </div>

          <DailyBars title="Daily expenses" points={data.daily.map((d) => ({ date: d.date, value: d.total }))} />

          <TopList
            title="By category"
            rows={data.byCategory.map((c) => ({
              id: c.category,
              label: EXPENSE_CATEGORY_LABELS[c.category] ?? c.category,
              sub: `${c.count} time(s)`,
              value: c.total,
            }))}
            format={formatPKR}
          />
        </>
      ) : null}
    </div>
  );
}
