"use client";

import type { CompanyProfile, ProfitReport, ReportRange } from "@/lib/api-types";
import { formatPKR } from "@/lib/money";
import {
  DataTable,
  KpiStrip,
  ReportDocShell,
  formatReportPeriod,
  nameCell,
  num,
} from "../shared";

export function ProfitReportA4({
  profile,
  data,
  range,
}: {
  profile: CompanyProfile | null;
  data: ProfitReport;
  range: ReportRange;
}) {
  return (
    <ReportDocShell profile={profile} title="Profit report" period={formatReportPeriod(range)} format="a4">
      <KpiStrip
        format="a4"
        items={[
          { label: "Revenue", value: formatPKR(data.revenue) },
          { label: "Cost of goods", value: formatPKR(data.cost) },
          { label: "Expenses", value: formatPKR(data.expenses) },
          { label: "Profit", value: formatPKR(data.profit), strong: true },
        ]}
      />

      {data.byBrand.length > 0 && (
        <DataTable
          format="a4"
          title="By brand"
          cols={[{ label: "Brand" }, { label: "Revenue", right: true }, { label: "Cost", right: true }, { label: "Profit", right: true }]}
          rows={data.byBrand.map((b) => [nameCell(b.name), num(b.revenue), num(b.cost), num(b.profit)])}
        />
      )}

      {data.byCategory.length > 0 && (
        <DataTable
          format="a4"
          title="By category"
          cols={[{ label: "Category" }, { label: "Revenue", right: true }, { label: "Cost", right: true }, { label: "Profit", right: true }]}
          rows={data.byCategory.map((c) => [nameCell(c.name), num(c.revenue), num(c.cost), num(c.profit)])}
        />
      )}

      {data.byModel.length > 0 && (
        <DataTable
          format="a4"
          title="By model"
          cols={[{ label: "Model" }, { label: "Revenue", right: true }, { label: "Cost", right: true }, { label: "Profit", right: true }]}
          rows={data.byModel.map((m) => [nameCell(m.name), num(m.revenue), num(m.cost), num(m.profit)])}
        />
      )}
    </ReportDocShell>
  );
}
