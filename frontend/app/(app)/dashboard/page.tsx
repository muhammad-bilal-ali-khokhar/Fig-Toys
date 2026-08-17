"use client";

import { useEffect, useMemo, useState } from "react";
import type { ComponentType, ReactNode } from "react";
import Link from "next/link";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertIcon,
  ChartPieIcon,
  InventoryIcon,
  PosIcon,
  ProductsIcon,
  PurchasesIcon,
  RefundIcon,
  ReportsIcon,
  ReservationIcon,
  ReturnsIcon,
  TrendingUpIcon,
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
import { pluralize } from "@/lib/pluralize";
import { toISODate } from "@/lib/dates";
import { CHART } from "@/lib/constants";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { PeriodPicker } from "@/components/reports/period-picker";
import { ACTIVITY_ACTION_LABELS, TRANSACTION_TYPE_LABELS } from "@/lib/constants";
import {
  DASHBOARD_WIDGET_SPANS,
  DEFAULT_DASHBOARD_WIDGETS,
  type DashboardWidgetKey,
} from "@/lib/constants/dashboard";

function Card({
  title,
  action,
  children,
  className = "",
}: {
  title?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-3xl bg-white ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between px-5 py-4">
          {title && <h3 className="text-sm font-semibold text-ink-900">{title}</h3>}
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

function KpiCard({ label, value, sub, tone, icon }: {
  label: string;
  value: string;
  sub?: string;
  tone?: string;
  icon?: ComponentType<{ className?: string }>;
}) {
  const Icon = icon;
  return (
    <div className="rounded-3xl bg-white p-5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-ink-500">{label}</p>
        {Icon && <span className="rounded-xl bg-brand-50 p-1.5 text-brand-600"><Icon className="h-4 w-4" /></span>}
      </div>
      <p className={`mt-2 text-2xl font-bold ${tone ?? "text-ink-900"}`}>{value}</p>
      {sub && <p className="mt-1 text-xs text-ink-400">{sub}</p>}
    </div>
  );
}

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

function ChartTooltip({ active, payload, label, money, percent, noHeader, symbol = "Rs" }: {
  active?: boolean;
  payload?: { name?: string; value?: number; color?: string }[];
  label?: string | number;
  money?: boolean;
  percent?: boolean;
  noHeader?: boolean;
  symbol?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const total = payload.reduce((sum, p) => sum + (p.value ?? 0), 0);
  const labelText =
    typeof label === "string" && /^\d{4}-\d{2}-\d{2}$/.test(label)
      ? new Date(label).toLocaleDateString("en-PK", { day: "numeric", month: "short" })
      : String(label ?? "");
  return (
    <div className="min-w-36 rounded-2xl bg-white px-3.5 py-3">
      {!noHeader && labelText && (
        <p className="mb-2 pb-2 text-xs font-semibold uppercase tracking-wide text-ink-900">
          {labelText}
        </p>
      )}
      <div className="space-y-1.5">
        {payload.map((p) => (
          <div key={p.name} className="flex items-center justify-between gap-6">
            <span className="flex items-center gap-1.5 text-xs text-ink-500">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
              {p.name}
            </span>
            <span className="text-xs font-semibold text-ink-900">
              {money ? formatMoney(p.value, symbol) : p.value}
              {percent && total > 0 ? ` · ${Math.round(((p.value ?? 0) / total) * 100)}%` : ""}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AxisTick({ x, y, payload, today }: {
  x?: number | string;
  y?: number | string;
  payload?: { value?: string };
  today?: boolean;
}) {
  return (
    <text
      x={x}
      y={Number(y ?? 0) + 4}
      textAnchor="middle"
      fontSize={11}
      fontWeight={today ? 700 : 400}
      fill={today ? CHART.sales : CHART.ink}
    >
      {new Date(payload?.value ?? "").toLocaleDateString("en-PK", { weekday: "short" })}
    </text>
  );
}

function TodayDot({ cx, cy, payload, todayKey }: {
  cx?: number;
  cy?: number;
  payload?: { day?: string };
  todayKey?: string;
}) {
  if (!payload || payload.day !== todayKey) return null;
  return (
    <g>
      <circle cx={cx} cy={cy} r={7} fill={CHART.sales} opacity={0.18} />
      <circle cx={cx} cy={cy} r={3.5} fill={CHART.sales} stroke="#fff" strokeWidth={2} />
    </g>
  );
}

function actionLabel(action: string) {
  return (
    ACTIVITY_ACTION_LABELS[action] ??
    action
      .split(".").pop()
      ?.toLowerCase()
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase()) ??
    action
  );
}

function entityLabel(entity: string) {
  return entity.replace(/([a-z])([A-Z])/g, "$1 $2");
}

function activityDetail(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const d = JSON.parse(raw) as Record<string, unknown>;
    if (typeof d.number === "string") return d.number;
    if (typeof d.name === "string") return d.name;
    if (typeof d.model === "string") return d.model;
    if (typeof d.sku === "string") return d.sku;
    return null;
  } catch {
    return null;
  }
}

function timeAgo(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-PK", { day: "numeric", month: "short" });
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { toast } = useToast();
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

  const paymentData = data
    ? [
        { name: "Cash", value: data.paymentSplit.CASH, color: CHART.cash },
        { name: "Card", value: data.paymentSplit.CARD, color: CHART.card },
        { name: "Bank", value: data.paymentSplit.BANK_TRANSFER, color: CHART.transfer },
        { name: "Credit", value: data.paymentSplit.CREDIT, color: CHART.credit },
      ].filter((p) => p.value > 0)
    : [];

  const newUsedData = data
    ? [
        { name: "New", value: data.newUsedSold.NEW, color: CHART.new },
        { name: "Used", value: data.newUsedSold.USED, color: CHART.used },
      ]
    : [];

  const trendData = data
    ? data.salesTrend.map((d, i) => ({
        day: d.key,
        Sales: d.revenue,
        ...(viewCosts && data.profitTrend ? { Profit: data.profitTrend[i] ?? 0 } : {}),
      }))
    : [];
  const todayKey = trendData.length > 0 ? trendData[trendData.length - 1].day : "";

  const carrierData = data
    ? [
        { name: "PTA", value: data.carrierSplit.PTA, color: CHART.pta },
        { name: "Non-PTA", value: data.carrierSplit.NON_PTA, color: CHART.nonPta },
        { name: "SIM locked", value: data.carrierSplit.SIM_LOCKED, color: CHART.simLocked },
      ].filter((c) => c.value > 0)
    : [];
  const carrierTotal = carrierData.reduce((sum, c) => sum + c.value, 0);

  const soldTotal = data
    ? data.soldByCategory.PHONE + data.soldByCategory.ACCESSORY
    : 0;

  function widgetBlock(key: DashboardWidgetKey, children: ReactNode) {
    return (
      <div key={key} className={`${DASHBOARD_WIDGET_SPANS[key]} h-full`}>
        {children}
      </div>
    );
  }

  function renderWidget(key: DashboardWidgetKey) {
    switch (key) {
      case "kpis":
        return widgetBlock(
          "kpis",
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
              sub={!data ? undefined : `${data.stock.NEW} new · ${data.stock.USED} used`}
              icon={InventoryIcon}
            />
            <KpiCard
              label="Total Revenue"
              value={!data ? "…" : fmt(data.all.revenue)}
              sub={!data ? undefined : `${data.all.salesCount} sales`}
              icon={ChartPieIcon}
            />
          </div>,
        );
      case "kpis2":
        return widgetBlock(
          "kpis2",
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
              sub={!data ? undefined : "register balance"}
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
          </div>,
        );
      case "salesTrend":
        return widgetBlock(
          "salesTrend",
          <Card title="Sales trend" action={<span className="text-xs text-ink-400">{rangeLabel}</span>} className="flex h-full flex-col">
            <div className="min-h-64 flex-1 px-2 pb-2">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke={CHART.grid} strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="day"
                    tickLine={false}
                    axisLine={false}
                    tick={(props) => (
                      <AxisTick {...props} today={props?.payload?.value === todayKey} />
                    )}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    width={70}
                    tick={{ fontSize: 11, fill: CHART.ink }}
                    tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))}
                  />
                  <Tooltip content={<ChartTooltip money symbol={currencySymbol} />} cursor={{ stroke: CHART.ink, strokeWidth: 1, strokeDasharray: "3 3" }} />
                  <ReferenceLine x={todayKey} stroke={CHART.sales} strokeDasharray="4 4" strokeOpacity={0.5} />
                  <Line
                    type="monotone"
                    dataKey="Sales"
                    stroke={CHART.sales}
                    strokeWidth={2.5}
                    dot={<TodayDot todayKey={todayKey} />}
                    activeDot={{ r: 4.5, stroke: "#fff", strokeWidth: 2 }}
                  />
                  {viewCosts && (
                    <Line
                      type="monotone"
                      dataKey="Profit"
                      stroke={CHART.profit}
                      strokeWidth={2}
                      strokeDasharray="5 4"
                      dot={false}
                      activeDot={{ r: 4, stroke: "#fff", strokeWidth: 2 }}
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>,
        );
      case "payments":
        return widgetBlock(
          "payments",
          <Card title="Payments by method" className="flex h-full flex-col">
            <div className="min-h-64 flex-1 px-2 pb-2">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={paymentData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={78} paddingAngle={2}>
                    {paymentData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltip money percent noHeader symbol={currencySymbol} />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap justify-center gap-3 px-5 pb-4">
              {paymentData.map((p) => (
                <span key={p.name} className="flex items-center gap-1.5 text-xs text-ink-500">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
                  {p.name}
                </span>
              ))}
            </div>
          </Card>,
        );
      case "topProducts":
        return widgetBlock(
          "topProducts",
          <Card title="Top products" className="flex h-full flex-col">
            <div className="min-h-56 flex-1 px-2 pb-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={(data?.topProducts ?? []).map((p) => ({ name: p.name, Units: p.qty }))} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 0 }}>
                  <CartesianGrid stroke={CHART.grid} strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: CHART.ink }} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" width={150} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: CHART.ink }} />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(230,59,32,0.06)" }} />
                  <Bar dataKey="Units" fill={CHART.sales} radius={[0, 6, 6, 0]} barSize={18} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>,
        );
      case "newUsed":
        return widgetBlock(
          "newUsed",
          <Card title="Sold · New vs Used" className="flex h-full flex-col">
            <div className="min-h-40 flex-1 px-2 pb-2">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={newUsedData} dataKey="value" nameKey="name" innerRadius={44} outerRadius={66} paddingAngle={2}>
                    {newUsedData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltip percent noHeader />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-center gap-3 px-5 pb-4">
              {newUsedData.map((p) => (
                <span key={p.name} className="flex items-center gap-1.5 text-xs text-ink-500">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
                  {p.name} · {p.value}
                </span>
              ))}
            </div>
          </Card>,
        );
      case "recentActivity":
        return widgetBlock(
          "recentActivity",
          <Card title="Recent activity" className="flex h-full flex-col">
            {!activity ? (
              <div className="flex-1 space-y-3 px-5 pb-5">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : activity.length > 0 ? (
              <ul className="flex-1">
                {activity.slice(0, 6).map((a) => {
                  const detail = activityDetail(a.details);
                  return (
                    <li key={a.id} className="flex items-center justify-between px-5 py-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-ink-900">{actionLabel(a.action)}</p>
                        <p className="truncate text-xs text-ink-500">
                          {a.user.name} · {entityLabel(a.entity)}
                          {detail ? ` · ${detail}` : ""}
                        </p>
                      </div>
                      <p className="shrink-0 pl-3 text-xs text-ink-400">{timeAgo(a.createdAt)}</p>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="px-5 pb-5 text-sm text-ink-400">No recent activity.</p>
            )}
          </Card>,
        );
      case "stockPta":
        return widgetBlock(
          "stockPta",
          <Card title="Stock · PTA status" className="flex h-full flex-col">
            {!data ? (
              <div className="flex-1 space-y-3 px-5 pb-5">
                <Skeleton className="h-3 w-full rounded-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : carrierTotal > 0 ? (
              <div className="flex-1 px-5 pb-5 pt-1">
                <div className="flex h-3 overflow-hidden rounded-full bg-ink-100">
                  {carrierData.map((c) => (
                    <div
                      key={c.name}
                      style={{ width: `${(c.value / carrierTotal) * 100}%`, backgroundColor: c.color }}
                      className="h-full"
                      title={c.name}
                    />
                  ))}
                </div>
                <ul className="mt-3 space-y-1.5">
                  {carrierData.map((c) => (
                    <li key={c.name} className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2 text-ink-600">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: c.color }} />
                        {c.name}
                      </span>
                      <span className="font-semibold text-ink-900">{c.value}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="px-5 pb-5 text-sm text-ink-400">No units in stock.</p>
            )}
          </Card>,
        );
      case "topSellers":
        return widgetBlock(
          "topSellers",
          <Card title="Top sellers" className="flex h-full flex-col">
            {!data ? (
              <div className="flex-1 space-y-3 px-5 pb-5">
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-full" />
              </div>
            ) : data.topSellers.length > 0 ? (
              <ul className="flex-1 px-5">
                {data.topSellers.map((s, i) => (
                  <li key={s.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <span className="flex min-w-0 items-center gap-2.5 text-ink-700">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-50 text-[10px] font-bold text-brand-600">
                        {i + 1}
                      </span>
                      <span className="truncate">{s.name}</span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block font-semibold text-ink-900">{fmt(s.revenue)}</span>
                      <span className="block text-xs text-ink-400">{pluralize(s.count, "sale")}</span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-5 pb-5 text-sm text-ink-400">No sales in {rangeLabel.toLowerCase()}.</p>
            )}
          </Card>,
        );
      case "soldCategory":
        return widgetBlock(
          "soldCategory",
          <Card
            title="Sold · Phones vs Accessories"
            action={<span className="text-xs text-ink-400">{rangeLabel}</span>}
            className="flex h-full flex-col"
          >
            {!data ? (
              <div className="flex-1 px-5 pb-5">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="mt-3 h-3 w-full rounded-full" />
              </div>
            ) : soldTotal > 0 ? (
              <>
                <div className="grid flex-1 grid-cols-2 gap-4 px-5 pb-3">
                  <div className="rounded-3xl bg-brand-50 p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-ink-500">Phones</p>
                    <p className="mt-1 text-2xl font-bold text-ink-900">{data.soldByCategory.PHONE}</p>
                  </div>
                  <div className="rounded-3xl bg-ink-100 p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-ink-500">Accessories</p>
                    <p className="mt-1 text-2xl font-bold text-ink-900">{data.soldByCategory.ACCESSORY}</p>
                  </div>
                </div>
                <div className="mx-5 flex h-3 overflow-hidden rounded-full bg-ink-100">
                  <div
                    className="h-full bg-brand-500"
                    style={{ width: `${(data.soldByCategory.PHONE / soldTotal) * 100}%` }}
                  />
                  <div
                    className="h-full bg-ink-400"
                    style={{ width: `${(data.soldByCategory.ACCESSORY / soldTotal) * 100}%` }}
                  />
                </div>
                <div className="flex justify-center gap-4 px-5 pb-4 pt-3">
                  <span className="flex items-center gap-1.5 text-xs text-ink-500">
                    <span className="h-2 w-2 rounded-full bg-brand-500" />
                    Phones · {data.soldByCategory.PHONE}
                  </span>
                  <span className="flex items-center gap-1.5 text-xs text-ink-500">
                    <span className="h-2 w-2 rounded-full bg-ink-400" />
                    Accessories · {data.soldByCategory.ACCESSORY}
                  </span>
                </div>
              </>
            ) : (
              <p className="px-5 pb-5 text-sm text-ink-400">No units sold in {rangeLabel.toLowerCase()}.</p>
            )}
          </Card>,
        );
      case "lowStock":
        return widgetBlock(
          "lowStock",
          data && data.lowStock.length > 0 ? (
            <Card title="Low stock" className="flex h-full flex-col">
              <ul className="flex-1 px-5">
                {data.lowStock.map((p) => (
                  <li key={p.id} className="flex items-center justify-between py-2.5 text-sm">
                    <span className="text-ink-700">
                      {p.brand} {p.model} {p.storage ?? ""}
                    </span>
                    <span className="font-semibold text-warning">{p.inStock} left</span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null,
        );
      case "recentTransactions": {
        return (
          <div key={key} className="h-full lg:col-span-2">
            <Card
              title="Recent transactions"
              action={
                <Link href="/reports" className="text-xs font-medium text-brand-600 hover:underline">
                  View all
                </Link>
              }
              className="flex h-full flex-col"
            >
              {loading ? (
                <div className="flex-1 space-y-3 px-5 pb-5">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : data && data.recent.length > 0 ? (
                <ul className="flex-1">
                  {data.recent.map((t) => (
                    <li key={t.id} className="flex items-center justify-between px-5 py-3">
                      <div>
                        <p className="text-sm font-medium text-ink-900">
                          {t.number}
                          <Badge className="ml-2" variant="neutral">{TRANSACTION_TYPE_LABELS[t.type] ?? t.type}</Badge>
                        </p>
                        <p className="text-xs text-ink-500">
                          {t.contact.name} · {t.user.name}
                        </p>
                      </div>
                      <p className="text-sm font-semibold text-ink-900">{fmt(t.total)}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-5 pb-5 text-sm text-ink-400">No transactions yet.</p>
              )}
            </Card>
          </div>
        );
      }
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-3xl bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-ink-500">Welcome back, {user?.name}.</p>
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
