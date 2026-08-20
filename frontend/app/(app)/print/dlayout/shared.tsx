"use client";

import type { ReactNode } from "react";
import { APP, EXPENSE_CATEGORY_LABELS, PAYMENT_METHOD_LABELS, REPORT_CONDITION_LABELS } from "@/lib/constants";
import type { CompanyProfile, ReportRange } from "@/lib/api-types";
import { formatPKR } from "@/lib/money";

export type DocFormat = "58" | "80" | "a4";

export const isA4 = (f: DocFormat) => f === "a4";

export function formatReportPeriod(range: ReportRange): string {
  const fmt = (d?: string) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString() : null);
  const from = fmt(range.from);
  const to = fmt(range.to);
  if (from && to) return `${from} – ${to}`;
  if (from) return from;
  if (to) return to;
  return "All time";
}

export function ReportDocShell({
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

export function PrintRow({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="font-medium uppercase tracking-wide text-ink-600">{label}</span>
      <span className={`text-right ${strong ? "font-bold" : "font-semibold"}`}>{value}</span>
    </div>
  );
}

export function KpiStrip({
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

export function SectionTitle({ title, format }: { title: string; format: DocFormat }) {
  return (
    <h2
      className={`${isA4(format) ? "mb-1.5 border-b border-ink-200 pb-1 text-[11px]" : "mt-3 mb-1 text-[10px]"} font-bold uppercase tracking-wider text-ink-800`}
    >
      {title}
    </h2>
  );
}

export function DataTable({
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

export const nameCell = (name: string) => <span className="font-semibold text-ink-900">{name}</span>;
export const num = (n: number) => <span className="font-semibold text-ink-900">{formatPKR(n)}</span>;
export { APP, EXPENSE_CATEGORY_LABELS, PAYMENT_METHOD_LABELS, REPORT_CONDITION_LABELS };
