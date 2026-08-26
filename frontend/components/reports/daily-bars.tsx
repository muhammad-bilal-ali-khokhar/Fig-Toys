"use client";

import { useMemo } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ReportCard } from "@/components/reports/report-card";
import { ChartTooltip } from "@/components/dashboard/charts";
import { formatPKR } from "@/lib/money";
import { useChartColors } from "@/lib/chart-colors";

const MAX_POINTS = 31;

function downsample(points: { date: string; value: number }[]) {
  if (points.length <= MAX_POINTS) return points;
  const bucket = points.length / MAX_POINTS;
  const out: { date: string; value: number }[] = [];
  for (let i = 0; i < MAX_POINTS; i++) {
    const start = Math.floor(i * bucket);
    const end = Math.min(Math.ceil((i + 1) * bucket), points.length);
    const slice = points.slice(start, end);
    if (slice.length === 0) continue;
    const value = slice.reduce((s, p) => s + p.value, 0);
    const date = i === MAX_POINTS - 1 ? slice[slice.length - 1].date : slice[0].date;
    out.push({ date, value });
  }
  return out;
}

function shortDate(d: string) {
  const [, m, day] = d.split("-");
  return `${Number(m)}/${Number(day)}`;
}

export function DailyBars({
  title,
  points,
  format = formatPKR,
}: {
  title: string;
  points: { date: string; value: number }[];
  format?: (value: number) => string;
}) {
  const C = useChartColors();
  const data = useMemo(() => downsample(points), [points]);
  const gradientId = `grad-${title.replace(/\s+/g, "-").toLowerCase()}`;

  return (
    <ReportCard title={title} sub={`${points.length} day(s)`}>
      {data.length === 0 ? (
        <p className="text-sm text-ink-400">No data.</p>
      ) : (
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={C.sales} stopOpacity={0.28} />
                  <stop offset="100%" stopColor={C.sales} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={C.grid} strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                minTickGap={28}
                tick={{ fontSize: 11, fill: C.ink }}
                tickFormatter={(v: string) => shortDate(v)}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={64}
                tick={{ fontSize: 11, fill: C.ink }}
                tickFormatter={(v: number) =>
                  v >= 1000000
                    ? `${(v / 1000000).toFixed(1)}M`
                    : v >= 1000
                      ? `${Math.round(v / 1000)}k`
                      : String(v)
                }
              />
              <Tooltip
                content={<ChartTooltip money symbol="Rs" />}
                cursor={{ stroke: C.ink, strokeWidth: 1, strokeDasharray: "3 3" }}
              />
              <Area
                type="monotone"
                dataKey="value"
                name={title}
                stroke={C.sales}
                strokeWidth={2.5}
                fill={`url(#${gradientId})`}
                activeDot={{ r: 4.5, stroke: "#fff", strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </ReportCard>
  );
}
