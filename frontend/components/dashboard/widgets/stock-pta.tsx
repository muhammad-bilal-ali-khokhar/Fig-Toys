import { Card } from "@/components/dashboard/charts";
import { DASHBOARD_WIDGET_SPANS, CHART } from "@/lib/constants";
import { Skeleton } from "@/components/ui/skeleton";
import type { DashboardOverview } from "@/lib/api-types";

export function StockPtaWidget({ data }: { data?: DashboardOverview | null }) {
  const carrierData = data
    ? [
        { name: "PTA", value: data.carrierSplit.PTA, color: CHART.pta },
        { name: "Non-PTA", value: data.carrierSplit.NON_PTA, color: CHART.nonPta },
        { name: "SIM locked", value: data.carrierSplit.SIM_LOCKED, color: CHART.simLocked },
      ].filter((c) => c.value > 0)
    : [];
  const carrierTotal = carrierData.reduce((sum, c) => sum + c.value, 0);

  return (
    <div className={`${DASHBOARD_WIDGET_SPANS.stockPta} h-full`}>
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
      </Card>
    </div>
  );
}