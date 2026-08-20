"use client";

import type { CompanyProfile, ExpenseReport, ReportRange } from "@/lib/api-types";
import { EXPENSE_CATEGORY_LABELS } from "@/lib/constants";
import { formatPKR } from "@/lib/money";
import {
  DataTable,
  KpiStrip,
  ReportDocShell,
  formatReportPeriod,
  num,
} from "../shared";

export function ExpensesReportT80({
  profile,
  data,
  range,
}: {
  profile: CompanyProfile | null;
  data: ExpenseReport;
  range: ReportRange;
}) {
  return (
    <ReportDocShell profile={profile} title="Expenses report" period={formatReportPeriod(range)} format="80">
      <KpiStrip
        format="80"
        items={[
          { label: "Total expenses", value: formatPKR(data.total), strong: true },
          { label: "Expenses", value: String(data.count) },
        ]}
      />

      {data.byCategory.length > 0 && (
        <DataTable
          format="80"
          title="By category"
          cols={[{ label: "Category" }, { label: "Count", right: true }, { label: "Total", right: true }]}
          rows={data.byCategory.map((c) => [EXPENSE_CATEGORY_LABELS[c.category] ?? c.category, String(c.count), num(c.total)])}
          totals={["Total", String(data.count), num(data.total)]}
        />
      )}
    </ReportDocShell>
  );
}
