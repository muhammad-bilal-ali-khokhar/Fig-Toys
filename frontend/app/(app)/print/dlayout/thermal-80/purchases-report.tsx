"use client";

import type { PrintConfig } from "@/lib/constants";

import type { CompanyProfile, PurchaseReport, ReportRange } from "@/lib/api-types";
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

export function PurchasesReportT80({
  profile,
  config,
  data,
  range,
}: {
  profile: CompanyProfile | null;
  config?: PrintConfig;
  data: PurchaseReport;
  range: ReportRange;
}) {
  return (
    <ReportDocShell profile={profile} config={config} title="Purchase report" period={formatReportPeriod(range)} format="80">
      <KpiStrip
        format="80"
        items={[
          { label: "Amount", value: formatPKR(data.amount), strong: true },
          { label: "Purchases", value: String(data.count) },
          { label: "Units bought", value: String(data.units) },
          { label: "Discounts", value: formatPKR(data.discount) },
        ]}
      />

      {data.byCondition.length > 0 && (
        <DataTable
          format="80"
          title="By condition"
          cols={[{ label: "Condition" }, { label: "Units", right: true }, { label: "Amount", right: true }]}
          rows={data.byCondition.map((c) => [REPORT_CONDITION_LABELS[c.condition] ?? c.condition, String(c.units), num(c.amount)])}
        />
      )}

      {data.byVendor.length > 0 && (
        <DataTable
          format="80"
          title="By vendor"
          cols={[{ label: "Vendor" }, { label: "Purchases", right: true }, { label: "Units", right: true }, { label: "Amount", right: true }]}
          rows={data.byVendor.map((v) => [nameCell(v.name), String(v.count), String(v.units), num(v.amount)])}
        />
      )}
    </ReportDocShell>
  );
}
