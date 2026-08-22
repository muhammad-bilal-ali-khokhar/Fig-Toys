"use client";

import { useMemo } from "react";
import { APP, CONTACTS_TEXT, PRINT_DEFAULT_CONFIG, type ContactsPrintOptions, type PrintFormatId , type PrintConfig } from "@/lib/constants";
import type { CompanyProfile, Contact } from "@/lib/api-types";
import { formatPKR } from "@/lib/money";
import { formatDateTime } from "@/lib/dates";
import { CONTACT_TYPE_LABELS } from "@/components/ui/type-pill";

export function ContactsDocument({
  contacts,
  options,
  format,
  profile,
  config: configProp,
}: {
  contacts: Contact[];
  options: ContactsPrintOptions;
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

  const sorted = useMemo(
    () => [...contacts].sort((a, b) => a.name.localeCompare(b.name)),
    [contacts],
  );
  const totalReceivable = sorted.reduce((sum, c) => sum + (parseFloat(c.receivable) || 0), 0);
  const totalPayable = sorted.reduce((sum, c) => sum + (parseFloat(c.payable) || 0), 0);

  const A4_ROWS_PER_PAGE = 20;
  const a4Pages = useMemo(() => {
    if (!isA4) return [];
    const pages: Contact[][] = [];
    for (let i = 0; i < sorted.length; i += A4_ROWS_PER_PAGE) {
      pages.push(sorted.slice(i, i + A4_ROWS_PER_PAGE));
    }
    if (pages.length === 0) pages.push([]);
    return pages;
  }, [isA4, sorted]);

  const thermalStyle = isA4 ? {} : { fontSize: config.fontSize, lineHeight: config.lineHeight, padding: `${config.paddingMm}mm` } as const;
  return (
    <div style={thermalStyle} className={`${isA4 ? "space-y-6 print:space-y-0" : "bg-white"} ${isA4 ? "" : ""} ${base} ${densityClass} ${isA4 ? "" : config.compact ? "leading-tight" : ""} ${isA4 ? "text-ink-900" : "text-black"}`}>
      {isA4 ? (
        a4Pages.map((pageContacts, pageIndex) => {
          const pageStart = pageIndex * A4_ROWS_PER_PAGE;
          const isLast = pageIndex === a4Pages.length - 1;
          return (
            <div key={pageIndex} className="a4-page min-h-[1018px] bg-white px-12 py-10 shadow-lg print:h-auto print:shadow-none">
              {pageIndex === 0 ? (
                options.header && (
                  <div className="flex items-start justify-between gap-8">
                    <div className="max-w-xs">
                      {(profile?.logoUrl ?? "/icon.png") && (
                        <img src={profile?.logoUrl ?? "/icon.png"} alt="" className="mb-2 max-h-16 w-auto object-contain" />
                      )}
                      <p className="break-words text-2xl font-bold tracking-tight text-ink-900">
                        {profile?.name ?? APP.nameFull}
                      </p>
                      {options.shopInfo && profile?.tagline && (
                        <p className="mt-1 text-sm text-ink-800">{profile.tagline}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold uppercase tracking-wide text-ink-900">
                        {CONTACTS_TEXT.title}
                      </p>
                      <div className="mt-3 space-y-1 border-t-2 border-ink-900 pt-2">
                        <p className="text-sm text-ink-800">{CONTACTS_TEXT.generated}</p>
                        <p className="text-sm font-semibold text-ink-900">{formatDateTime(new Date().toISOString())}</p>
                      </div>
                    </div>
                  </div>
                )
              ) : (
                <div className="mb-4 flex items-center justify-between text-center">
                  <p className="break-words text-base font-bold uppercase tracking-wide text-ink-900">
                    {profile?.name ?? APP.nameFull}
                  </p>
                  <p className="text-sm font-bold uppercase tracking-widest text-ink-900">
                    {CONTACTS_TEXT.title}
                  </p>
                </div>
              )}

              {options.footer && (
                <div className={`my-4 ${divider}`} />
              )}
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b-2 border-ink-900 text-left text-[10px] font-semibold uppercase tracking-widest text-ink-800">
                      <th className="py-1.5 pr-2">{CONTACTS_TEXT.no}</th>
                      <th className="py-1.5 pr-2">{CONTACTS_TEXT.name}</th>
                      {options.type && <th className="py-1.5 pr-2">{CONTACTS_TEXT.type}</th>}
                      {options.cnic && <th className="py-1.5 pr-2">{CONTACTS_TEXT.cnic}</th>}
                      <th className="py-1.5 pr-2 text-right">{CONTACTS_TEXT.debit}</th>
                      <th className="py-1.5 pr-2 text-right">{CONTACTS_TEXT.credit}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageContacts.map((c, i) => (
                      <tr
                        key={c.id}
                        className={`align-top ${i % 2 ? "bg-ink-50/60" : ""} border-b border-ink-100`}
                      >
                        <td className="py-2 pr-2 text-ink-800">{pageStart + i + 1}</td>
                        <td className="py-2 pr-2">
                          <p className="font-semibold text-ink-900">{c.name}</p>
                          {(options.phone && c.phone) ||
                          (options.email && c.email) ||
                          (options.city && c.city) ? (
                            <p className="mt-0.5 text-[10px] text-ink-800">
                              {[
                                options.phone && c.phone ? c.phone : null,
                                options.email && c.email ? c.email : null,
                                options.city && c.city ? c.city : null,
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                            </p>
                          ) : null}
                          {options.address && c.address && (
                            <p className="mt-0.5 text-[10px] text-ink-800">{c.address}</p>
                          )}
                          {options.notes && c.notes && (
                            <p className="mt-0.5 text-[10px] text-ink-800">{c.notes}</p>
                          )}
                        </td>
                        {options.type && (
                          <td className="py-2 pr-2">
                            {CONTACT_TYPE_LABELS[c.type] ?? c.type.replace("_", " ")}
                          </td>
                        )}
                        {options.cnic && (
                          <td className="py-2 pr-2 font-mono text-[10px] text-ink-900">{c.cnic || "-"}</td>
                        )}
                        <td className="py-2 pr-2 text-right whitespace-nowrap text-ink-900">
                          {parseFloat(c.receivable) > 0 ? formatPKR(c.receivable) : "-"}
                        </td>
                        <td className="py-2 pr-2 text-right whitespace-nowrap text-ink-900">
                          {parseFloat(c.payable) > 0 ? formatPKR(c.payable) : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {isLast && (
                    <tfoot>
                      <tr className="border-t-2 border-ink-900">
                        <td colSpan={2 + (options.type ? 1 : 0) + (options.cnic ? 1 : 0)} className="py-2 pr-2 text-right text-[10px] font-semibold uppercase tracking-widest text-ink-800">
                          {sorted.length} {sorted.length === 1 ? CONTACTS_TEXT.contact : CONTACTS_TEXT.contacts}
                        </td>
                        <td className="py-2 pr-2 text-right font-bold text-ink-900">{formatPKR(totalReceivable)}</td>
                        <td className="py-2 pr-2 text-right font-bold text-ink-900">{formatPKR(totalPayable)}</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
                {!isLast && (
                  <p className="mt-1 text-right text-[10px] font-semibold uppercase tracking-widest text-ink-700">
                    {CONTACTS_TEXT.page} {pageIndex + 1} / {a4Pages.length}
                  </p>
                )}

                {isLast && options.footer && profile?.footerText && (
                  <div className={`${divider} mt-4 pt-3`}>
                    <p className="text-center text-[10px] uppercase tracking-widest text-ink-700">
                      {profile.footerText}
                    </p>
                  </div>
                )}
                {isLast && options.signature && (
                  <div className="avoid-break mt-10">
                    <div className="ml-auto w-64 border-t border-ink-300 pt-1 text-center text-[10px] uppercase tracking-widest text-ink-700">
                      {CONTACTS_TEXT.signature}
                    </div>
                  </div>
                )}
              </div>
            );
          })
      ) : (
        <div className="space-y-2.5 font-mono">
          {options.header && (
            <div className="text-center">
              {(profile?.logoUrl ?? "/icon.png") && (
                <img src={profile?.logoUrl ?? "/icon.png"} alt="" className="mx-auto mb-2 max-h-16 w-auto object-contain grayscale contrast-125" />
              )}
              <p className="break-words font-mono text-[14px] font-black uppercase tracking-wide text-black">
                {profile?.name ?? APP.nameFull}
              </p>
              {options.shopInfo && profile?.tagline && (
                <p className="mt-1 font-mono text-[11px] font-bold leading-tight text-black">{profile.tagline}</p>
              )}
              <p className="mt-3 text-center font-mono text-[13px] font-black uppercase tracking-widest text-black">
                {CONTACTS_TEXT.title}
              </p>
              <p className="mt-1 font-mono text-[11px] font-bold text-black">{formatDateTime(new Date().toISOString())}</p>
            </div>
          )}
          {options.footer && (
            <div className={`my-4 ${divider}`} />
          )}
          {sorted.map((c, i) => (
            <div key={c.id} className="border-b border-dashed border-black pb-3">
              <div className="flex items-baseline justify-between gap-2">
                <p className="font-mono text-[12px] font-black leading-tight text-black">{c.name}</p>
                <p className="whitespace-nowrap font-mono text-[11px] font-black text-black">{i + 1}</p>
              </div>
              {options.type && (
                <p className="font-mono text-[11px] font-bold leading-tight text-black">
                  {CONTACT_TYPE_LABELS[c.type] ?? c.type.replace("_", " ")}
                </p>
              )}
              {options.phone && c.phone && <p className="font-mono text-[11px] font-bold leading-tight text-black">{c.phone}</p>}
              {options.email && c.email && <p className="font-mono text-[11px] font-bold leading-tight text-black">{c.email}</p>}
              {options.city && c.city && <p className="font-mono text-[11px] font-bold leading-tight text-black">{c.city}</p>}
              {options.cnic && c.cnic && <p className="font-mono text-[11px] font-black leading-tight text-black">{c.cnic}</p>}
              {options.address && c.address && <p className="font-mono text-[11px] font-bold leading-tight text-black">{c.address}</p>}
              {options.notes && c.notes && <p className="font-mono text-[11px] font-bold leading-tight text-black">{c.notes}</p>}
              {(parseFloat(c.receivable) > 0 || parseFloat(c.payable) > 0) && (
                <div className="mt-1.5 space-y-1 font-mono text-[11px]">
                  {parseFloat(c.receivable) > 0 && (
                    <p className="flex justify-between gap-2 text-black">
                      <span className="font-black uppercase tracking-widest">
                        {CONTACTS_TEXT.debit}
                      </span>
                      <span className="font-black">{formatPKR(c.receivable)}</span>
                    </p>
                  )}
                  {parseFloat(c.payable) > 0 && (
                    <p className="flex justify-between gap-2 text-black">
                      <span className="font-black uppercase tracking-widest">
                        {CONTACTS_TEXT.credit}
                      </span>
                      <span className="font-black">{formatPKR(c.payable)}</span>
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
          <div className="border-t-2 border-black pt-2 font-mono">
            <div className="flex justify-between gap-2 text-[11px] font-black uppercase tracking-widest text-black">
              <p>
                {CONTACTS_TEXT.receivable}{" "}
                <span>{formatPKR(totalReceivable)}</span>
              </p>
              <p>
                {CONTACTS_TEXT.payable}{" "}
                <span>{formatPKR(totalPayable)}</span>
              </p>
            </div>
          </div>
          {options.footer && profile?.footerText && (
            <div className={`${divider} mt-4 pt-3`}>
              <p className="text-center font-mono text-[11px] font-black uppercase tracking-widest text-black">
                {profile.footerText}
              </p>
            </div>
          )}
          {options.signature && (
            <div className="avoid-break mt-10">
              <div className="w-full border-t-2 border-black pt-2 text-center font-mono text-[11px] font-black uppercase tracking-widest text-black">
                {CONTACTS_TEXT.signature}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}