"use client";

import type { PrintConfig } from "@/lib/constants";

import type { BalancesReport, CompanyProfile } from "@/lib/api-types";
import { formatPKR } from "@/lib/money";
import {
  DataTable,
  KpiStrip,
  ReportDocShell,
  num,
} from "../shared";

export function PayablesT80({
  profile,
  config,
  data,
}: {
  profile: CompanyProfile | null;
  config?: PrintConfig;
  data: BalancesReport;
}) {
  const total = data.payableTotal;
  return (
    <ReportDocShell profile={profile} config={config} title="Payables" period="Current balances" format="80">
      <KpiStrip
        format="80"
        items={[
          { label: "Total payables", value: formatPKR(total), strong: true },
          { label: "Contacts", value: String(data.payables.length) },
        ]}
      />

      <DataTable
        format="80"
        title="Payables"
        cols={[
          { label: "Contact" },
          { label: "Open", right: true },
          { label: "Total", right: true },
          { label: "Paid", right: true },
          { label: "You owe", right: true },
        ]}
        rows={data.payables.map((r) => [
          r.source === "REFUND" ? `${r.name} (refund due)` : r.name,
          String(r.count),
          formatPKR(r.total),
          formatPKR(r.paid),
          num(r.outstanding),
        ])}
        totals={[
          "Total",
          String(data.payables.reduce((s, r) => s + r.count, 0)),
          formatPKR(data.payables.reduce((s, r) => s + r.total, 0)),
          formatPKR(data.payables.reduce((s, r) => s + r.paid, 0)),
          num(total),
        ]}
      />
    </ReportDocShell>
  );
}
