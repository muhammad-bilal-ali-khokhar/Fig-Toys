"use client";

import type { BalancesReport, CompanyProfile } from "@/lib/api-types";
import { formatPKR } from "@/lib/money";
import {
  DataTable,
  KpiStrip,
  ReportDocShell,
  num,
} from "../shared";

export function PayablesA4({
  profile,
  data,
}: {
  profile: CompanyProfile | null;
  data: BalancesReport;
}) {
  const total = data.payableTotal;
  return (
    <ReportDocShell profile={profile} title="Payables" period="Current balances" format="a4">
      <KpiStrip
        format="a4"
        items={[
          { label: "Total payables", value: formatPKR(total), strong: true },
          { label: "Contacts", value: String(data.payables.length) },
        ]}
      />

      <DataTable
        format="a4"
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
