"use client";

import type { PrintConfig } from "@/lib/constants";

import type { CompanyProfile, ProfitReport, ReportRange } from "@/lib/api-types";
import { REPORT_CONDITION_LABELS } from "@/lib/constants";
import { formatPKR } from "@/lib/money";
import {
  DataTable,
  KpiStrip,
  ReportDocShell,
  formatReportPeriod,
  nameCell,
  num,
} from "../shared";

export function ProfitReportT58({
  profile,
  config,
  data,
  range,
}: {
  profile: CompanyProfile | null;
  config?: PrintConfig;
  data: ProfitReport;
  range: ReportRange;
}) {
  return (
    <ReportDocShell profile={profile} config={config} title="Profit report" period={formatReportPeriod(range)} format="58">
      <KpiStrip
        format="58"
        items={[
          { label: "Revenue", value: formatPKR(data.revenue) },
          { label: "Cost of goods", value: formatPKR(data.cost) },
          { label: "Expenses", value: formatPKR(data.expenses) },
          { label: "Profit", value: formatPKR(data.profit), strong: true },
        ]}
      />

      {data.byBrand.length > 0 && (
        <DataTable
          format="58"
          title="By brand"
          cols={[{ label: "Brand" }, { label: "Revenue", right: true }, { label: "Cost", right: true }, { label: "Profit", right: true }]}
          rows={data.byBrand.map((b) => [nameCell(b.name), num(b.revenue), num(b.cost), num(b.profit)])}
        />
      )}

      {data.byCondition.length > 0 && (
        <DataTable
          format="58"
          title="By condition"
          cols={[{ label: "Condition" }, { label: "Revenue", right: true }, { label: "Cost", right: true }, { label: "Profit", right: true }]}
          rows={data.byCondition.map((c) => [REPORT_CONDITION_LABELS[c.condition] ?? c.condition, num(c.revenue), num(c.cost), num(c.profit)])}
        />
      )}

      {data.byModel.length > 0 && (
        <DataTable
          format="58"
          title="By model"
          cols={[{ label: "Model" }, { label: "Revenue", right: true }, { label: "Cost", right: true }, { label: "Profit", right: true }]}
          rows={data.byModel.map((m) => [nameCell(m.name), num(m.revenue), num(m.cost), num(m.profit)])}
        />
      )}
    </ReportDocShell>
  );
}
