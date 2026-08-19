import Link from "next/link";
import { Card } from "@/components/dashboard/charts";
import { DASHBOARD_WIDGET_SPANS, TRANSACTION_TYPE_LABELS } from "@/lib/constants";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { DashboardOverview } from "@/lib/api-types";

type Props = {
  data?: DashboardOverview | null;
  loading: boolean;
  fmt: (n: number | string) => string;
};

export function RecentTransactionsWidget({ data, loading, fmt }: Props) {
  return (
    <div className="h-full lg:col-span-2">
      <Card
        title="Recent transactions"
        action={
          <Link href="/reports" className="text-xs font-medium text-brand-600 hover:underline">
            View all
          </Link>
        }
        className="flex h-full flex-col"
      >
        {loading ? (
          <div className="flex-1 space-y-3 px-5 pb-5">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : data && data.recent.length > 0 ? (
          <ul className="flex-1">
            {data.recent.map((t) => (
              <li key={t.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <p className="text-sm font-medium text-ink-900">
                    {t.number}
                    <Badge className="ml-2" variant="neutral">{TRANSACTION_TYPE_LABELS[t.type] ?? t.type}</Badge>
                  </p>
                  <p className="text-xs text-ink-500">
                    {t.contact.name} · {t.user.name}
                  </p>
                </div>
                <p className="text-sm font-semibold text-ink-900">{fmt(t.total)}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-5 pb-5 text-sm text-ink-400">No transactions yet.</p>
        )}
      </Card>
    </div>
  );
}