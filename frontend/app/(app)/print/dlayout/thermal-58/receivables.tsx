"use client";

import type { BalancesReport, CompanyProfile } from "@/lib/api-types";
import { formatPKR } from "@/lib/money";
import {
  DataTable,
  KpiStrip,
  ReportDocShell,
  num,
} from "../shared";

export function ReceivablesT58({
  profile,
  data,
}: {
  profile: CompanyProfile | null;
  data: BalancesReport;
}) {
  const total = data.receivableTotal;
  return (
    <ReportDocShell profile={profile} title="Receivables" period="Current balances" format="58">
      <KpiStrip
        format="58"
        items={[
          { label: "Total receivables", value: formatPKR(total), strong: true },
          { label: "Contacts", value: String(data.receivables.length) },
        ]}
      />

      <DataTable
        format="58"
        title="Receivables"
        cols={[
          { label: "Contact" },
          { label: "Open", right: true },
          { label: "Total", right: true },
          { label: "Paid", right: true },
          { label: "Owed to you", right: true },
        ]}
        rows={data.receivables.map((r) => [
          r.source === "REFUND" ? `${r.name} (refund due)` : r.name,
          String(r.count),
          formatPKR(r.total),
          formatPKR(r.paid),
          num(r.outstanding),
        ])}
        totals={[
          "Total",
          String(data.receivables.reduce((s, r) => s + r.count, 0)),
          formatPKR(data.receivables.reduce((s, r) => s + r.total, 0)),
          formatPKR(data.receivables.reduce((s, r) => s + r.paid, 0)),
          num(total),
        ]}
      />
    </ReportDocShell>
  );
}
