"use client";

import type { CompanyProfile, Transaction } from "@/lib/api-types";
import {
  DataTable,
  ReportDocShell,
  num,
} from "../shared";

export function SalesListT58({
  profile,
  rows,
}: {
  profile: CompanyProfile | null;
  rows: Transaction[];
}) {
  return (
    <ReportDocShell profile={profile} title="Sales list" period="Selected period" format="58">
      <DataTable
        format="58"
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
