"use client";

import { PeriodPicker } from "@/components/reports/period-picker";
import { usePeriodReport } from "@/components/reports/use-period-report";
import { KpiCard } from "@/components/reports/report-card";
import { ReportTable } from "@/components/reports/report-table";
import type { ContactReport, ContactReportRow } from "@/lib/api-types";
import { formatPKR } from "@/lib/money";
import { pluralize } from "@/lib/pluralize";
import Link from "next/link";

export default function ContactReportPage() {
  const { data, loading, range, setRange } = usePeriodReport<ContactReport>("/report/contacts");

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-ink-900">Contact report</h2>
        <p className="text-xs text-ink-500">Business volume with each customer and vendor.</p>
      </div>

      <PeriodPicker value={range} onChange={setRange} />

      {loading ? (
        <p className="text-sm text-ink-400">Loading…</p>
      ) : data ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard label="Contacts" value={String(data.contactCount)} sub="With transactions" />
            <KpiCard label="Total sales" value={formatPKR(data.totalSales)} sub="Revenue from customers" />
            <KpiCard label="Total purchases" value={formatPKR(data.totalPurchases)} sub="Spent with vendors" />
            <KpiCard
              label="Net"
              value={formatPKR(data.totalSales - data.totalPurchases)}
              sub="Sales minus purchases"
            />
          </div>

          <ReportTable
            columns={[
              {
                key: "name",
                label: "Contact",
                render: (r: ContactReportRow) => (
                  <Link
                    href={`/reports/ledger?contactId=${r.contactId}`}
                    className="font-medium text-brand-600 hover:underline"
                  >
                    {r.name}
                  </Link>
                ),
              },
              {
                key: "phone",
                label: "Phone",
                render: (r: ContactReportRow) => (
                  <span className="text-ink-500">{r.phone || "—"}</span>
                ),
              },
              {
                key: "sales",
                label: "Sales",
                align: "right",
                render: (r: ContactReportRow) => (
                  <div>
                    <span className="font-semibold text-ink-900">{formatPKR(r.saleRevenue)}</span>
                    <span className="ml-1 text-xs text-ink-400">{pluralize(r.saleCount, "txn")}</span>
                  </div>
                ),
              },
              {
                key: "purchases",
                label: "Purchases",
                align: "right",
                render: (r: ContactReportRow) => (
                  <div>
                    <span className="font-semibold text-ink-900">{formatPKR(r.purchaseAmount)}</span>
                    <span className="ml-1 text-xs text-ink-400">{pluralize(r.purchaseCount, "txn")}</span>
                  </div>
                ),
              },
              {
                key: "total",
                label: "Total txns",
                align: "right",
                render: (r: ContactReportRow) => (
                  <span className="font-medium text-ink-700">{r.totalTransactions}</span>
                ),
              },
              {
                key: "outstanding",
                label: "Balance",
                align: "right",
                render: (r: ContactReportRow) => (
                  <span
                    className={`font-semibold ${
                      r.outstanding > 0 ? "text-amber-600" : r.outstanding < 0 ? "text-blue-600" : "text-ink-400"
                    }`}
                  >
                    {r.outstanding > 0 ? "+" : ""}
                    {formatPKR(r.outstanding)}
                  </span>
                ),
              },
            ]}
            rows={data.rows}
            rowKey={(r) => r.contactId}
            empty="No contacts with transactions in this period."
          />
        </>
      ) : null}
    </div>
  );
}
