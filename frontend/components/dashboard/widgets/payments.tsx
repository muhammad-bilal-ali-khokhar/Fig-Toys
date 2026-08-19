import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Card, ChartTooltip } from "@/components/dashboard/charts";
import { DASHBOARD_WIDGET_SPANS, CHART } from "@/lib/constants";
import type { DashboardOverview } from "@/lib/api-types";

type Props = {
  data?: DashboardOverview | null;
  currencySymbol: string;
};

export function PaymentsWidget({ data, currencySymbol }: Props) {
  const paymentData = data
    ? [
        { name: "Cash", value: data.paymentSplit.CASH, color: CHART.cash },
        { name: "Card", value: data.paymentSplit.CARD, color: CHART.card },
        { name: "Bank", value: data.paymentSplit.BANK_TRANSFER, color: CHART.transfer },
        { name: "Credit", value: data.paymentSplit.CREDIT, color: CHART.credit },
      ].filter((p) => p.value > 0)
    : [];

  return (
    <div className={`${DASHBOARD_WIDGET_SPANS.payments} h-full`}>
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
      </Card>
    </div>
  );
}