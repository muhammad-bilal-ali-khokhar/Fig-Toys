import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, ChartTooltip, AxisTick, TodayDot } from "@/components/dashboard/charts";
import { DASHBOARD_WIDGET_SPANS, CHART } from "@/lib/constants";
import type { DashboardOverview } from "@/lib/api-types";

type Props = {
  data?: DashboardOverview | null;
  viewCosts: boolean;
  rangeLabel: string;
  currencySymbol: string;
};

export function SalesTrendWidget({ data, viewCosts, rangeLabel, currencySymbol }: Props) {
  const trendData = data
    ? data.salesTrend.map((d, i) => ({
        day: d.key,
        Sales: d.revenue,
        ...(viewCosts && data.profitTrend ? { Profit: data.profitTrend[i] ?? 0 } : {}),
      }))
    : [];
  const todayKey = trendData.length > 0 ? trendData[trendData.length - 1].day : "";

  return (
    <div className={`${DASHBOARD_WIDGET_SPANS.salesTrend} h-full`}>
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
      </Card>
    </div>
  );
}