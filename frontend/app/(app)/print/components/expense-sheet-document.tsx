"use client";

import { APP, EXPENSE_CATEGORY_LABELS, PRINT_DEFAULT_CONFIG, EXPENSE_PRINT_TEXT, type ExpenseSheetOptions, type PrintFormatId , type PrintConfig } from "@/lib/constants";
import type { CompanyProfile, Expense } from "@/lib/api-types";
import { formatPKR } from "@/lib/money";
import { formatDateTime } from "@/lib/dates";

export function ExpenseSheetDocument({
  expenses,
  options,
  format,
  profile,
  config: configProp,
}: {
  expenses: Expense[];
  options: ExpenseSheetOptions;
  format: PrintFormatId;
  profile: CompanyProfile | null;
  config?: PrintConfig;
}) {
  const isA4 = format === "a4";
  const config = configProp ?? PRINT_DEFAULT_CONFIG;
  const pad = isA4 ? "px-12 py-10" : "";
  const base = isA4 ? "text-sm" : "font-mono font-bold";
  const divider = isA4 ? "border-t border-ink-200" : "border-t-2 border-dashed border-black";
  const densityClass = isA4 ? "" : config.density === "bold" ? "font-black" : config.density === "light" ? "font-normal" : "font-bold";
  const total = expenses.reduce((sum, e) => sum + parseFloat(e.amount), 0);

  const thermalStyle = isA4 ? {} : { fontSize: config.fontSize, lineHeight: config.lineHeight, padding: `${config.paddingMm}mm` } as const;
  return (
    <div style={thermalStyle} className={`bg-white ${pad} ${base} ${densityClass} ${isA4 ? "" : config.compact ? "leading-tight" : ""} ${isA4 ? "text-ink-900" : "text-black"}`}>
      {options.header && (
        <div className="text-center">
          {profile?.logoUrl && (
            <img src={profile.logoUrl} alt="" className="mx-auto mb-2 max-h-16 w-auto object-contain" />
          )}
          <p className={`break-words font-black uppercase tracking-wide ${isA4 ? "text-base text-ink-900" : "font-mono text-[14px] text-black"}`}>
            {profile?.name ?? APP.nameFull}
          </p>
          {options.shopInfo && profile?.tagline && (
            <p className={`mt-1 font-bold leading-tight ${isA4 ? "text-ink-800" : "font-mono text-[11px] text-black"}`}>{profile.tagline}</p>
          )}
          <p className={`mt-2 font-black uppercase tracking-widest ${isA4 ? "text-sm text-ink-900" : "font-mono text-[13px] text-black"}`}>
            {EXPENSE_PRINT_TEXT.sheetTitle}
          </p>
          {options.date && (
            <p className={`mt-1 font-bold ${isA4 ? "text-xs text-ink-800" : "font-mono text-[11px] text-black"}`}>{formatDateTime(new Date().toISOString())}</p>
          )}
        </div>
      )}

      <div className={`my-4 ${divider}`} />

      <table className="w-full border-collapse font-mono">
        <thead>
          <tr className={`border-b-2 text-left text-[11px] font-black uppercase tracking-widest ${isA4 ? "border-ink-300 text-ink-800" : "border-black text-black"}`}>
            <th className="py-1.5 pr-2">{EXPENSE_PRINT_TEXT.no}</th>
            {options.number && <th className="py-1.5 pr-2">Ref</th>}
            {options.date && <th className="py-1.5 pr-2">{EXPENSE_PRINT_TEXT.date}</th>}
            {options.category && <th className="py-1.5 pr-2">{EXPENSE_PRINT_TEXT.category}</th>}
            {options.contact && <th className="py-1.5 pr-2">{EXPENSE_PRINT_TEXT.contact}</th>}
            {options.note && <th className="py-1.5 pr-2">{EXPENSE_PRINT_TEXT.note}</th>}
            <th className="py-1.5 text-right">{EXPENSE_PRINT_TEXT.amount}</th>
          </tr>
        </thead>
        <tbody>
          {expenses.map((e, i) => (
            <tr key={e.id} className={`border-b align-top ${isA4 ? "border-ink-100" : "border-black/20"}`}>
              <td className={`py-1.5 pr-2 font-black ${isA4 ? "text-ink-800" : "text-black"}`}>{i + 1}</td>
              {options.number && (
                <td className={`py-1.5 pr-2 font-mono text-[11px] font-black ${isA4 ? "text-ink-700" : "text-black"}`}>{e.number}</td>
              )}
              {options.date && (
                <td className={`py-1.5 pr-2 whitespace-nowrap font-bold ${isA4 ? "text-ink-900" : "text-black"}`}>
                  {new Date(e.date).toLocaleDateString()}
                </td>
              )}
              {options.category && (
                <td className={`py-1.5 pr-2 font-bold ${isA4 ? "" : "text-black"}`}>{EXPENSE_CATEGORY_LABELS[e.category] ?? e.category}</td>
              )}
              {options.contact && (
                <td className={`py-1.5 pr-2 font-bold ${isA4 ? "" : "text-black"}`}>{e.contact?.name || "-"}</td>
              )}
              {options.note && <td className={`py-1.5 pr-2 font-bold ${isA4 ? "text-ink-900" : "text-black"}`}>{e.note || "-"}</td>}
              <td className={`py-1.5 text-right font-black ${isA4 ? "text-ink-900" : "text-black"}`}>
                {formatPKR(parseFloat(e.amount))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {options.footer && (
        <>
          <div className={`my-4 ${divider}`} />
          <div className="flex items-center justify-between font-mono">
            <p className={`text-[11px] font-black uppercase tracking-widest ${isA4 ? "text-ink-800" : "text-black"}`}>
              {EXPENSE_PRINT_TEXT.total}
            </p>
            <p className={`font-black ${isA4 ? "text-2xl text-ink-900" : "font-mono text-[18px] text-black"}`}>{formatPKR(total)}</p>
          </div>
          <p className={`mt-1 text-right font-mono text-[11px] font-bold ${isA4 ? "text-ink-700" : "text-black"}`}>
            {expenses.length} {EXPENSE_PRINT_TEXT.count}
          </p>
          {profile?.footerText && (
            <div className={`${divider} mt-4 pt-3`}>
              <p className={`text-center font-mono text-[11px] font-black uppercase tracking-widest ${isA4 ? "text-ink-700" : "text-black"}`}>
                {profile.footerText}
              </p>
            </div>
          )}
          {options.signature && (
            <div className="avoid-break mt-10">
              <div className={`ml-auto w-64 pt-2 text-center font-mono text-[11px] font-black uppercase tracking-widest ${isA4 ? "border-t border-ink-300 text-ink-700" : "border-t-2 border-black text-black"}`}>
                {EXPENSE_PRINT_TEXT.signature}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}