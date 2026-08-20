"use client";

import { useApi } from "@/lib/use-api";
import type { BalancesReport } from "@/lib/api-types";
import { KpiCard } from "@/components/reports/report-card";
import { BalanceList } from "@/components/reports/balance-list";
import { formatPKR } from "@/lib/money";
import { ReportPrint } from "@/components/reports/report-print";
import { ReportDoc } from "@/app/(app)/print/dlayout";
import { Button } from "@/components/ui/button";

export default function ReceivablesPage() {
  const { data, loading } = useApi<BalancesReport>("/report/balances");

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-ink-900">Receivables</h2>
          <p className="text-xs text-ink-500">Customers who still owe money on credit sales.</p>
        </div>
        <ReportPrint
          trigger={(open, busy) => (
            <Button variant="grey" onClick={open} loading={busy}>
              Print
            </Button>
          )}
        >
          {(profile) =>
            data ? <ReportDoc format="a4" kind="RECEIVABLES" profile={profile} data={data} /> : null
          }
        </ReportPrint>
      </div>

      {loading ? (
        <p className="text-sm text-ink-400">Loading…</p>
      ) : data ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <KpiCard label="Total receivables" value={formatPKR(data.receivableTotal)} sub="Money owed to you" />
            <KpiCard label="Customers" value={String(data.receivables.length)} sub="Contacts with open balances" />
            <KpiCard
              label="Largest"
              value={data.receivables[0] ? formatPKR(data.receivables[0].outstanding) : "—"}
              sub={data.receivables[0]?.name ?? "No balances"}
            />
          </div>

          <BalanceList rows={data.receivables} kind="receivable" />
        </>
      ) : null}
    </div>
  );
}
