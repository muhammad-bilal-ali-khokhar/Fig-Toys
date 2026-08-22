"use client";

import type { PrintConfig } from "@/lib/constants";

import type { CompanyProfile, ReportRange, SalesReport } from "@/lib/api-types";
import { PAYMENT_METHOD_LABELS, REPORT_CONDITION_LABELS } from "@/lib/constants";
import { formatPKR } from "@/lib/money";
import {
  DataTable,
  KpiStrip,
  ReportDocShell,
  formatReportPeriod,
  nameCell,
  num,
} from "../shared";

export function SalesReportT58({
  profile,
  config,
  data,
  range,
}: {
  profile: CompanyProfile | null;
  config?: PrintConfig;
  data: SalesReport;
  range: ReportRange;
}) {
  return (
    <ReportDocShell profile={profile} config={config} title="Sales report" period={formatReportPeriod(range)} format="58">
      <KpiStrip
        format="58"
        items={[
          { label: "Revenue", value: formatPKR(data.revenue), strong: true },
          { label: "Sales", value: String(data.count) },
          { label: "Items sold", value: String(data.items) },
          { label: "Discounts", value: formatPKR(data.discount) },
        ]}
      />

      {data.byCondition.length > 0 && (
        <DataTable
          format="58"
          title="By condition"
          cols={[{ label: "Condition" }, { label: "Items", right: true }, { label: "Revenue", right: true }]}
          rows={data.byCondition.map((c) => [REPORT_CONDITION_LABELS[c.condition] ?? c.condition, String(c.items), num(c.revenue)])}
        />
      )}

      {data.byBrand.length > 0 && (
        <DataTable
          format="58"
          title="By brand"
          cols={[{ label: "Brand" }, { label: "Sales", right: true }, { label: "Revenue", right: true }]}
          rows={data.byBrand.map((b) => [nameCell(b.name), String(b.count), num(b.revenue)])}
        />
      )}

      {data.byPayment.length > 0 && (
        <DataTable
          format="58"
          title="By payment method"
          cols={[{ label: "Method" }, { label: "Payments", right: true }, { label: "Amount", right: true }]}
          rows={data.byPayment.map((p) => [PAYMENT_METHOD_LABELS[p.method] ?? p.method, String(p.count), num(p.amount)])}
        />
      )}

      {data.byUser.length > 0 && (
        <DataTable
          format="58"
          title="By staff"
          cols={[{ label: "Staff" }, { label: "Sales", right: true }, { label: "Revenue", right: true }]}
          rows={data.byUser.map((u) => [nameCell(u.name), String(u.count), num(u.revenue)])}
        />
      )}
    </ReportDocShell>
  );
}
