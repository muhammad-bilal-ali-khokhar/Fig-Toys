"use client";

import type { CompanyProfile, ReportRange, SoldReturnedReport } from "@/lib/api-types";
import { DataTable, ReportDocShell, num } from "../shared";

export function SoldReturnedReportA4({
  profile,
  data,
  range,
}: {
  profile: CompanyProfile | null;
  data: SoldReturnedReport;
  range?: ReportRange;
}) {
  const showProfit = data.totals.profit !== null;
  return (
    <ReportDocShell
      profile={profile}
      title="Sold vs returned"
      period={range?.from && range?.to ? `${range.from} to ${range.to}` : "Selected period"}
      format="a4"
    >
      <DataTable
        format="a4"
        title={`${data.totals.products} toy(s)`}
        cols={[
          { label: "Toy" },
          { label: "Barcode" },
          { label: "Sold", right: true },
          { label: "Returned", right: true },
          { label: "Net", right: true },
          { label: "Sold value", right: true },
          { label: "Refunds", right: true },
          ...(showProfit ? [{ label: "Profit", right: true }] : []),
        ]}
        rows={data.rows.map((row) => [
          row.label,
          row.barcode ?? "—",
          String(row.soldQty),
          String(row.returnedQty),
          String(row.netQty),
          num(row.revenue),
          num(row.refunds),
          ...(showProfit ? [num(row.profit ?? 0)] : []),
        ])}
        totals={[
          "Total",
          "",
          String(data.totals.soldQty),
          String(data.totals.returnedQty),
          String(data.totals.netQty),
          num(data.totals.revenue),
          num(data.totals.refunds),
          ...(showProfit ? [num(data.totals.profit ?? 0)] : []),
        ]}
      />
    </ReportDocShell>
  );
}
