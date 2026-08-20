"use client";

import type { ReactNode } from "react";
import {
  APP,
  EXPENSE_CATEGORY_LABELS,
  PAYMENT_METHOD_LABELS,
  REPORT_CONDITION_LABELS,
} from "@/lib/constants";
import type {
  BalancesReport,
  CompanyProfile,
  ExpenseReport,
  ProfitReport,
  PurchaseReport,
  ReportRange,
  SalesReport,
  Transaction,
} from "@/lib/api-types";
import { formatPKR } from "@/lib/money";

export type DocFormat = "58" | "80" | "a4";

const isA4 = (f: DocFormat) => f === "a4";

export function formatReportPeriod(range: ReportRange): string {
  const fmt = (d?: string) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString() : null);
  const from = fmt(range.from);
  const to = fmt(range.to);
  if (from && to) return `${from} – ${to}`;
  if (from) return from;
  if (to) return to;
  return "All time";
}

function ReportPrintPage({
  profile,
  title,
  period,
  format,
  children,
}: {
  profile: CompanyProfile | null;
  title: string;
  period: string;
  format: DocFormat;
  children: ReactNode;
}) {
  const a4 = isA4(format);
  return (
    <div
      className={`${a4 ? "a4-page" : "print-doc"} ${a4 ? "px-10 py-8" : "px-3 py-4"} ${a4 ? "text-xs" : "font-mono text-[11px]"} bg-white text-ink-900`}
    >
      <header className={a4 ? "border-b border-ink-300 pb-3" : "border-b-2 border-ink-900 pb-2"}>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className={`${a4 ? "text-2xl" : "text-sm"} font-bold uppercase tracking-wide text-ink-900`}>
              {profile?.name ?? APP.nameFull}
            </p>
            {a4 && profile?.tagline && <p className="mt-0.5 text-ink-600">{profile.tagline}</p>}
            {a4 && profile?.address && <p className="text-ink-600">{profile.address}</p>}
            {a4 && profile?.phone && <p className="text-ink-600">Phone: {profile.phone}</p>}
          </div>
          <div className="shrink-0 text-right">
            <p className={`${a4 ? "text-2xl" : "text-sm"} font-bold uppercase tracking-wide text-ink-900`}>
              {title}
            </p>
            <p className={a4 ? "text-ink-600" : "text-ink-800"}>{period}</p>
            {a4 && <p className="text-ink-500">Generated {new Date().toLocaleString()}</p>}
          </div>
        </div>
      </header>

      <div className="py-3">{children}</div>

      {a4 && (
        <footer className="mt-4 border-t border-ink-300 pt-2 text-center text-[10px] text-ink-500">
          {profile?.name ?? APP.nameFull} — {title}
        </footer>
      )}
    </div>
  );
}

function PrintRow({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="font-medium uppercase tracking-wide text-ink-600">{label}</span>
      <span className={`text-right ${strong ? "font-bold" : "font-semibold"}`}>{value}</span>
    </div>
  );
}

function KpiStrip({
  format,
  items,
}: {
  format: DocFormat;
  items: { label: string; value: string; strong?: boolean }[];
}) {
  if (isA4(format)) {
    return (
      <div className="mb-4 grid grid-cols-4 gap-3">
        {items.map((i) => (
          <PrintRow key={i.label} label={i.label} value={i.value} strong={i.strong} />
        ))}
      </div>
    );
  }
  return (
    <div className="mb-3 border-b border-ink-900 pb-2">
      {items.map((i) => (
        <PrintRow key={i.label} label={i.label} value={i.value} strong={i.strong} />
      ))}
    </div>
  );
}

function SectionTitle({ title, format }: { title: string; format: DocFormat }) {
  return (
    <h2
      className={`${isA4(format) ? "mb-1.5 border-b border-ink-200 pb-1 text-[11px]" : "mt-3 mb-1 text-[10px]"} font-bold uppercase tracking-wider text-ink-800`}
    >
      {title}
    </h2>
  );
}

