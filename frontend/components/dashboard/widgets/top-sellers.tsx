import { Card } from "@/components/dashboard/charts";
import { DASHBOARD_WIDGET_SPANS } from "@/lib/constants";
import { Skeleton } from "@/components/ui/skeleton";
import { pluralize } from "@/lib/pluralize";
import type { DashboardOverview } from "@/lib/api-types";

type Props = {
  data?: DashboardOverview | null;
  rangeLabel: string;
  fmt: (n: number | string) => string;
};

export function TopSellersWidget({ data, rangeLabel, fmt }: Props) {
  return (
    <div className={`${DASHBOARD_WIDGET_SPANS.topSellers} h-full`}>
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
      </Card>
    </div>
  );
}