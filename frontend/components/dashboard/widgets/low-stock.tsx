import { Card } from "@/components/dashboard/charts";
import { DASHBOARD_WIDGET_SPANS } from "@/lib/constants";
import type { DashboardOverview } from "@/lib/api-types";

export function LowStockWidget({ data }: { data?: DashboardOverview | null }) {
  if (!data || data.lowStock.length === 0) return null;
  return (
    <div className={`${DASHBOARD_WIDGET_SPANS.lowStock} h-full`}>
      <Card title="Low stock" className="flex h-full flex-col">
        <ul className="flex-1 px-5">
          {data.lowStock.map((p) => (
            <li key={p.id} className="flex items-center justify-between py-2.5 text-sm">
              <span className="text-ink-700">
                {p.brand} {p.model} {p.storage ?? ""}
              </span>
              <span className="font-semibold text-warning">{p.inStock} left</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}