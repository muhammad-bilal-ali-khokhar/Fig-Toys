"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertIcon,
  InventoryIcon,
  PosIcon,
  ProductsIcon,
  PurchasesIcon,
  ReportsIcon,
  ReservationIcon,
  ReturnsIcon,
  UserIcon,
  VoucherIcon,
  WalletIcon,
  XIcon,
} from "@/components/icons";
import { useAuth } from "@/lib/auth-context";
import type { ActivityLog, CompanyProfile, DashboardOverview, ReportRange } from "@/lib/api-types";
import { useApi } from "@/lib/use-api";
import { canViewCosts } from "@/lib/roles";
import { formatMoney, formatMoneyCompact } from "@/lib/money";
import { toISODate } from "@/lib/dates";
import { DEFAULT_DASHBOARD_WIDGETS, type DashboardWidgetKey } from "@/lib/constants";
import { PeriodPicker } from "@/components/reports/period-picker";
import { GlobalSearch } from "@/components/global-search";
import { KpisWidget, Kpis2Widget } from "@/components/dashboard/kpi-widgets";
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

const SHORTCUTS = [
  { href: "/pos", label: "New Sale", icon: PosIcon },
  { href: "/purchases", label: "Buy New", icon: PurchasesIcon },
  { href: "/products", label: "Add Product", icon: ProductsIcon },
  { href: "/contacts", label: "Add Customer", icon: UserIcon },
  { href: "/inventory", label: "Inventory", icon: InventoryIcon },
  { href: "/reports", label: "Reports", icon: ReportsIcon },
  { href: "/sale-returns", label: "Sale Returns", icon: ReturnsIcon },
  { href: "/reservations", label: "Reservations", icon: ReservationIcon },
  { href: "/vouchers", label: "Vouchers", icon: VoucherIcon },
  { href: "/expenses", label: "Expenses", icon: WalletIcon },
];

export default function DashboardPage() {
  const { user } = useAuth();
  const [range, setRange] = useState<ReportRange>(() => {
    const to = new Date();
    const from = new Date(to);
    from.setDate(from.getDate() - 13);
    return { from: toISODate(from), to: toISODate(to) };
  });
  const [lowStockAlertOpen, setLowStockAlertOpen] = useState(true);
  const params = new URLSearchParams();
  if (range.from) params.set("from", range.from);
  if (range.to) params.set("to", range.to);
  const qs = params.toString();
  const overviewPath = qs ? `/dashboard/overview?${qs}` : "/dashboard/overview";
  const { data, loading } = useApi<DashboardOverview>(overviewPath);
  const { data: activity } = useApi<ActivityLog[]>("/dashboard/activity");
  const { data: profile } = useApi<CompanyProfile>("/settings/company");

  const currencySymbol = profile?.currencySymbol ?? "Rs";
  const compact = profile?.compactPrices ?? true;
  const fmt = (n: number | string) => {
    const sym = currencySymbol;
    return compact ? formatMoneyCompact(n, sym) : formatMoney(n, sym);
  };

  const viewCosts = canViewCosts(user);

  const rangeLabel = useMemo(() => {
    if (!range.from && !range.to) return "All time";
    const fmtDate = (iso: string) =>
      new Date(`${iso}T00:00:00`).toLocaleDateString("en-PK", { day: "numeric", month: "short" });
    if (range.from && range.to && range.from !== range.to) {
      return `${fmtDate(range.from)} – ${fmtDate(range.to)}`;
    }
    return "Today";
  }, [range]);

  function renderWidget(key: DashboardWidgetKey) {
    switch (key) {
      case "kpis":
        return <KpisWidget key={key} data={data} viewCosts={viewCosts} fmt={fmt} />;
      case "kpis2":
        return <Kpis2Widget key={key} data={data} viewCosts={viewCosts} fmt={fmt} />;
      case "salesTrend":
        return (
          <SalesTrendWidget
            key={key}
            data={data}
            viewCosts={viewCosts}
            rangeLabel={rangeLabel}
            currencySymbol={currencySymbol}
          />
        );
      case "payments":
        return <PaymentsWidget key={key} data={data} currencySymbol={currencySymbol} />;
      case "topProducts":
        return <TopProductsWidget key={key} data={data} />;
      case "newUsed":
        return <NewUsedWidget key={key} data={data} />;
      case "recentActivity":
        return <RecentActivityWidget key={key} activity={activity} />;
      case "stockPta":
        return <StockPtaWidget key={key} data={data} />;
      case "topSellers":
        return <TopSellersWidget key={key} data={data} rangeLabel={rangeLabel} fmt={fmt} />;
      case "soldCategory":
        return <SoldCategoryWidget key={key} data={data} rangeLabel={rangeLabel} />;
      case "lowStock":
        return <LowStockWidget key={key} data={data} />;
      case "recentTransactions":
        return <RecentTransactionsWidget key={key} data={data} loading={loading} fmt={fmt} />;
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-3xl bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-ink-500">Welcome back, {user?.name}.</p>
          <div className="order-first w-full min-[640px]:order-none min-[640px]:max-w-md min-[900px]:w-80">
            <GlobalSearch />
          </div>
          <PeriodPicker value={range} onChange={setRange} />
        </div>
        <div className="mt-4 grid grid-cols-5 gap-1 min-[900px]:grid-cols-10">
          {SHORTCUTS.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              className="flex flex-col items-center gap-1.5 rounded-2xl px-1 py-2 transition hover:bg-brand-50"
            >
              <span className="rounded-xl bg-brand-50 p-1.5 text-brand-600">
                <s.icon className="h-5 w-5" />
              </span>
              <span className="text-[11px] font-medium leading-tight text-ink-700">{s.label}</span>
            </Link>
          ))}
        </div>
      </div>

      {data && data.lowStock.length > 0 && lowStockAlertOpen ? (
        <div className="flex items-center justify-between gap-3 rounded-3xl bg-warning/10 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="shrink-0 rounded-xl bg-warning/15 p-1.5 text-warning">
              <AlertIcon className="h-4 w-4" />
            </span>
            <p className="text-sm text-ink-700">
              {data.lowStock.length} product{data.lowStock.length > 1 ? "s" : ""} at or below stock
              threshold. Review the low-stock list below.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setLowStockAlertOpen(false)}
            className="shrink-0 rounded-lg p-1 text-ink-400 transition hover:bg-ink-100 hover:text-ink-700"
            aria-label="Dismiss"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        {DEFAULT_DASHBOARD_WIDGETS.map((key) => renderWidget(key))}
      </div>
    </div>
  );
}