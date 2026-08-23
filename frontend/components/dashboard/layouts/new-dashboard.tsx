"use client";

import Link from "next/link";
import {
  AlertIcon,
  InventoryIcon,
  PosIcon,
  ProductsIcon,
  PurchasesIcon,
  ReportsIcon,
  TrendingUpIcon,
  VoucherIcon,
  WalletIcon,
  XIcon,
} from "@/components/icons";
import { GlobalSearch } from "@/components/global-search";
import { PeriodPicker } from "@/components/reports/period-picker";
import { SalesTrendWidget } from "@/components/dashboard/widgets/sales-trend";
import { PaymentsWidget } from "@/components/dashboard/widgets/payments";
import { TopProductsWidget } from "@/components/dashboard/widgets/top-products";
import { NewUsedWidget } from "@/components/dashboard/widgets/new-used";
import { RecentActivityWidget } from "@/components/dashboard/widgets/recent-activity";
import { StockPtaWidget } from "@/components/dashboard/widgets/stock-pta";
import { TopSellersWidget } from "@/components/dashboard/widgets/top-sellers";
import { SoldCategoryWidget } from "@/components/dashboard/widgets/sold-category";
import { LowStockWidget } from "@/components/dashboard/widgets/low-stock";
import { RecentTransactionsWidget } from "@/components/dashboard/widgets/recent-transactions";
import type { ActivityLog, CompanyProfile, DashboardOverview, ReportRange } from "@/lib/api-types";
import { useAuth } from "@/lib/auth-context";
import { canViewCosts } from "@/lib/roles";
import { formatMoney, formatMoneyCompact } from "@/lib/money";
import { useMemo, useState } from "react";

const SHORTCUTS = [
  { href: "/pos", label: "New Sale", icon: PosIcon, tone: "bg-brand-500 text-white" },
  { href: "/purchases", label: "Buy New", icon: PurchasesIcon, tone: "bg-ink-900 text-white" },
  { href: "/products", label: "Products", icon: ProductsIcon, tone: "bg-violet-500 text-white" },
  { href: "/inventory", label: "Inventory", icon: InventoryIcon, tone: "bg-teal-500 text-white" },
  { href: "/reports", label: "Reports", icon: ReportsIcon, tone: "bg-gold-500 text-white" },
];

function HeroStat({
  label,
  value,
  sub,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-3xl bg-white p-5">
      <div className={`absolute right-0 top-0 h-24 w-24 -translate-y-6 translate-x-6 rounded-full opacity-10 ${accent}`} />
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-ink-400">{label}</p>
        <span className={`rounded-xl p-2 ${accent} text-white`}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-3 text-2xl font-bold tracking-tight text-ink-900">{value}</p>
      {sub && <p className="mt-1 text-xs font-medium text-ink-500">{sub}</p>}
    </div>
  );
}

type Props = {
  data?: DashboardOverview | null;
  activity?: ActivityLog[] | null;
  profile?: CompanyProfile | null;
  loading: boolean;
  range: ReportRange;
  setRange: (r: ReportRange) => void;
};

