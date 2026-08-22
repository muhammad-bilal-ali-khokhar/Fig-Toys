"use client";

import type { PrintConfig } from "@/lib/constants";

import type { CompanyProfile, Transaction } from "@/lib/api-types";
import {
  DataTable,
  ReportDocShell,
  num,
} from "../shared";

export function SaleReturnsT80({
  profile,
  config,
  rows,
}: {
  profile: CompanyProfile | null;
  config?: PrintConfig;
  rows: Transaction[];
}) {
  return (
    <ReportDocShell profile={profile} config={config} title="Sale returns" period="Selected period" format="80">
      <DataTable
        format="80"
        title={`${rows.length} transaction(s)`}
        cols={[
          { label: "Number" },
          { label: "Contact" },
          { label: "Status" },
          { label: "Items", right: true },
          { label: "Total", right: true },
          { label: "Date", right: true },
        ]}
        rows={rows.map((t) => [
          t.number,
          t.contact.name,
          t.status,
          String(t._count.items),
          num(Number(t.total)),
          new Date(t.createdAt).toLocaleDateString(),
        ])}
        totals={[
          "Total",
          "",
          "",
          String(rows.reduce((s, t) => s + t._count.items, 0)),
          num(rows.reduce((s, t) => s + Number(t.total), 0)),
          "",
        ]}
      />
    </ReportDocShell>
  );
}