function DataTable({
  format,
  title,
  cols,
  rows,
  totals,
}: {
  format: DocFormat;
  title: string;
  cols: { label: string; right?: boolean }[];
  rows: ReactNode[][];
  totals?: ReactNode[];
}) {
  const a4 = isA4(format);
  if (a4) {
    return (
      <section className="mb-4">
        <SectionTitle title={title} format={format} />
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-ink-300 text-left text-[10px] uppercase tracking-wide text-ink-600">
              {cols.map((c, i) => (
                <th key={i} className={`py-1 font-semibold ${c.right ? "text-right" : ""}`}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((cells, i) => (
              <tr key={i}>
                {cells.map((cell, j) => (
                  <td key={j} className={`border-b border-ink-100 py-1.5 align-top ${cols[j]?.right ? "text-right" : ""}`}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
            {totals && (
              <tr className="border-t-2 border-ink-300 font-bold">
                {totals.map((cell, j) => (
                  <td key={j} className={`py-1.5 ${cols[j]?.right ? "text-right" : ""}`}>
                    {cell}
                  </td>
                ))}
              </tr>
            )}
          </tbody>
        </table>
      </section>
    );
  }

  return (
    <div className="mt-3">
      <SectionTitle title={title} format={format} />
      {rows.map((cells, i) => (
        <div key={i} className="border-b border-dashed border-ink-200 py-1">
          {cells.map((cell, j) => (
            <div key={j} className="flex items-baseline justify-between gap-2">
              <span className="uppercase tracking-wide text-ink-700">{cols[j]?.label}</span>
              <span className="text-right font-semibold text-ink-900">{cell}</span>
            </div>
          ))}
        </div>
      ))}
      {totals && (
        <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 font-bold">
          {totals.map((cell, j) => (
            <span key={j}>{cell}</span>
          ))}
        </div>
      )}
    </div>
  );
}

const nameCell = (name: string) => <span className="font-semibold text-ink-900">{name}</span>;
const num = (n: number) => <span className="font-semibold text-ink-900">{formatPKR(n)}</span>;

export function SalesReportDoc({
  profile,
  data,
  range,
  format = "a4",
}: {
  profile: CompanyProfile | null;
  data: SalesReport;
  range: ReportRange;
  format?: DocFormat;
}) {
  return (
    <ReportPrintPage profile={profile} title="Sales report" period={formatReportPeriod(range)} format={format}>
      <KpiStrip
        format={format}
        items={[
          { label: "Revenue", value: formatPKR(data.revenue), strong: true },
          { label: "Sales", value: String(data.count) },
          { label: "Items sold", value: String(data.items) },
          { label: "Discounts", value: formatPKR(data.discount) },
        ]}
      />

      {data.byCondition.length > 0 && (
        <DataTable
          format={format}
          title="By condition"
          cols={[{ label: "Condition" }, { label: "Items", right: true }, { label: "Revenue", right: true }]}
          rows={data.byCondition.map((c) => [
            REPORT_CONDITION_LABELS[c.condition] ?? c.condition,
            String(c.items),
            num(c.revenue),
          ])}
        />
      )}

      {data.byBrand.length > 0 && (
        <DataTable
          format={format}
          title="By brand"
          cols={[{ label: "Brand" }, { label: "Sales", right: true }, { label: "Revenue", right: true }]}
          rows={data.byBrand.map((b) => [nameCell(b.name), String(b.count), num(b.revenue)])}
        />
      )}

      {data.byPayment.length > 0 && (
        <DataTable
          format={format}
          title="By payment method"
          cols={[{ label: "Method" }, { label: "Payments", right: true }, { label: "Amount", right: true }]}
          rows={data.byPayment.map((p) => [PAYMENT_METHOD_LABELS[p.method] ?? p.method, String(p.count), num(p.amount)])}
        />
      )}

      {data.byUser.length > 0 && (
        <DataTable
          format={format}
          title="By staff"
          cols={[{ label: "Staff" }, { label: "Sales", right: true }, { label: "Revenue", right: true }]}
          rows={data.byUser.map((u) => [nameCell(u.name), String(u.count), num(u.revenue)])}
        />
      )}
    </ReportPrintPage>
  );
}

export function PurchasesReportDoc({
  profile,
  data,
  range,
  format = "a4",
}: {
  profile: CompanyProfile | null;
  data: PurchaseReport;
  range: ReportRange;
  format?: DocFormat;
}) {
  return (
    <ReportPrintPage profile={profile} title="Purchase report" period={formatReportPeriod(range)} format={format}>
      <KpiStrip
        format={format}
        items={[
          { label: "Amount", value: formatPKR(data.amount), strong: true },
          { label: "Purchases", value: String(data.count) },
          { label: "Units bought", value: String(data.units) },
          { label: "Discounts", value: formatPKR(data.discount) },
        ]}
      />

      {data.byCondition.length > 0 && (
        <DataTable
          format={format}
          title="By condition"
          cols={[{ label: "Condition" }, { label: "Units", right: true }, { label: "Amount", right: true }]}
          rows={data.byCondition.map((c) => [
            REPORT_CONDITION_LABELS[c.condition] ?? c.condition,
            String(c.units),
            num(c.amount),
          ])}
        />
      )}

      {data.byVendor.length > 0 && (
        <DataTable
          format={format}
          title="By vendor"
          cols={[
            { label: "Vendor" },
            { label: "Purchases", right: true },
            { label: "Units", right: true },
            { label: "Amount", right: true },
          ]}
          rows={data.byVendor.map((v) => [nameCell(v.name), String(v.count), String(v.units), num(v.amount)])}
        />
      )}
    </ReportPrintPage>
  );
}

export function ProfitReportDoc({
  profile,
  data,
  range,
  format = "a4",
}: {
  profile: CompanyProfile | null;
  data: ProfitReport;
  range: ReportRange;
  format?: DocFormat;
}) {
  return (
    <ReportPrintPage profile={profile} title="Profit report" period={formatReportPeriod(range)} format={format}>
      <KpiStrip
        format={format}
        items={[
          { label: "Revenue", value: formatPKR(data.revenue) },
          { label: "Cost of goods", value: formatPKR(data.cost) },
          { label: "Expenses", value: formatPKR(data.expenses) },
          { label: "Profit", value: formatPKR(data.profit), strong: true },
        ]}
      />

      {data.byBrand.length > 0 && (
        <DataTable
          format={format}
          title="By brand"
          cols={[
            { label: "Brand" },
            { label: "Revenue", right: true },
            { label: "Cost", right: true },
            { label: "Profit", right: true },
          ]}
          rows={data.byBrand.map((b) => [nameCell(b.name), num(b.revenue), num(b.cost), num(b.profit)])}
        />
      )}

      {data.byCondition.length > 0 && (
        <DataTable
          format={format}
          title="By condition"
          cols={[
            { label: "Condition" },
            { label: "Revenue", right: true },
            { label: "Cost", right: true },
            { label: "Profit", right: true },
          ]}
          rows={data.byCondition.map((c) => [
            REPORT_CONDITION_LABELS[c.condition] ?? c.condition,
            num(c.revenue),
            num(c.cost),
            num(c.profit),
          ])}
        />
      )}

      {data.byModel.length > 0 && (
        <DataTable
          format={format}
          title="By model"
          cols={[
            { label: "Model" },
            { label: "Revenue", right: true },
            { label: "Cost", right: true },
            { label: "Profit", right: true },
          ]}
          rows={data.byModel.map((m) => [nameCell(m.name), num(m.revenue), num(m.cost), num(m.profit)])}
        />
      )}
    </ReportPrintPage>
  );
}

export function ExpensesReportDoc({
  profile,
  data,
  range,
  format = "a4",
}: {
  profile: CompanyProfile | null;
  data: ExpenseReport;
  range: ReportRange;
  format?: DocFormat;
}) {
  return (
    <ReportPrintPage profile={profile} title="Expenses report" period={formatReportPeriod(range)} format={format}>
      <KpiStrip
        format={format}
        items={[
          { label: "Total expenses", value: formatPKR(data.total), strong: true },
          { label: "Expenses", value: String(data.count) },
        ]}
      />

      {data.byCategory.length > 0 && (
        <DataTable
          format={format}
          title="By category"
          cols={[{ label: "Category" }, { label: "Count", right: true }, { label: "Total", right: true }]}
          rows={data.byCategory.map((c) => [
            EXPENSE_CATEGORY_LABELS[c.category] ?? c.category,
            String(c.count),
            num(c.total),
          ])}
          totals={["Total", String(data.count), num(data.total)]}
        />
      )}
    </ReportPrintPage>
  );
}

export function BalancesReportDoc({
  profile,
  data,
  kind,
  title,
  format = "a4",
}: {
  profile: CompanyProfile | null;
  data: BalancesReport;
  kind: "payable" | "receivable";
  title: string;
  format?: DocFormat;
}) {
  const rows = kind === "payable" ? data.payables : data.receivables;
  const total = kind === "payable" ? data.payableTotal : data.receivableTotal;
  const outstandingLabel = kind === "payable" ? "You owe" : "Owed to you";

  return (
    <ReportPrintPage profile={profile} title={title} period="Current balances" format={format}>
      <KpiStrip
        format={format}
        items={[
          { label: kind === "payable" ? "Total payables" : "Total receivables", value: formatPKR(total), strong: true },
          { label: "Contacts", value: String(rows.length) },
        ]}
      />

      <DataTable
        format={format}
        title={title}
        cols={[
          { label: "Contact" },
          { label: "Open", right: true },
          { label: "Total", right: true },
          { label: "Paid", right: true },
          { label: outstandingLabel, right: true },
        ]}
        rows={rows.map((r) => [
          r.source === "REFUND" ? `${r.name} (refund due)` : r.name,
          String(r.count),
          formatPKR(r.total),
          formatPKR(r.paid),
          num(r.outstanding),
        ])}
        totals={[
          "Total",
          String(rows.reduce((s, r) => s + r.count, 0)),
          formatPKR(rows.reduce((s, r) => s + r.total, 0)),
          formatPKR(rows.reduce((s, r) => s + r.paid, 0)),
          num(total),
        ]}
      />
    </ReportPrintPage>
  );
}

export function TransactionListDoc({
  profile,
  title,
  rows,
  format = "a4",
}: {
  profile: CompanyProfile | null;
  title: string;
  rows: Transaction[];
  format?: DocFormat;
}) {
  return (
    <ReportPrintPage profile={profile} title={title} period="Selected period" format={format}>
      <DataTable
        format={format}
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
    </ReportPrintPage>
  );
}