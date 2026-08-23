"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiRequest } from "@/lib/apiClient";
import { Dropdown, type DropdownOption } from "@/components/ui/dropdown";
import { Sheet } from "@/components/ui/sheet";
import {
  EyeIcon,
  InventoryIcon,
  PosIcon,
  PrinterIcon,
  ProductsIcon,
  PurchasesIcon,
  RefundIcon,
  SearchIcon,
  VoucherIcon,
  WalletIcon,
} from "@/components/icons";
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
    case "PRODUCT":
      return "Product";
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
        { label: "Modify sale", icon: PosIcon, href: `/pos?modify=${r.id}` },
        { label: "Create return", icon: RefundIcon, href: `/sale-returns?fromSale=${r.id}` },
        { label: "Print / view receipt", icon: PrinterIcon, href: `/print?type=SALE&id=${r.id}` },
        { label: "View all sales", icon: EyeIcon, href: "/reports/sales-list" },
      ];
    case "PURCHASE":
      return [
        { label: "Modify purchase", icon: PurchasesIcon, href: `/purchases?modify=${r.id}` },
        { label: "Create purchase return", icon: RefundIcon, href: `/purchase-returns?fromPurchase=${r.id}` },
        { label: "Print invoice", icon: PrinterIcon, href: `/print?type=PURCHASE&id=${r.id}` },
        { label: "View all purchases", icon: EyeIcon, href: "/reports/purchase-list" },
      ];
    case "SALE_RETURN":
      return [
        { label: "Modify return", icon: RefundIcon, href: `/sale-returns?modify=${r.id}` },
        { label: "Print return", icon: PrinterIcon, href: `/print?type=SALE_RETURN&id=${r.id}` },
        { label: "View sale returns", icon: EyeIcon, href: "/sale-returns" },
      ];
    case "PURCHASE_RETURN":
      return [
        { label: "Modify return", icon: RefundIcon, href: `/purchase-returns?modify=${r.id}` },
        { label: "Print return", icon: PrinterIcon, href: `/print?type=PURCHASE_RETURN&id=${r.id}` },
        { label: "View purchase returns", icon: EyeIcon, href: "/purchase-returns" },
      ];
    case "VOUCHER":
      return [
        { label: "Print voucher", icon: PrinterIcon, href: `/print?type=VOUCHER&id=${r.id}` },
        { label: "View in vouchers", icon: VoucherIcon, href: "/vouchers" },
        { label: "View ledger", icon: EyeIcon, href: "/reports/ledger" },
      ];
    case "EXPENSE":
      return [
        { label: "Print voucher", icon: PrinterIcon, href: `/print?type=EXPENSE&id=${r.id}` },
        { label: "View in expenses", icon: WalletIcon, href: "/expenses" },
      ];
    case "RESERVATION":
      return [
        { label: "Modify reservation", icon: InventoryIcon, href: `/reservations?modify=${r.id}` },
        { label: "View in reservations", icon: EyeIcon, href: "/reservations" },
        { label: "Create sale from reservation", icon: PosIcon, href: `/pos?reservationId=${r.id}` },
      ];
    case "PURCHASE_ORDER":
      return [
        { label: "View purchase order", icon: EyeIcon, href: "/purchase-orders" },
        { label: "Create purchase", icon: PurchasesIcon, href: `/purchases?orderId=${r.id}` },
      ];
    case "UNIT":
      return [
        { label: "View in inventory", icon: InventoryIcon, href: `/inventory?imei=${encodeURIComponent(r.number)}` },
        { label: "Sell this unit", icon: PosIcon, href: `/pos?imei=${encodeURIComponent(r.number)}` },
        { label: "Print / history", icon: PrinterIcon, href: `/reports/device-lookup?imei=${encodeURIComponent(r.number)}` },
      ];
    case "PRODUCT":
      return [
        { label: "View product", icon: ProductsIcon, href: `/products?search=${encodeURIComponent(r.number)}` },
        { label: "View in inventory", icon: InventoryIcon, href: `/inventory?productId=${r.id}` },
        { label: "New purchase", icon: PurchasesIcon, href: `/purchases?productId=${r.id}` },
        { label: "New sale", icon: PosIcon, href: `/pos?productId=${r.id}` },
      ];
    case "CONTACT":
      return [
        { label: "View contact", icon: EyeIcon, href: `/contacts?search=${encodeURIComponent(r.number || r.title)}` },
        { label: "New sale for customer", icon: PosIcon, href: `/pos?contactId=${r.id}` },
        { label: "New purchase from vendor", icon: PurchasesIcon, href: `/purchases?contactId=${r.id}` },
        { label: "View ledger", icon: VoucherIcon, href: `/reports/ledger?contactId=${r.id}` },
        { label: "Create voucher", icon: WalletIcon, href: `/vouchers?contactId=${r.id}` },
      ];
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
  onFocus,
  onBlur,
  variant = "light",
}: {
  value: string;
  onChange: (value: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  variant?: "light" | "dark";
}) {
  const isDark = variant === "dark";
  return (
    <span
      className={`flex h-9 items-center gap-2 rounded-2xl pl-3 pr-6 ${isDark ? "bg-white/10" : "bg-ink-100"}`}
    >
      <SearchIcon className={`h-4 w-4 shrink-0 ${isDark ? "text-white/60" : "text-ink-400"}`} />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={onFocus}
        onBlur={onBlur}
        placeholder="Search IMEI, sale / purchase / voucher number…"
        className={`h-full min-w-0 flex-1 bg-transparent text-sm outline-none ${isDark ? "text-white placeholder:text-white/50" : "text-ink-900 placeholder:text-ink-400"}`}
      />
    </span>
  );
}

export function GlobalSearch({ variant = "light" }: { variant?: "light" | "dark" }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeResult, setActiveResult] = useState<SearchResult | null>(null);
  const [isFocused, setIsFocused] = useState(false);

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
    setActiveResult(r);
  }

  return (
    <>
      <Dropdown<string>
        value={null}
        options={options}
        onChange={handleSelect}
        placeholder="Search…"
        open={isFocused}
        onOpenChange={setIsFocused}
        trigger={(open) => (
          <span className="block" onClickCapture={open ? (e) => e.stopPropagation() : undefined}>
            <GlobalSearchField
              value={query}
              onChange={setQuery}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setTimeout(() => setIsFocused(false), 150)}
              variant={variant}
            />
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