"use client";

import { usePeriodReport } from "@/components/reports/use-period-report";
import { KpiCard } from "@/components/reports/report-card";
import { TopList } from "@/components/reports/top-list";
import type { StockReport } from "@/lib/api-types";
import { formatPKR } from "@/lib/money";
import { pluralize } from "@/lib/pluralize";
import { REPORT_CONDITION_LABELS } from "@/lib/constants";

export default function StockReportPage() {
  const { data, loading } = usePeriodReport<StockReport>("/report/stock");

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-ink-900">Stock valuation</h2>
        <p className="text-xs text-ink-500">Current in-stock units and their cost and retail value.</p>
      </div>

      {loading ? (
        <p className="text-sm text-ink-400">Loading…</p>
      ) : data ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard label="Units in stock" value={String(data.units)} sub="Currently IN_STOCK" />
            <KpiCard
              label="Cost value"
              value={data.costValue !== null ? formatPKR(data.costValue) : "—"}
              sub={data.costValue !== null ? "What you paid" : "Available to Admins & Managers"}
            />
            <KpiCard label="Retail value" value={formatPKR(data.retailValue)} sub="Expected sale value" />
            <KpiCard
              label="Potential profit"
              value={data.costValue !== null ? formatPKR(data.retailValue - data.costValue) : "—"}
              sub={data.costValue !== null ? "Retail minus cost" : "Available to Admins & Managers"}
            />
          </div>

          <div className="grid gap-3 lg:grid-cols-3">
            <TopList
              title="By condition"
              rows={data.byCondition.map((c) => ({
                id: c.condition,
                label: REPORT_CONDITION_LABELS[c.condition] ?? c.condition,
                sub: `${pluralize(c.units, "unit")}`,
                value: c.costValue ?? c.retailValue,
              }))}
              format={formatPKR}
            />
            <TopList
              title="By category"
              rows={data.byCategory.map((c) => ({
                id: c.name,
                label: c.name,
                sub: `${pluralize(c.units, "unit")}`,
                value: c.costValue ?? c.retailValue,
              }))}
              format={formatPKR}
            />
            <TopList
              title="By brand"
              rows={data.byBrand.map((b) => ({
                id: b.name,
                label: b.name,
                sub: `${pluralize(b.units, "unit")}`,
                value: b.costValue ?? b.retailValue,
              }))}
              format={formatPKR}
            />
          </div>

          {data.bySubCategory.length > 0 && (
            <TopList
              title="By subcategory (accessories)"
              rows={data.bySubCategory.map((sc) => ({
                id: `${sc.parentName}-${sc.name}`,
                label: `${sc.parentName} > ${sc.name}`,
                sub: `${pluralize(sc.units, "unit")}`,
                value: sc.costValue ?? sc.retailValue,
              }))}
              format={formatPKR}
            />
          )}
        </>
      ) : null}
    </div>
  );
}