export function NewDashboard({ data, activity, profile, loading, range, setRange }: Props) {
  const { user } = useAuth();
  const [lowStockAlertOpen, setLowStockAlertOpen] = useState(true);
  const currencySymbol = profile?.currencySymbol ?? "Rs";
  const compact = profile?.compactPrices ?? true;
  const fmt = (n: number | string) => (compact ? formatMoneyCompact(n, currencySymbol) : formatMoney(n, currencySymbol));
  const viewCosts = canViewCosts(user);

  const rangeLabel = useMemo(() => {
    if (!range.from && !range.to) return "All time";
    const fmtDate = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric" });
    if (range.from && range.to && range.from !== range.to) return `${fmtDate(range.from)} – ${fmtDate(range.to)}`;
    return "Today";
  }, [range]);

  const cashOnHandTone = !data || data.cashOnHand >= 0 ? "text-success" : "text-error";
  const netCash = data ? data.range.cashIn - data.range.cashOut : 0;

  return (
    <div className="space-y-5">
      <div className="rounded-3xl bg-ink-900 p-5 text-white">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-white/60">Dashboard · New layout — beta</p>
            <h1 className="mt-1 text-xl font-bold tracking-tight">Welcome back, {user?.name}</h1>
            <p className="mt-1 text-sm text-white/70">{rangeLabel} · {profile?.name ?? "Your store"} · We will update everything to this layout in future.</p>
          </div>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
            <div className="w-full sm:w-72">
              <div className="[&>div]:!bg-white/10 [&_input]:!bg-transparent [&_input]:!text-white [&_input]:placeholder:!text-white/50 [&_svg]:!text-white/60">
                <GlobalSearch />
              </div>
            </div>
            <div className="[&>button]:!bg-white [&>button]:!text-ink-900">
              <PeriodPicker value={range} onChange={setRange} />
            </div>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
          {SHORTCUTS.map((s) => (
            <Link key={s.href} href={s.href} className="flex items-center gap-3 rounded-2xl bg-white/10 px-4 py-3 backdrop-blur transition hover:bg-white/15">
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${s.tone}`}>
                <s.icon className="h-4 w-4" />
              </span>
              <span className="text-sm font-semibold text-white">{s.label}</span>
            </Link>
          ))}
        </div>
      </div>

      {data && data.lowStock.length > 0 && lowStockAlertOpen ? (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-warning/20 bg-warning/10 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-warning text-white">
              <AlertIcon className="h-4 w-4" />
            </span>
            <div>
              <p className="text-sm font-semibold text-ink-900">{data.lowStock.length} product{data.lowStock.length > 1 ? "s" : ""} at low stock</p>
              <p className="text-xs text-ink-500">Threshold breached — check the stock card below.</p>
            </div>
          </div>
          <button type="button" onClick={() => setLowStockAlertOpen(false)} className="shrink-0 rounded-xl bg-white p-2 text-ink-400 shadow-sm transition hover:text-ink-700" aria-label="Dismiss">
            <XIcon className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <HeroStat label="Sales" value={!data ? "…" : fmt(data.range.revenue)} sub={!data ? undefined : `${data.range.salesCount} invoices · Total ${fmt(data.all.revenue)}`} icon={WalletIcon} accent="bg-brand-500" />
        <HeroStat label={viewCosts ? "Net Profit" : "Purchases"} value={!data ? "…" : viewCosts ? (data.range.profit === null ? "—" : fmt(data.range.profit)) : fmt(data.range.purchasesAmount)} sub={viewCosts ? "For selected period" : "Stock purchases in period"} icon={TrendingUpIcon} accent="bg-violet-500" />
        <HeroStat label="Units in Stock" value={!data ? "…" : String(data.stock.total)} sub={!data ? undefined : `${data.stock.NEW} new · ${data.stock.USED} used · ${data.stock.accessories ?? 0} acc`} icon={InventoryIcon} accent="bg-teal-500" />
        <HeroStat label="Cash on Hand" value={!data ? "…" : fmt(data.cashOnHand)} sub={!data ? undefined : `${fmt(data.money?.totalBankBalance ?? 0)} in bank`} icon={VoucherIcon} accent="bg-ink-700" />
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        <div className="lg:col-span-3 grid gap-4">
          <div className="rounded-3xl bg-white p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">Cash flow</p>
            <p className={`mt-2 text-2xl font-bold ${netCash >= 0 ? "text-success" : "text-error"}`}>{!data ? "…" : fmt(netCash)}</p>
            <p className="mt-1 text-xs text-ink-500">{!data ? "—" : `${fmt(data.range.cashIn)} in · ${fmt(data.range.cashOut)} out`}</p>
            <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-2xl bg-ink-50 p-3">
                <p className="font-medium text-ink-500">Receivables</p>
                <p className="mt-1 text-sm font-bold text-ink-900">{!data ? "…" : fmt(data.credit.receivables)}</p>
              </div>
              <div className="rounded-2xl bg-ink-50 p-3">
                <p className="font-medium text-ink-500">Payables</p>
                <p className="mt-1 text-sm font-bold text-ink-900">{!data ? "…" : fmt(data.credit.payables)}</p>
              </div>
            </div>
          </div>

          <div className="rounded-3xl bg-white p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">Reservations & Value</p>
            <div className="mt-3 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-ink-600">Active reservations</span>
                <span className="text-sm font-bold text-ink-900">{!data ? "…" : data.reservations.active}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-ink-600">Advance held</span>
                <span className="text-sm font-bold text-ink-900">{!data ? "…" : fmt(data.reservations.advance)}</span>
              </div>
              <div className="h-px bg-ink-100" />
              <div className="flex items-center justify-between">
                <span className="text-sm text-ink-600">Inventory value</span>
                <span className="text-sm font-bold text-ink-900">{!data ? "…" : fmt(data.stockValue.retail)}</span>
              </div>
              <p className="text-xs text-ink-400">{!data || data.stockValue.cost === null ? "" : `${fmt(data.stockValue.cost)} cost`}</p>
            </div>
          </div>

          <div className="[&>div]:!h-auto">
            <StockPtaWidget data={data} />
          </div>
        </div>

        <div className="lg:col-span-6 [&>div]:!col-span-12 [&>div]:h-full">
          <SalesTrendWidget data={data} viewCosts={viewCosts} rangeLabel={rangeLabel} currencySymbol={currencySymbol} />
        </div>

        <div className="lg:col-span-3 grid gap-4 [&>div]:!col-span-12 [&>div]:h-auto">
          <PaymentsWidget data={data} currencySymbol={currencySymbol} />
          <NewUsedWidget data={data} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3 [&>div]:!col-span-12 [&>div]:h-full">
        <TopProductsWidget data={data} />
        <SoldCategoryWidget data={data} rangeLabel={rangeLabel} />
        <TopSellersWidget data={data} rangeLabel={rangeLabel} fmt={fmt} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 [&>div]:!col-span-12">
          <RecentTransactionsWidget data={data} loading={loading} fmt={fmt} />
        </div>
        <div className="space-y-4 [&>div]:!col-span-12">
          <LowStockWidget data={data} />
          <RecentActivityWidget activity={activity} />
        </div>
      </div>

      <div className="flex items-center justify-center gap-2 rounded-2xl bg-ink-900 px-4 py-3 text-xs text-white/70">
        <span className="rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-white">New layout · Beta</span>
        <span>Classic is kept as default. Switch anytime from Dashboard or Settings → Theme. Full rollout coming later.</span>
      </div>
    </div>
  );
}
