import { Card } from "@/components/dashboard/charts";
import { actionLabel, entityLabel, activityDetail, timeAgo } from "@/components/dashboard/activity";
import { DASHBOARD_WIDGET_SPANS } from "@/lib/constants";
import { Skeleton } from "@/components/ui/skeleton";
import type { ActivityLog } from "@/lib/api-types";

export function RecentActivityWidget({ activity }: { activity?: ActivityLog[] | null }) {
  return (
    <div className={`${DASHBOARD_WIDGET_SPANS.recentActivity} h-full`}>
      <Card title="Recent activity" className="flex h-full flex-col">
        {!activity ? (
          <div className="flex-1 space-y-3 px-5 pb-5">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : activity.length > 0 ? (
          <ul className="flex-1">
            {activity.slice(0, 6).map((a) => {
              const detail = activityDetail(a.details);
              return (
                <li key={a.id} className="flex items-center justify-between px-5 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink-900">{actionLabel(a.action)}</p>
                    <p className="truncate text-xs text-ink-500">
                      {a.user.name} · {entityLabel(a.entity)}
                      {detail ? ` · ${detail}` : ""}
                    </p>
                  </div>
                  <p className="shrink-0 pl-3 text-xs text-ink-400">{timeAgo(a.createdAt)}</p>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="px-5 pb-5 text-sm text-ink-400">No recent activity.</p>
        )}
      </Card>
    </div>
  );
}