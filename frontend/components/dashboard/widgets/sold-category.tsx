import { Card } from "@/components/dashboard/charts";
import { DASHBOARD_WIDGET_SPANS } from "@/lib/constants";
import { Skeleton } from "@/components/ui/skeleton";
import type { DashboardOverview } from "@/lib/api-types";

const ROOT_COLORS = ["#9b3f68", "#4a8f4d", "#64748b", "#e9a21a", "#7e3f95", "#3b6ea8", "#c98a24", "#6b7280"];

export function SoldCategoryWidget({ data, rangeLabel }: { data?: DashboardOverview | null; rangeLabel: string }) {
  const roots: Record<string, number> = data?.soldByRootCategory ?? (data ? { Phones: data.soldByCategory.PHONE, Accessories: data.soldByCategory.ACCESSORY } : {});
  const entries = Object.entries(roots).sort(([, a], [, b]) => b - a);
  const soldTotal = entries.reduce((s, [, v]) => s + v, 0);
  const subEntries = data ? Object.entries(data.soldBySubCategory).sort(([, a], [, b]) => b - a) : [];

  return (
    <div className={`${DASHBOARD_WIDGET_SPANS.soldCategory} h-full`}>
      <Card
        title="Sold · by Category"
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
            <div className="grid flex-1 grid-cols-2 gap-3 px-5 pb-3">
              {entries.map(([name, qty], i) => (
                <div key={name} className="rounded-3xl bg-ink-50 p-4" style={{ backgroundColor: i === 0 ? "rgb(250 245 247)" : undefined }}>
                  <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-ink-500">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: ROOT_COLORS[i % ROOT_COLORS.length] }} />
                    {name}
                  </p>
                  <p className="mt-1 text-2xl font-bold text-ink-900">{qty}</p>
                </div>
              ))}
              {entries.length === 1 && (
                <div className="rounded-3xl bg-ink-50 p-4 opacity-0" aria-hidden />
              )}
            </div>
            {subEntries.length > 0 && (
              <div className="mx-5 mb-3 max-h-28 overflow-y-auto">
                <div className="flex flex-wrap gap-1.5">
                  {subEntries.map(([name, qty]) => (
                    <span key={name} title={name} className="rounded-full bg-white px-2 py-0.5 text-[10px] font-medium text-ink-600 ring-1 ring-ink-100">
                      {name} · {qty}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <div className="mx-5 flex h-3 overflow-hidden rounded-full bg-ink-100">
              {entries.map(([name, qty], i) => (
                <div
                  key={name}
                  className="h-full"
                  style={{ width: `${(qty / soldTotal) * 100}%`, backgroundColor: ROOT_COLORS[i % ROOT_COLORS.length] }}
                />
              ))}
            </div>
            <div className="flex flex-wrap justify-center gap-3 px-5 pb-4 pt-3">
              {entries.map(([name, qty], i) => (
                <span key={name} className="flex items-center gap-1.5 text-xs text-ink-500">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: ROOT_COLORS[i % ROOT_COLORS.length] }} />
                  {name} · {qty}
                </span>
              ))}
            </div>
            <div className="mx-5 mb-4 flex justify-center gap-4 border-t border-ink-100 pt-3 text-xs text-ink-400">
              <span>Phones · {data.soldByCategory.PHONE}</span>
              <span>Accessories · {data.soldByCategory.ACCESSORY}</span>
            </div>
          </>
        ) : (
          <p className="px-5 pb-5 text-sm text-ink-400">No units sold in {rangeLabel.toLowerCase()}.</p>
        )}
      </Card>
    </div>
  );
}