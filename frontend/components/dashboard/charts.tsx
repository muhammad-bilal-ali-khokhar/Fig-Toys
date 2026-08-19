import type { ComponentType, ReactNode } from "react";
import { formatMoney } from "@/lib/money";
import { CHART } from "@/lib/constants";

export function Card({
  title,
  action,
  children,
  className = "",
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
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

export function KpiCard({
  label,
  value,
  sub,
  tone,
  icon,
}: {
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

export function ChartTooltip({
  active,
  payload,
  label,
  money,
  percent,
  noHeader,
  symbol = "Rs",
}: {
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

export function AxisTick({
  x,
  y,
  payload,
  today,
}: {
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

export function TodayDot({
  cx,
  cy,
  payload,
  todayKey,
}: {
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