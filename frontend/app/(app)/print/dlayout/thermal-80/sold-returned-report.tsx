"use client";

import type { PrintConfig } from "@/lib/constants";
import type { CompanyProfile, SoldReturnedReport } from "@/lib/api-types";
import { DataTable, ReportDocShell, num } from "../shared";

export function SoldReturnedReportT80({
  profile,
  data,
  config,
}: {
  profile: CompanyProfile | null;
  data: SoldReturnedReport;
  config?: PrintConfig;
}) {
  const showProfit = data.totals.profit !== null;
  return (
    <ReportDocShell profile={profile} config={config} title="Sold vs returned" period="Selected period" format="80">
      <DataTable
        format="80"
        title={`${data.totals.products} toy(s)`}
        cols={[
          { label: "Toy" },
          { label: "Sold", right: true },
          { label: "Ret", right: true },
          { label: "Net", right: true },
          { label: "Value", right: true },
          ...(showProfit ? [{ label: "Profit", right: true }] : []),
        ]}
        rows={data.rows.map((row) => [
          row.label,
          String(row.soldQty),
          String(row.returnedQty),
          String(row.netQty),
          num(row.revenue - row.refunds),
          ...(showProfit ? [num(row.profit ?? 0)] : []),
        ])}
        totals={[
          "Total",
          String(data.totals.soldQty),
          String(data.totals.returnedQty),
          String(data.totals.netQty),
          num(data.totals.revenue - data.totals.refunds),
          ...(showProfit ? [num(data.totals.profit ?? 0)] : []),
        ]}
      />
    </ReportDocShell>
  );
}
