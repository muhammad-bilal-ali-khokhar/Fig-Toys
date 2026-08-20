"use client";

import { useMemo } from "react";
import { APP, CONTACTS_TEXT, type ContactsPrintOptions, type PrintFormatId } from "@/lib/constants";
import type { CompanyProfile, Contact } from "@/lib/api-types";
import { formatPKR } from "@/lib/money";
import { formatDateTime } from "@/lib/dates";
import { CONTACT_TYPE_LABELS } from "@/components/ui/type-pill";

export function ContactsDocument({
  contacts,
  options,
  format,
  profile,
}: {
  contacts: Contact[];
  options: ContactsPrintOptions;
  format: PrintFormatId;
  profile: CompanyProfile | null;
}) {
  const isA4 = format === "a4";
  const pad = isA4 ? "px-12 py-10" : "px-3 py-3";
  const base = isA4 ? "text-sm" : "font-mono text-[11px]";
  const divider = isA4 ? "border-t border-ink-200" : "border-t-2 border-dashed border-ink-200";

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

  return (
    <div className={`${isA4 ? "space-y-6 print:space-y-0" : "bg-white"} ${isA4 ? "" : pad} ${base} text-ink-900`}>
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
        <div className="space-y-2.5">
          {options.header && (
            <div className="text-center">
              {(profile?.logoUrl ?? "/icon.png") && (
                <img src={profile?.logoUrl ?? "/icon.png"} alt="" className="mx-auto mb-2 max-h-16 w-auto object-contain grayscale contrast-125" />
              )}
              <p className="break-words text-base font-bold uppercase tracking-wide text-ink-900">
                {profile?.name ?? APP.nameFull}
              </p>
              {options.shopInfo && profile?.tagline && (
                <p className="mt-0.5 text-ink-800">{profile.tagline}</p>
              )}
              <p className="mt-3 text-center text-base font-bold uppercase tracking-widest text-ink-900">
                {CONTACTS_TEXT.title}
              </p>
              <p className="mt-0.5 text-xs text-ink-800">{formatDateTime(new Date().toISOString())}</p>
            </div>
          )}
          {options.footer && (
            <div className={`my-4 ${divider}`} />
          )}
          {sorted.map((c, i) => (
            <div key={c.id} className="border-b border-dashed border-ink-200 pb-2.5">
              <div className="flex items-baseline justify-between gap-2">
                <p className="font-bold text-ink-900">{c.name}</p>
                <p className="whitespace-nowrap text-[9px] text-ink-800">{i + 1}</p>
              </div>
              {options.type && (
                <p className="text-[10px] text-ink-800">
                  {CONTACT_TYPE_LABELS[c.type] ?? c.type.replace("_", " ")}
                </p>
              )}
              {options.phone && c.phone && <p className="text-[10px] text-ink-800">{c.phone}</p>}
              {options.email && c.email && <p className="text-[10px] text-ink-800">{c.email}</p>}
              {options.city && c.city && <p className="text-[10px] text-ink-800">{c.city}</p>}
              {options.cnic && c.cnic && <p className="font-mono text-[10px] text-ink-800">{c.cnic}</p>}
              {options.address && c.address && <p className="text-[10px] text-ink-800">{c.address}</p>}
              {options.notes && c.notes && <p className="text-[10px] text-ink-800">{c.notes}</p>}
              {(parseFloat(c.receivable) > 0 || parseFloat(c.payable) > 0) && (
                <div className="mt-1 space-y-0.5 text-[10px]">
                  {parseFloat(c.receivable) > 0 && (
                    <p className="flex justify-between gap-2 text-ink-900">
                      <span className="uppercase tracking-widest text-ink-800">
                        {CONTACTS_TEXT.debit}
                      </span>
                      <span className="font-semibold">{formatPKR(c.receivable)}</span>
                    </p>
                  )}
                  {parseFloat(c.payable) > 0 && (
                    <p className="flex justify-between gap-2 text-ink-900">
                      <span className="uppercase tracking-widest text-ink-800">
                        {CONTACTS_TEXT.credit}
                      </span>
                      <span className="font-semibold">{formatPKR(c.payable)}</span>
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
          <div className="pt-1">
            <div className="flex justify-between gap-2 text-[10px]">
              <p className="uppercase tracking-widest text-ink-800">
                {CONTACTS_TEXT.receivable}{" "}
                <span className="font-bold text-ink-900">{formatPKR(totalReceivable)}</span>
              </p>
              <p className="uppercase tracking-widest text-ink-800">
                {CONTACTS_TEXT.payable}{" "}
                <span className="font-bold text-ink-900">{formatPKR(totalPayable)}</span>
              </p>
            </div>
          </div>
          {options.footer && profile?.footerText && (
            <div className={`${divider} mt-4 pt-3`}>
              <p className="text-center text-[10px] uppercase tracking-widest text-ink-700">
                {profile.footerText}
              </p>
            </div>
          )}
          {options.signature && (
            <div className="avoid-break mt-10">
              <div className="w-full border-t border-ink-300 pt-1 text-center text-[10px] uppercase tracking-widest text-ink-700">
                {CONTACTS_TEXT.signature}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}