"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/apiClient";
import { Dropdown, type DropdownOption } from "@/components/ui/dropdown";
import { Sheet } from "@/components/ui/sheet";
import { EyeIcon, PrinterIcon, RefreshIcon, SearchIcon } from "@/components/icons";
import { TRANSACTION_TYPE_LABELS } from "@/lib/constants/transactions";

type SearchResult = {
  kind: string;
  id: string;
  number: string;
  title: string;
  subtitle?: string;
  date?: string;
  amount?: string;
};

type Action = { label: string; icon: React.ComponentType<{ className?: string }>; href: string };

function kindBadge(kind: string): string {
  switch (kind) {
    case "UNIT":
      return "Unit";
    case "CONTACT":
      return "Contact";
    case "PURCHASE_ORDER":
      return "PO";
    case "RESERVATION":
      return "Reservation";
    case "VOUCHER":
      return "Voucher";
    case "EXPENSE":
      return "Expense";
    default:
      return TRANSACTION_TYPE_LABELS[kind] ?? "Doc";
  }
}

function actionsFor(r: SearchResult): Action[] {
  switch (r.kind) {
    case "SALE":
      return [
        { label: "Modify sale", icon: RefreshIcon, href: `/pos?modify=${r.id}` },
        { label: "Print / view receipt", icon: PrinterIcon, href: `/print?type=SALE&id=${r.id}` },
      ];
    case "PURCHASE":
      return [
        { label: "Modify purchase", icon: RefreshIcon, href: `/purchases?modify=${r.id}` },
        { label: "Print invoice", icon: PrinterIcon, href: `/print?type=PURCHASE&id=${r.id}` },
      ];
    case "SALE_RETURN":
      return [
        { label: "Modify return", icon: RefreshIcon, href: `/sale-returns?modify=${r.id}` },
        { label: "Print return", icon: PrinterIcon, href: `/print?type=SALE_RETURN&id=${r.id}` },
      ];
    case "PURCHASE_RETURN":
      return [
        { label: "Modify return", icon: RefreshIcon, href: `/purchase-returns?modify=${r.id}` },
        { label: "Print return", icon: PrinterIcon, href: `/print?type=PURCHASE_RETURN&id=${r.id}` },
      ];
    case "VOUCHER":
      return [
        { label: "Print voucher", icon: PrinterIcon, href: `/print?type=VOUCHER&id=${r.id}` },
        { label: "View in vouchers", icon: EyeIcon, href: "/vouchers" },
      ];
    case "EXPENSE":
      return [
        { label: "Print voucher", icon: PrinterIcon, href: `/print?type=EXPENSE&id=${r.id}` },
        { label: "View in expenses", icon: EyeIcon, href: "/expenses" },
      ];
    case "RESERVATION":
      return [
        { label: "Modify reservation", icon: RefreshIcon, href: `/reservations?modify=${r.id}` },
        { label: "View in reservations", icon: EyeIcon, href: "/reservations" },
      ];
    case "PURCHASE_ORDER":
      return [{ label: "View purchase order", icon: EyeIcon, href: "/purchase-orders" }];
    case "UNIT":
      return [{ label: "View in inventory", icon: EyeIcon, href: "/inventory" }];
    case "CONTACT":
      return [{ label: "View contact", icon: EyeIcon, href: "/contacts" }];
    default:
      return [];
  }
}

function formatAmount(amount?: string): string {
  if (!amount) return "";
  const n = Number(amount);
  if (Number.isNaN(n)) return "";
  return `Rs ${n.toLocaleString("en-PK")}`;
}

function GlobalSearchField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <span className="flex h-9 items-center gap-2 rounded-2xl bg-ink-100 pl-3 pr-6">
      <SearchIcon className="h-4 w-4 shrink-0 text-ink-400" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search IMEI, sale / purchase / voucher number…"
        className="h-full min-w-0 flex-1 bg-transparent text-sm text-ink-900 outline-none placeholder:text-ink-400"
      />
    </span>
  );
}

export function GlobalSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeResult, setActiveResult] = useState<SearchResult | null>(null);

  useEffect(() => {
    const term = query.trim();
    if (!term) {
      setResults(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const data = await apiRequest<SearchResult[]>(`/search?q=${encodeURIComponent(term)}`);
        setResults(data ?? []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  const byKey = useMemo(() => {
    const map = new Map<string, SearchResult>();
    for (const r of results ?? []) {
      map.set(`${r.kind}|${r.id}`, r);
    }
    return map;
  }, [results]);

  const options: DropdownOption<string>[] =
    loading
      ? [{ value: "__loading", label: "Searching…", disabled: true }]
      : query.trim() && results !== null && results.length === 0
        ? [{ value: "__empty", label: "No matches.", disabled: true }]
        : results === null
          ? [{ value: "__hint", label: "Type an IMEI or document number to search.", disabled: true }]
          : results.map((r) => ({
              value: `${r.kind}|${r.id}`,
              label: `${r.number || r.title} · ${r.title}`,
              leading: (
                <span className="shrink-0 rounded-lg bg-brand-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-600">
                  {kindBadge(r.kind)}
                </span>
              ),
              trailing: r.amount ? (
                <span className="shrink-0 text-xs font-semibold text-ink-700">{formatAmount(r.amount)}</span>
              ) : undefined,
            }));

  function handleSelect(key: string) {
    const r = byKey.get(key);
    if (!r) return;
    setQuery("");
    setResults(null);
    if (results?.length === 1) {
      setActiveResult(r);
    } else {
      const first = actionsFor(r)[0];
      if (first) router.push(first.href);
    }
  }

  return (
    <>
      <Dropdown<string>
        value={null}
        options={options}
        onChange={handleSelect}
        placeholder="Search…"
        trigger={(open) => (
          <span className="block" onClickCapture={open ? (e) => e.stopPropagation() : undefined}>
            <GlobalSearchField value={query} onChange={setQuery} />
          </span>
        )}
      />

      <Sheet
        open={activeResult !== null}
        title={activeResult ? `${kindBadge(activeResult.kind)} · ${activeResult.number}` : ""}
        onClose={() => setActiveResult(null)}
      >
        {activeResult && (
          <div>
            <div className="rounded-2xl bg-ink-50 p-4">
              <p className="text-sm font-semibold text-ink-900">{activeResult.title}</p>
              {activeResult.subtitle && (
                <p className="mt-0.5 text-xs text-ink-500">{activeResult.subtitle}</p>
              )}
              {activeResult.amount && (
                <p className="mt-2 text-lg font-bold text-ink-900">{formatAmount(activeResult.amount)}</p>
              )}
            </div>
            <div className="mt-4 grid gap-2">
              {actionsFor(activeResult).map((a) => {
                const Icon = a.icon;
                return (
                  <Link
                    key={a.label}
                    href={a.href}
                    onClick={() => setActiveResult(null)}
                    className="flex items-center gap-3 rounded-2xl border border-ink-100 px-4 py-3 text-sm font-semibold text-ink-900 transition hover:bg-brand-50"
                  >
                    <span className="rounded-xl bg-brand-50 p-1.5 text-brand-600">
                      <Icon className="h-4 w-4" />
                    </span>
                    {a.label}
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </Sheet>
    </>
  );
}