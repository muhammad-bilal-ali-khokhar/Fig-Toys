import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Card, ChartTooltip } from "@/components/dashboard/charts";
import { DASHBOARD_WIDGET_SPANS, CHART } from "@/lib/constants";
import type { DashboardOverview } from "@/lib/api-types";

export function NewUsedWidget({ data }: { data?: DashboardOverview | null }) {
  const newUsedData = data
    ? [
        { name: "New", value: data.newUsedSold.NEW, color: CHART.new },
        { name: "Used", value: data.newUsedSold.USED, color: CHART.used },
      ]
    : [];

  return (
    <div className={`${DASHBOARD_WIDGET_SPANS.newUsed} h-full`}>
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
      </Card>
    </div>
  );
}