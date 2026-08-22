import {
  ChartPieIcon,
  InventoryIcon,
  PurchasesIcon,
  RefundIcon,
  ReservationIcon,
  TrendingUpIcon,
  VoucherIcon,
  WalletIcon,
} from "@/components/icons";
import { KpiCard } from "@/components/dashboard/charts";
import { DASHBOARD_WIDGET_SPANS } from "@/lib/constants";
import { pluralize } from "@/lib/pluralize";
import type { DashboardOverview } from "@/lib/api-types";

type KpiWidgetProps = {
  data?: DashboardOverview | null;
  viewCosts: boolean;
  fmt: (n: number | string) => string;
};

export function KpisWidget({ data, viewCosts, fmt }: KpiWidgetProps) {
  return (
    <div className={`${DASHBOARD_WIDGET_SPANS.kpis} h-full`}>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          label="Sales"
          value={!data ? "…" : fmt(data.range.revenue)}
          sub={!data ? undefined : pluralize(data.range.salesCount, "invoice")}
          tone="text-brand-600"
          icon={WalletIcon}
        />
        {viewCosts ? (
          <KpiCard
            label="Net Profit"
            value={!data || data.range.profit === null ? "…" : fmt(data.range.profit)}
            tone="text-warning"
            icon={TrendingUpIcon}
          />
        ) : (
          <KpiCard
            label="Purchases"
            value={!data ? "…" : fmt(data.range.purchasesAmount)}
            icon={PurchasesIcon}
          />
        )}
        <KpiCard
          label="Units In Stock"
          value={!data ? "…" : String(data.stock.total)}
          sub={
            !data
              ? undefined
              : (data.stock.accessories ?? 0) > 0
                ? `${data.stock.phones ?? data.stock.NEW + data.stock.USED} phones · ${data.stock.accessories} accessories`
                : `${data.stock.NEW} new · ${data.stock.USED} used`
          }
          icon={InventoryIcon}
        />
        <KpiCard
          label="Total Revenue"
          value={!data ? "…" : fmt(data.all.revenue)}
          sub={!data ? undefined : `${data.all.salesCount} sales`}
          icon={ChartPieIcon}
        />
      </div>
    </div>
  );
}

export function Kpis2Widget({ data, fmt }: KpiWidgetProps) {
  return (
    <div className={`${DASHBOARD_WIDGET_SPANS.kpis2} h-full`}>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
        <KpiCard
          label="Expenses"
          value={!data ? "…" : fmt(data.range.expensesAmount)}
          sub={!data ? undefined : pluralize(data.range.expensesCount, "expense")}
          icon={WalletIcon}
        />
        <KpiCard
          label="Net Cash"
          value={!data ? "…" : fmt(data.range.cashIn - data.range.cashOut)}
          sub={
            !data
              ? undefined
              : `${fmt(data.range.cashIn)} in · ${fmt(data.range.cashOut)} out`
          }
          tone={
            !data || data.range.cashIn - data.range.cashOut >= 0 ? "text-success" : "text-error"
          }
          icon={VoucherIcon}
        />
        <KpiCard
          label="Cash on Hand"
          value={!data ? "…" : fmt(data.cashOnHand)}
          sub={
            !data
              ? undefined
              : data.money
                ? `${fmt(data.money.totalBankBalance)} in bank${data.money.pendingCard > 0 ? ` · ${fmt(data.money.pendingCard)} card pending` : ""}`
                : "register balance"
          }
          tone={!data || data.cashOnHand >= 0 ? "text-success" : "text-error"}
          icon={RefundIcon}
        />
        <KpiCard
          label="Outstanding Credit"
          value={!data ? "…" : fmt(data.credit.receivables)}
          sub={
            !data
              ? undefined
              : data.credit.payables > 0
                ? `Payables ${fmt(data.credit.payables)}`
                : undefined
          }
          icon={RefundIcon}
        />
        <KpiCard
          label="Active Reservations"
          value={!data ? "…" : String(data.reservations.active)}
          sub={
            !data
              ? undefined
              : `${pluralize(data.reservations.consignments, "consignment")} · ${fmt(data.reservations.advance)} advance`
          }
          icon={ReservationIcon}
        />
        <KpiCard
          label="Inventory Value"
          value={!data ? "…" : fmt(data.stockValue.retail)}
          sub={
            !data || data.stockValue.cost === null
              ? undefined
              : `${fmt(data.stockValue.cost)} cost`
          }
          icon={InventoryIcon}
        />
      </div>
    </div>
  );
}