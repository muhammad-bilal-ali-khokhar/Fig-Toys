import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Card, ChartTooltip } from "@/components/dashboard/charts";
import { DASHBOARD_WIDGET_SPANS } from "@/lib/constants";
import type { DashboardOverview } from "@/lib/api-types";

const COLORS = ["#9b3f68", "#4a8f4d", "#64748b", "#e9a21a", "#7e3f95", "#3b6ea8", "#c98a24", "#ff5018", "#2563eb", "#7c3aed"];

export function NewUsedWidget({ data }: { data?: DashboardOverview | null }) {
  const subEntries = data ? Object.entries(data.soldBySubCategory).sort(([, a], [, b]) => b - a) : [];
  const rootEntries = data ? Object.entries(data.soldByRootCategory).sort(([, a], [, b]) => b - a) : [];
  const chartData = rootEntries.map(([name, value], i) => ({ name, value, color: COLORS[i % COLORS.length] }));
  const total = chartData.reduce((s, d) => s + d.value, 0);

  return (
    <div className={`${DASHBOARD_WIDGET_SPANS.newUsed} h-full`}>
      <Card title="Sold · by Category" className="flex h-full flex-col">
        <div className="min-h-48 flex-1 px-2 pb-2">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={chartData} dataKey="value" nameKey="name" innerRadius={46} outerRadius={72} paddingAngle={2}>
                {chartData.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<ChartTooltip percent noHeader />} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex flex-wrap justify-center gap-2 px-3 pb-1">
          {chartData.map((p) => (
            <span key={p.name} className="flex items-center gap-1.5 text-[11px] text-ink-600">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
              <span className="max-w-36 truncate" title={p.name}>
                {p.name}
              </span>{" "}
              · {p.value}
            </span>
          ))}
        </div>
        {chartData.length === 0 && (
          <p className="pb-4 text-center text-xs text-ink-400">{total === 0 ? "No sales in period" : ""}</p>
        )}
        {subEntries.length > 0 && (
          <div className="mx-3 mb-2 max-h-20 overflow-y-auto border-t border-ink-100 pt-2">
            <div className="flex flex-wrap justify-center gap-1.5">
              {subEntries.map(([name, qty]) => (
                <span key={name} title={name} className="rounded-full bg-ink-50 px-2 py-0.5 text-[10px] font-medium text-ink-600">
                  {name} · {qty}
                </span>
              ))}
            </div>
          </div>
        )}
        <div className="mx-3 mb-3 flex flex-wrap justify-center gap-1.5 pt-1">
          {data && (data.soldByCategory.PHONE + data.soldByCategory.ACCESSORY > 0) && (
            <span className="text-[10px] text-ink-400">
              {data.soldByCategory.PHONE} phones · {data.soldByCategory.ACCESSORY} accessories
            </span>
          )}
        </div>
      </Card>
    </div>
  );
}
