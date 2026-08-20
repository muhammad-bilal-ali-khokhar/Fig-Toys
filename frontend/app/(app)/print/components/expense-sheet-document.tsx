"use client";

import { APP, EXPENSE_CATEGORY_LABELS, EXPENSE_PRINT_TEXT, type ExpenseSheetOptions, type PrintFormatId } from "@/lib/constants";
import type { CompanyProfile, Expense } from "@/lib/api-types";
import { formatPKR } from "@/lib/money";
import { formatDateTime } from "@/lib/dates";

export function ExpenseSheetDocument({
  expenses,
  options,
  format,
  profile,
}: {
  expenses: Expense[];
  options: ExpenseSheetOptions;
  format: PrintFormatId;
  profile: CompanyProfile | null;
}) {
  const isA4 = format === "a4";
  const pad = isA4 ? "px-12 py-10" : "px-3 py-3";
  const base = isA4 ? "text-sm" : "font-mono text-[11px]";
  const divider = isA4 ? "border-t border-ink-200" : "border-t-2 border-dashed border-ink-200";
  const total = expenses.reduce((sum, e) => sum + parseFloat(e.amount), 0);

  return (
    <div className={`bg-white ${pad} ${base} text-ink-900`}>
      {options.header && (
        <div className="text-center">
          {profile?.logoUrl && (
            <img src={profile.logoUrl} alt="" className="mx-auto mb-2 max-h-16 w-auto object-contain" />
          )}
          <p className="break-words text-base font-bold uppercase tracking-wide text-ink-900">
            {profile?.name ?? APP.nameFull}
          </p>
          {options.shopInfo && profile?.tagline && (
            <p className="mt-0.5 text-ink-800">{profile.tagline}</p>
          )}
          <p className="mt-1 text-sm font-bold uppercase tracking-widest text-ink-900">
            {EXPENSE_PRINT_TEXT.sheetTitle}
          </p>
          {options.date && (
            <p className="mt-0.5 text-xs text-ink-800">{formatDateTime(new Date().toISOString())}</p>
          )}
        </div>
      )}

      <div className={`my-4 ${divider}`} />

      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-ink-300 text-left text-[10px] font-semibold uppercase tracking-widest text-ink-800">
            <th className="py-1 pr-2">{EXPENSE_PRINT_TEXT.no}</th>
            {options.number && <th className="py-1 pr-2">Ref</th>}
            {options.date && <th className="py-1 pr-2">{EXPENSE_PRINT_TEXT.date}</th>}
            {options.category && <th className="py-1 pr-2">{EXPENSE_PRINT_TEXT.category}</th>}
            {options.contact && <th className="py-1 pr-2">{EXPENSE_PRINT_TEXT.contact}</th>}
            {options.note && <th className="py-1 pr-2">{EXPENSE_PRINT_TEXT.note}</th>}
            <th className="py-1 text-right">{EXPENSE_PRINT_TEXT.amount}</th>
          </tr>
        </thead>
        <tbody>
          {expenses.map((e, i) => (
            <tr key={e.id} className="border-b border-ink-100 align-top">
              <td className="py-1.5 pr-2 text-ink-800">{i + 1}</td>
              {options.number && (
                <td className="py-1.5 pr-2 font-mono text-[10px] text-ink-700">{e.number}</td>
              )}
              {options.date && (
                <td className="py-1.5 pr-2 whitespace-nowrap text-ink-900">
                  {new Date(e.date).toLocaleDateString()}
                </td>
              )}
              {options.category && (
                <td className="py-1.5 pr-2">{EXPENSE_CATEGORY_LABELS[e.category] ?? e.category}</td>
              )}
              {options.contact && (
                <td className="py-1.5 pr-2">{e.contact?.name || "-"}</td>
              )}
              {options.note && <td className="py-1.5 pr-2 text-ink-900">{e.note || "-"}</td>}
              <td className="py-1.5 text-right font-semibold text-ink-900">
                {formatPKR(parseFloat(e.amount))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {options.footer && (
        <>
          <div className={`my-4 ${divider}`} />
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-ink-800">
              {EXPENSE_PRINT_TEXT.total}
            </p>
            <p className={`font-black text-ink-900 ${isA4 ? "text-2xl" : "text-xl"}`}>{formatPKR(total)}</p>
          </div>
          <p className="mt-1 text-right text-[10px] text-ink-700">
            {expenses.length} {EXPENSE_PRINT_TEXT.count}
          </p>
          {profile?.footerText && (
            <div className={`${divider} mt-4 pt-3`}>
              <p className="text-center text-[10px] uppercase tracking-widest text-ink-700">
                {profile.footerText}
              </p>
            </div>
          )}
          {options.signature && (
            <div className="avoid-break mt-10">
              <div className="ml-auto w-64 border-t border-ink-300 pt-1 text-center text-[10px] uppercase tracking-widest text-ink-700">
                {EXPENSE_PRINT_TEXT.signature}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}