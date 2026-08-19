import { Card } from "@/components/dashboard/charts";
import { DASHBOARD_WIDGET_SPANS } from "@/lib/constants";
import { Skeleton } from "@/components/ui/skeleton";
import type { DashboardOverview } from "@/lib/api-types";

export function SoldCategoryWidget({ data, rangeLabel }: { data?: DashboardOverview | null; rangeLabel: string }) {
  const soldTotal = data
    ? data.soldByCategory.PHONE + data.soldByCategory.ACCESSORY
    : 0;

  return (
    <div className={`${DASHBOARD_WIDGET_SPANS.soldCategory} h-full`}>
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
                {data.soldByCategory.ACCESSORY > 0 && Object.keys(data.soldBySubCategory).length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {Object.entries(data.soldBySubCategory)
                      .sort(([, a], [, b]) => b - a)
                      .map(([name, qty]) => (
                        <span key={name} className="rounded-full bg-white px-2 py-0.5 text-[10px] font-medium text-ink-600">
                          {name} · {qty}
                        </span>
                      ))}
                  </div>
                )}
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
      </Card>
    </div>
  );
}