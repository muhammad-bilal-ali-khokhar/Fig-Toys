"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { apiRequest } from "@/lib/apiClient";
import type { CompanyProfile } from "@/lib/api-types";

export function ReportPrint({
  trigger,
  children,
}: {
  trigger: (open: () => void, busy: boolean) => ReactNode;
  children: (profile: CompanyProfile | null) => ReactNode;
}) {
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [profile, setProfile] = useState<CompanyProfile | null>(null);
  const printedRef = useRef(false);

  async function open() {
    if (busy) return;
    setBusy(true);
    setReady(false);
    printedRef.current = false;
    try {
      const p = await apiRequest<CompanyProfile>("/settings/company");
      setProfile(p);
    } catch {
      setProfile(null);
    } finally {
      setReady(true);
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!ready || printedRef.current) return;
    printedRef.current = true;
    const t = setTimeout(() => {
      window.print();
    }, 100);
    return () => clearTimeout(t);
  }, [ready]);

  const printCss = `
    #report-print-portal { display: none; }
    @page { size: A4 portrait; margin: 8mm; }
    @media print {
      body { background: #fff !important; }
      body > *:not(#report-print-portal) { display: none !important; }
      #report-print-portal { display: block !important; }
      #report-print-portal .print-doc { width: 190mm; }
      #report-print-portal thead { display: table-header-group; }
      #report-print-portal table { break-inside: auto; }
      #report-print-portal .avoid-break { break-inside: avoid; }
      #report-print-portal .a4-page { width: 190mm; min-height: 281mm; }
      #report-print-portal .a4-page:not(:first-child) { page-break-before: always; }
    }
  `;

  return (
    <>
      {trigger(open, busy)}
      {ready &&
        typeof document !== "undefined" &&
        createPortal(
          <>
            <style>{printCss}</style>
            <div id="report-print-portal">
              <div className="print-doc">{children(profile)}</div>
            </div>
          </>,
          document.body,
        )}
    </>
  );
}