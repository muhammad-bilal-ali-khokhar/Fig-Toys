import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, ChartTooltip } from "@/components/dashboard/charts";
import { DASHBOARD_WIDGET_SPANS, CHART } from "@/lib/constants";
import type { DashboardOverview } from "@/lib/api-types";

export function TopProductsWidget({ data }: { data?: DashboardOverview | null }) {
  return (
    <div className={`${DASHBOARD_WIDGET_SPANS.topProducts} h-full`}>
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
      </Card>
    </div>
  );
}